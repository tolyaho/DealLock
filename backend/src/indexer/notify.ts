import type { Agreement, ChainEvent } from "@prisma/client";
import { db } from "../db.js";
import { renderContractActionEmail } from "../email/templates.js";
import { sendEmail } from "../email/sendEmail.js";
import {
  CONTRACT_ACTION_LABELS,
  CONTRACT_ACTION_PREFERENCE,
  type ContractActionType,
} from "../contractActions.js";
import { getOrCreatePreferences } from "../notificationPreferences.js";
import { notificationRuleForEvent, type PartyRole } from "./eventMap.js";
import { markNotificationsProcessed } from "./store.js";

function appUrl(): string {
  return (process.env.APP_URL ?? process.env.FRONTEND_ORIGIN ?? "http://localhost:5173").replace(/\/+$/, "");
}

function roleAddress(agreement: Agreement, role: PartyRole): string {
  return role === "client" ? agreement.clientAddress : agreement.providerAddress;
}

function roleContactEmail(agreement: Agreement, role: PartyRole): string | null {
  return role === "client" ? agreement.clientEmail : agreement.providerEmail;
}

function roleForAddress(agreement: Agreement, address: string | null): PartyRole | null {
  if (address === agreement.clientAddress) return "client";
  if (address === agreement.providerAddress) return "provider";
  return null;
}

function itemLabel(event: ChainEvent): string | undefined {
  if ((event.itemType !== "milestone" && event.itemType !== "adjustment") || event.itemId == null) {
    return undefined;
  }
  return `${event.itemType === "milestone" ? "Milestone" : "Adjustment"} #${event.itemId}`;
}

function amountLabel(event: ChainEvent, agreement: Agreement): string | undefined {
  const raw = event.amountRaw ?? event.amountWei;
  if (!raw) return undefined;
  try {
    const decimals = event.paymentDecimals ?? agreement.paymentDecimals;
    const symbol = event.paymentSymbol ?? agreement.paymentSymbol;
    const base = 10n ** BigInt(decimals);
    const value = BigInt(raw);
    const whole = value / base;
    const fraction = (value % base).toString().padStart(decimals, "0").replace(/0+$/, "");
    const displayFraction = fraction.slice(0, decimals === 6 ? 2 : 6);
    return `${whole.toString()}${displayFraction ? `.${displayFraction}` : ""} ${symbol}`;
  } catch {
    return undefined;
  }
}

function recipientRoles(agreement: Agreement, event: ChainEvent): PartyRole[] {
  const rule = notificationRuleForEvent(event.eventName);
  if (!rule || rule.recipients === "none") return [];
  if (rule.recipients === "client" || rule.recipients === "provider") return [rule.recipients];
  if (rule.recipients === "both") return ["client", "provider"];

  const counterpartyRole = roleForAddress(agreement, event.counterpartyAddress);
  return counterpartyRole ? [counterpartyRole] : ["client", "provider"];
}

async function resolveRecipient(args: {
  agreement: Agreement;
  role: PartyRole;
  actionType: ContractActionType;
}): Promise<{
  email: string | null;
  userId: string | null;
  preferenceEnabled: boolean;
}> {
  const recipientWallet = await db.wallet.findUnique({
    where: { address: roleAddress(args.agreement, args.role) },
    include: { user: { include: { notificationPreference: true } } },
  });

  if (recipientWallet?.user.email && recipientWallet.user.emailVerifiedAt) {
    const preferences =
      recipientWallet.user.notificationPreference ??
      (await getOrCreatePreferences(recipientWallet.userId));
    return {
      email: recipientWallet.user.email,
      userId: recipientWallet.userId,
      preferenceEnabled: preferences[CONTRACT_ACTION_PREFERENCE[args.actionType]],
    };
  }

  return {
    email: roleContactEmail(args.agreement, args.role),
    userId: null,
    preferenceEnabled: true,
  };
}

async function logNotification(args: {
  agreement: Agreement;
  event: ChainEvent;
  actionType: ContractActionType;
  recipientUserId: string | null;
  recipientEmail: string;
  status: "sent" | "skipped" | "failed";
  error?: string;
}) {
  await db.emailNotificationLog.create({
    data: {
      agreementId: args.agreement.id,
      chainEventId: args.event.id,
      recipientUserId: args.recipientUserId,
      contractAddress: args.agreement.contractAddress,
      chainId: args.agreement.chainId,
      eventType: args.actionType,
      txHash: args.event.txHash,
      logIndex: args.event.logIndex,
      recipientEmail: args.recipientEmail,
      status: args.status,
      source: "indexer",
      error: args.error,
      sentAt: args.status === "sent" ? new Date() : null,
    },
  });
}

export async function notifyForChainEvent(chainEventId: string): Promise<void> {
  const event = await db.chainEvent.findUnique({
    where: { id: chainEventId },
    include: { agreement: true },
  });
  if (!event || event.notificationsProcessedAt) return;

  const rule = notificationRuleForEvent(event.eventName);
  if (!rule) {
    await markNotificationsProcessed(event.id);
    return;
  }

  for (const role of recipientRoles(event.agreement, event)) {
    const recipient = await resolveRecipient({
      agreement: event.agreement,
      role,
      actionType: rule.actionType,
    });
    const recipientEmail = recipient.email ?? "unavailable";

    const duplicate = await db.emailNotificationLog.findFirst({
      where: {
        eventType: rule.actionType,
        txHash: event.txHash,
        recipientEmail,
      },
    });
    if (duplicate) continue;

    if (!recipient.email) {
      await logNotification({
        agreement: event.agreement,
        event,
        actionType: rule.actionType,
        recipientUserId: null,
        recipientEmail,
        status: "skipped",
        error: "No recipient email available",
      });
      continue;
    }

    if (!recipient.preferenceEnabled) {
      await logNotification({
        agreement: event.agreement,
        event,
        actionType: rule.actionType,
        recipientUserId: recipient.userId,
        recipientEmail,
        status: "skipped",
        error: "Recipient disabled this notification type",
      });
      continue;
    }

    const actorRole = roleForAddress(event.agreement, event.actorAddress) ?? "unknown";
    const rendered = renderContractActionEmail({
      actionLabel: CONTRACT_ACTION_LABELS[rule.actionType],
      actorRole,
      projectTitle: event.agreement.projectTitle,
      contractAddress: event.agreement.contractAddress,
      chainId: event.agreement.chainId,
      txHash: event.txHash,
      itemLabel: itemLabel(event),
      amountLabel: amountLabel(event, event.agreement),
      appUrl: `${appUrl()}/app?contractAddress=${encodeURIComponent(event.agreement.contractAddress)}&chainId=${event.agreement.chainId}`,
    });

    try {
      await sendEmail({ to: recipient.email, subject: rendered.subject, text: rendered.text });
      await logNotification({
        agreement: event.agreement,
        event,
        actionType: rule.actionType,
        recipientUserId: recipient.userId,
        recipientEmail,
        status: "sent",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Email send failed";
      await logNotification({
        agreement: event.agreement,
        event,
        actionType: rule.actionType,
        recipientUserId: recipient.userId,
        recipientEmail,
        status: "failed",
        error: message.slice(0, 500),
      });
    }
  }

  await markNotificationsProcessed(event.id);
}

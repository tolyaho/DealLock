import { Router } from "express";
import { isAddress } from "viem";
import { db } from "../db.js";
import { renderContractActionEmail } from "../email/templates.js";
import { sendEmail } from "../email/sendEmail.js";
import {
  CONTRACT_ACTION_LABELS,
  CONTRACT_ACTION_PREFERENCE,
  isContractActionType,
  type ContractActionType,
} from "../contractActions.js";
import { getOrCreatePreferences } from "../notificationPreferences.js";
import { type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { asyncRoute } from "../utils.js";

const router = Router();
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

function appUrl(): string {
  return (process.env.APP_URL ?? process.env.FRONTEND_ORIGIN ?? "http://localhost:5173").replace(/\/+$/, "");
}

function parseItemLabel(itemType: unknown, itemId: unknown): string | undefined {
  if (itemType !== "milestone" && itemType !== "adjustment") return undefined;
  const id =
    typeof itemId === "number" && Number.isInteger(itemId) && itemId >= 0
      ? String(itemId)
      : typeof itemId === "string" && /^\d+$/.test(itemId)
        ? itemId
        : null;
  if (id === null) return undefined;
  return `${itemType === "milestone" ? "Milestone" : "Adjustment"} #${id}`;
}

async function logNotification(args: {
  agreementId: string;
  recipientUserId: string | null;
  contractAddress: string;
  chainId: number;
  eventType: ContractActionType;
  txHash: string;
  recipientEmail: string;
  status: "sent" | "skipped" | "failed";
  error?: string;
}) {
  await db.emailNotificationLog.create({
    data: {
      agreementId: args.agreementId,
      recipientUserId: args.recipientUserId,
      contractAddress: args.contractAddress,
      chainId: args.chainId,
      eventType: args.eventType,
      txHash: args.txHash,
      recipientEmail: args.recipientEmail,
      status: args.status,
      error: args.error,
      sentAt: args.status === "sent" ? new Date() : null,
    },
  });
}

router.post(
  "/contract-action",
  asyncRoute(async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const {
      contractAddress,
      chainId,
      txHash,
      actorAddress,
      actionType,
      itemType,
      itemId,
    } = req.body as Record<string, unknown>;

    if (
      typeof contractAddress !== "string" ||
      typeof chainId !== "number" ||
      typeof txHash !== "string" ||
      typeof actorAddress !== "string" ||
      !isAddress(contractAddress) ||
      !isAddress(actorAddress) ||
      !TX_HASH_RE.test(txHash) ||
      !isContractActionType(actionType)
    ) {
      res.status(400).json({ error: "Invalid notification payload" });
      return;
    }

    const normActor = actorAddress.toLowerCase();
    const actorWallet = await db.wallet.findUnique({ where: { address: normActor } });
    if (!actorWallet || actorWallet.userId !== userId) {
      res.status(403).json({ error: "Actor wallet is not linked to this account" });
      return;
    }

    const agreement = await db.agreement.findUnique({
      where: {
        chainId_contractAddress: {
          chainId,
          contractAddress: contractAddress.toLowerCase(),
        },
      },
    });

    if (!agreement) {
      res.status(404).json({ error: "Agreement not found" });
      return;
    }

    const actorRole =
      normActor === agreement.clientAddress
        ? "client"
        : normActor === agreement.providerAddress
          ? "provider"
          : null;

    if (!actorRole) {
      res.status(403).json({ error: "Actor wallet is not a party to this agreement" });
      return;
    }

    const recipientRole = actorRole === "client" ? "provider" : "client";
    const recipientAddress =
      recipientRole === "client" ? agreement.clientAddress : agreement.providerAddress;
    const recipientWallet = await db.wallet.findUnique({
      where: { address: recipientAddress },
      include: { user: { include: { notificationPreference: true } } },
    });

    let recipientEmail: string | null = null;
    let recipientUserId: string | null = null;
    let preferenceEnabled = true;

    if (recipientWallet?.user.email && recipientWallet.user.emailVerifiedAt) {
      recipientEmail = recipientWallet.user.email;
      recipientUserId = recipientWallet.userId;
      const preferences =
        recipientWallet.user.notificationPreference ??
        (await getOrCreatePreferences(recipientWallet.userId));
      preferenceEnabled = preferences[CONTRACT_ACTION_PREFERENCE[actionType]];
    }

    if (!recipientEmail) {
      recipientEmail =
        recipientRole === "client" ? agreement.clientEmail : agreement.providerEmail;
    }

    if (!recipientEmail) {
      const missingRecipientKey = "unavailable";
      const duplicateMissing = await db.emailNotificationLog.findFirst({
        where: { eventType: actionType, txHash, recipientEmail: missingRecipientKey },
      });
      if (!duplicateMissing) {
        await logNotification({
          agreementId: agreement.id,
          recipientUserId: null,
          contractAddress: agreement.contractAddress,
          chainId,
          eventType: actionType,
          txHash,
          recipientEmail: missingRecipientKey,
          status: "skipped",
          error: "No recipient email available",
        });
      }
      res.json({ status: "skipped", reason: "no_recipient_email" });
      return;
    }

    const duplicate = await db.emailNotificationLog.findFirst({
      where: { eventType: actionType, txHash, recipientEmail },
    });

    if (duplicate) {
      res.json({ status: "skipped", reason: "duplicate" });
      return;
    }

    if (!preferenceEnabled) {
      await logNotification({
        agreementId: agreement.id,
        recipientUserId,
        contractAddress: agreement.contractAddress,
        chainId,
        eventType: actionType,
        txHash,
        recipientEmail,
        status: "skipped",
        error: "Recipient disabled this notification type",
      });
      res.json({ status: "skipped", reason: "preference_disabled" });
      return;
    }

    const rendered = renderContractActionEmail({
      actionLabel: CONTRACT_ACTION_LABELS[actionType],
      actorRole,
      projectTitle: agreement.projectTitle,
      contractAddress: agreement.contractAddress,
      chainId,
      txHash,
      itemLabel: parseItemLabel(itemType, itemId),
      appUrl: `${appUrl()}/app?contractAddress=${encodeURIComponent(agreement.contractAddress)}&chainId=${chainId}`,
    });

    try {
      await sendEmail({
        to: recipientEmail,
        subject: rendered.subject,
        text: rendered.text,
      });
      await logNotification({
        agreementId: agreement.id,
        recipientUserId,
        contractAddress: agreement.contractAddress,
        chainId,
        eventType: actionType,
        txHash,
        recipientEmail,
        status: "sent",
      });
      res.json({ status: "sent" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Email send failed";
      await logNotification({
        agreementId: agreement.id,
        recipientUserId,
        contractAddress: agreement.contractAddress,
        chainId,
        eventType: actionType,
        txHash,
        recipientEmail,
        status: "failed",
        error: message.slice(0, 500),
      });
      res.json({ status: "failed" });
    }
  }),
);

export default router;

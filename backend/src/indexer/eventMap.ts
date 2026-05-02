import type { ContractActionType } from "../contractActions.js";

export type PartyRole = "client" | "provider";
export type RecipientMode = PartyRole | "counterparty" | "both" | "none";

export interface EventNotificationRule {
  actionType: ContractActionType;
  actorRole: PartyRole | "proposer" | null;
  recipients: RecipientMode;
}

const RULES: Record<string, EventNotificationRule | undefined> = {
  AgreementAccepted: {
    actionType: "agreement_accepted",
    actorRole: "provider",
    recipients: "client",
  },
  AgreementFunded: {
    actionType: "agreement_funded",
    actorRole: "client",
    recipients: "provider",
  },
  MilestoneSubmitted: {
    actionType: "milestone_submitted",
    actorRole: "provider",
    recipients: "client",
  },
  MilestoneReleased: {
    actionType: "milestone_released",
    actorRole: "client",
    recipients: "provider",
  },
  MilestoneRefunded: {
    actionType: "milestone_refunded",
    actorRole: "client",
    recipients: "provider",
  },
  AdjustmentRequested: {
    actionType: "adjustment_requested",
    actorRole: "client",
    recipients: "provider",
  },
  AdjustmentAccepted: {
    actionType: "adjustment_accepted",
    actorRole: "provider",
    recipients: "client",
  },
  AdjustmentFunded: {
    actionType: "adjustment_funded",
    actorRole: "client",
    recipients: "provider",
  },
  AdjustmentSubmitted: {
    actionType: "adjustment_submitted",
    actorRole: "provider",
    recipients: "client",
  },
  AdjustmentReleased: {
    actionType: "adjustment_released",
    actorRole: "client",
    recipients: "provider",
  },
  AdjustmentRefunded: {
    actionType: "adjustment_refunded",
    actorRole: "client",
    recipients: "provider",
  },
  MilestoneDisputed: {
    actionType: "dispute_opened",
    actorRole: "client",
    recipients: "provider",
  },
  AdjustmentDisputed: {
    actionType: "dispute_opened",
    actorRole: "client",
    recipients: "provider",
  },
  MilestoneAutoReleased: {
    actionType: "review_claimed",
    actorRole: "provider",
    recipients: "client",
  },
  AdjustmentAutoReleased: {
    actionType: "review_claimed",
    actorRole: "provider",
    recipients: "client",
  },
  MilestoneSettlementProposed: {
    actionType: "settlement_proposed",
    actorRole: "proposer",
    recipients: "counterparty",
  },
  AdjustmentSettlementProposed: {
    actionType: "settlement_proposed",
    actorRole: "proposer",
    recipients: "counterparty",
  },
  MilestoneSettlementAccepted: {
    actionType: "settlement_accepted",
    actorRole: null,
    recipients: "both",
  },
  AdjustmentSettlementAccepted: {
    actionType: "settlement_accepted",
    actorRole: null,
    recipients: "both",
  },
  MilestoneDeadlineExtensionRequested: {
    actionType: "deadline_extension_requested",
    actorRole: "provider",
    recipients: "client",
  },
  MilestoneDeadlineExtensionAccepted: {
    actionType: "deadline_extension_accepted",
    actorRole: "client",
    recipients: "provider",
  },
  MilestoneDeadlineExtensionRejected: {
    actionType: "deadline_extension_rejected",
    actorRole: "client",
    recipients: "provider",
  },
  MilestoneDeadlineExtensionCancelled: {
    actionType: "deadline_extension_cancelled",
    actorRole: "provider",
    recipients: "client",
  },
  AdjustmentDeadlineExtensionRequested: {
    actionType: "deadline_extension_requested",
    actorRole: "provider",
    recipients: "client",
  },
  AdjustmentDeadlineExtensionAccepted: {
    actionType: "deadline_extension_accepted",
    actorRole: "client",
    recipients: "provider",
  },
  AdjustmentDeadlineExtensionRejected: {
    actionType: "deadline_extension_rejected",
    actorRole: "client",
    recipients: "provider",
  },
  AdjustmentDeadlineExtensionCancelled: {
    actionType: "deadline_extension_cancelled",
    actorRole: "provider",
    recipients: "client",
  },
  MilestoneRevisionRequested: {
    actionType: "revision_requested",
    actorRole: "client",
    recipients: "provider",
  },
  MilestoneRevisionDeadlineRequested: {
    actionType: "revision_deadline_requested",
    actorRole: "provider",
    recipients: "client",
  },
  MilestoneRevisionDeadlineUpdated: {
    actionType: "revision_deadline_updated",
    actorRole: "client",
    recipients: "provider",
  },
  MilestoneRevisionAccepted: {
    actionType: "revision_accepted",
    actorRole: "provider",
    recipients: "client",
  },
  MilestoneRevisionRejected: {
    actionType: "revision_rejected",
    actorRole: "provider",
    recipients: "client",
  },
  MilestoneRevisionEscalated: {
    actionType: "revision_escalated",
    actorRole: "client",
    recipients: "provider",
  },
};

export function notificationRuleForEvent(eventName: string): EventNotificationRule | null {
  return RULES[eventName] ?? null;
}

export function humanEventLabel(eventName: string): string {
  return eventName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());
}

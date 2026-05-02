import { apiFetch } from "./client.ts";

export type ContractActionType =
  | "agreement_accepted"
  | "agreement_funded"
  | "milestone_submitted"
  | "milestone_released"
  | "milestone_refunded"
  | "adjustment_requested"
  | "adjustment_accepted"
  | "adjustment_funded"
  | "adjustment_submitted"
  | "adjustment_released"
  | "adjustment_refunded"
  | "dispute_opened"
  | "settlement_proposed"
  | "settlement_accepted"
  | "review_claimed"
  | "deadline_extension_requested"
  | "deadline_extension_accepted"
  | "deadline_extension_rejected"
  | "deadline_extension_cancelled"
  | "revision_requested"
  | "revision_deadline_requested"
  | "revision_deadline_updated"
  | "revision_accepted"
  | "revision_rejected"
  | "revision_escalated";

export interface ContractActionNotificationPayload {
  contractAddress: string;
  chainId: number;
  txHash: string;
  actorAddress: string;
  actionType: ContractActionType;
  contractVersion?: number;
  itemType?: "milestone" | "adjustment";
  itemId?: number;
}

export interface ContractActionNotificationResult {
  status: "sent" | "skipped" | "failed";
  reason?: string;
}

export async function notifyContractAction(
  payload: ContractActionNotificationPayload,
): Promise<ContractActionNotificationResult> {
  return apiFetch("/notifications/contract-action", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

import { type Address } from "viem";

export const AGREEMENT_STATES = [
  "Proposed",
  "Accepted",
  "Funded",
  "Completed",
  "Cancelled",
] as const;

export const MILESTONE_STATES = [
  "Pending",
  "Submitted",
  "Released",
  "Refunded",
  "Disputed",
  "Settled",
  "RevisionRequested",
] as const;

export const ADJUSTMENT_STATES = {
  0: "Proposed",
  1: "Accepted",
  2: "Funded",
  3: "Submitted",
  4: "Released",
  5: "Refunded",
  6: "Cancelled",
  7: "Disputed",
  8: "Settled",
} as const;

export type AgreementStateLabel = (typeof AGREEMENT_STATES)[number];
export type MilestoneStateLabel = (typeof MILESTONE_STATES)[number];
export type AdjustmentStateLabel = (typeof ADJUSTMENT_STATES)[keyof typeof ADJUSTMENT_STATES];

export interface MilestoneData {
  id: number;
  description: string;
  amount: bigint;
  deadline: bigint;
  proof: string;
  submittedAt: bigint;
  state: number;
}

export interface AdjustmentData {
  id: number;
  targetMilestoneId: number;
  description: string;
  amount: bigint;
  deadline: bigint;
  proof: string;
  submittedAt: bigint;
  state: number;
}

export interface DisputeData {
  exists: boolean;
  openedBy: string;
  reason: string;
  openedAt: bigint;
}

export interface SettlementProposalData {
  exists: boolean;
  proposer: string;
  providerAmount: bigint;
  note: string;
  proposedAt: bigint;
}

export interface DeadlineExtensionRequestData {
  active: boolean;
  requester: string;
  requestedAt: bigint;
  proposedDeadline: bigint;
  reason: string;
}

export interface RevisionInfo {
  exists: boolean;
  requestedBy: string;
  reason: string;
  requestedAt: bigint;
  revisionDeadline: bigint;
  revisionRound: bigint;
  providerDeadlineRequestExists: boolean;
  providerRequestedDeadline: bigint;
  providerDeadlineReason: string;
  providerDeadlineRequestedAt: bigint;
}

export type Role = "client" | "provider" | "other";

export type AgreementSidebarFilter = "all" | "client" | "provider" | "other";

export function formatEth(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  return eth.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatTimestamp(ts: bigint): string {
  if (ts === 0n) return "—";
  return new Date(Number(ts) * 1000).toLocaleString();
}

export function agreementLabel(state: number): AgreementStateLabel {
  return AGREEMENT_STATES[state] ?? ("Unknown" as AgreementStateLabel);
}

export function milestoneLabel(state: number): MilestoneStateLabel {
  return MILESTONE_STATES[state] ?? ("Unknown" as MilestoneStateLabel);
}

export function adjustmentLabel(state: number): AdjustmentStateLabel {
  return (
    (ADJUSTMENT_STATES as Record<number, string>)[state] ?? "Unknown"
  ) as AdjustmentStateLabel;
}

export function deriveRole(
  account: Address | string | undefined,
  clientAddr: Address | string | undefined,
  providerAddr: Address | string | undefined,
): Role {
  if (!account) return "other";
  const a = String(account).toLowerCase();
  if (clientAddr && a === String(clientAddr).toLowerCase()) return "client";
  if (providerAddr && a === String(providerAddr).toLowerCase()) return "provider";
  return "other";
}

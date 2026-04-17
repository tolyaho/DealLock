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
] as const;

export type AgreementStateLabel = (typeof AGREEMENT_STATES)[number];
export type MilestoneStateLabel = (typeof MILESTONE_STATES)[number];

export interface MilestoneData {
  id: number;
  description: string;
  amount: bigint;
  deadline: bigint;
  /** On-chain proof string from the contract; UI labels this “submission / delivery evidence”. */
  proof: string;
  submittedAt: bigint;
  state: number;
}

export type Role = "client" | "provider" | "other";

/** Sidebar filter for browser-local agreement history (not global). */
export type AgreementSidebarFilter = "all" | "client" | "provider" | "other";

/* ---- formatting helpers ---- */

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

/** Whether the connected wallet is client, provider, or not a party — purely from addresses. */
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

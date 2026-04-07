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

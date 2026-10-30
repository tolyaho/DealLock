/*
 * safeguardsData — the "what if something goes wrong?" content.
 *
 * Every card describes a REAL exit path enforced by the escrow contracts
 * (contracts/DealLockV4.sol + DealLockMultiAssetV2.sol), written in plain language
 * and kept deliberately honest:
 *   • there is NO default review period — it's set per agreement (1h–14d bounds),
 *     so copy says "review window", never a fixed number;
 *   • disputes resolve ONLY by mutual settlement — no arbiter, no automatic winner,
 *     and funds stay locked until both sides accept a split;
 *   • revisions + deadline-extensions exist only on the latest contract (V6).
 * If the contracts change, edit these strings — don't add guarantees they don't make.
 */

export type SafeguardIconKey = "deadline" | "silence" | "revise" | "dispute" | "lock" | "fee";

export interface Safeguard {
  icon: SafeguardIconKey;
  title: string;
  copy: string;
}

export const SAFEGUARDS_EYEBROW = "Safeguards";
export const SAFEGUARDS_TITLE = "What if something goes wrong?";
export const SAFEGUARDS_SUB =
  "The happy path is only half the story. Every way out of a deal is a contract rule — not a support ticket, and never DealLock's discretion.";

export const SAFEGUARDS: Safeguard[] = [
  {
    icon: "deadline",
    title: "A deadline is missed",
    copy: "If a milestone's deadline passes with nothing delivered, the client can refund that milestone from escrow after a short grace window. Work that's already submitted can't be clawed back — only approved, disputed, or claimed.",
  },
  {
    icon: "silence",
    title: "The client goes quiet",
    copy: "After work is submitted, the client has a review window to approve or dispute it. If they do nothing before it closes, the provider can claim the payment themselves — silence can't strand the funds.",
  },
  {
    icon: "revise",
    title: "Changes are needed",
    copy: "On the latest contract, the client can request a revision instead of approving. The provider revises and resubmits while funds stay locked; an ignored revision can be escalated to a dispute.",
  },
  {
    icon: "dispute",
    title: "The two sides disagree",
    copy: "Either side can dispute submitted work within the review window. Disputed funds freeze and move only when both parties accept a split — there is no automatic winner and no outside arbiter, so releasing them takes agreement.",
  },
  {
    icon: "lock",
    title: "No quiet withdrawals",
    copy: "Neither party can pull locked funds at will. Money leaves escrow only through approval, a post-review claim, an expired-milestone refund, or a settlement both sides accept.",
  },
  {
    icon: "fee",
    title: "No platform fee",
    copy: "DealLock takes nothing. On release the full milestone amount goes to the provider, and a settlement splits the exact amount between the two sides with no cut.",
  },
];

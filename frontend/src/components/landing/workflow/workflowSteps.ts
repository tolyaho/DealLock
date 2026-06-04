/*
 * Single source of truth for the workflow scrollytelling section. Mirrors
 * docs/deallock_workflow_agent_pack/workflow_steps.json, typed and enriched with
 * the derived fields the overlay needs (progressIndex) so the JSON stays a clean
 * authoring artifact and the component never parses it at runtime.
 *
 * Six steps narrate the escrow lifecycle: client actions render on the LEFT,
 * provider/system actions on the RIGHT (see `side`). The central contract card
 * reads `cardStatus` (status chip), `activeRow` (which overlay row glows) and
 * `progressIndex` (how far the Created→Released timeline has filled).
 */

export type WorkflowSide = "left" | "right";
export type WorkflowRole = "client" | "provider" | "escrow";

/** Status chip text shown on the contract overlay for each step. */
export type CardStatus =
  | "Draft"
  | "Accepted"
  | "Funded"
  | "Submitted"
  | "Approved"
  | "Released";

/** Which overlay region receives the soft purple "active" highlight. */
export type HighlightRow =
  | "agreement"
  | "provider"
  | "amount"
  | "submission"
  | "approval"
  | "release";

/** Icon keys resolved in workflowIcons.tsx — monochrome stroke glyphs. */
export type WorkflowIconKey =
  | "create"
  | "accept"
  | "lock"
  | "submit"
  | "approve"
  | "release";

export interface WorkflowStep {
  id: string;
  number: string;
  role: WorkflowRole;
  side: WorkflowSide;
  icon: WorkflowIconKey;
  title: string;
  body: string;
  cardStatus: CardStatus;
  activeRow: HighlightRow;
  typewriter: string;
  /* Index into PROGRESS_LABELS that this step has reached (0–4). Steps 1 & 2 both */
  /* sit at "Created" — the escrow timeline only advances once funds move.          */
  progressIndex: number;
  /* Desktop pacing weight — how much of the pinned scroll track this step holds    */
  /* before the next one takes over, relative to the others (default 1 = even). The  */
  /* raw bands are mathematically even, but the fund-lock step (the pivotal "money   */
  /* is now locked" beat) reads as too quick a hand-off into "Provider submits", so   */
  /* it gets extra dwell. Only affects WHEN activeStep flips on desktop, not layout. */
  scrollWeight?: number;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "create",
    number: "01",
    role: "client",
    side: "left",
    icon: "create",
    title: "Client creates agreement",
    body: "The client defines the project, milestone, amount, deadline, and release condition.",
    cardStatus: "Draft",
    activeRow: "agreement",
    typewriter: "Client defines the job and signs the first agreement state.",
    progressIndex: 0,
  },
  {
    id: "accept",
    number: "02",
    role: "provider",
    side: "right",
    icon: "accept",
    title: "Provider accepts terms",
    body: "The provider reviews the milestone and accepts the locked terms before work begins.",
    cardStatus: "Accepted",
    activeRow: "provider",
    typewriter: "Provider accepts exactly what must be delivered.",
    progressIndex: 0,
  },
  {
    id: "fund",
    number: "03",
    role: "client",
    side: "left",
    icon: "lock",
    title: "Client locks ETH",
    body: "Funds move into smart-contract escrow. The provider can see the money is actually locked.",
    cardStatus: "Funded",
    activeRow: "amount",
    typewriter: "Client locks 2.5 ETH into escrow.",
    progressIndex: 1,
    /* Hold the "funds are now locked" beat ~30% longer before handing off to the    */
    /* provider-submits step, so box 3 → box 4 no longer reads as the quickest        */
    /* transition. Tune this one number to dial the dwell.                            */
    scrollWeight: 1.3,
  },
  {
    id: "submit",
    number: "04",
    role: "provider",
    side: "right",
    icon: "submit",
    title: "Provider submits work",
    body: "The provider delivers the milestone and submits proof for client review.",
    cardStatus: "Submitted",
    activeRow: "submission",
    typewriter: "Provider submits the completed milestone for review.",
    progressIndex: 2,
  },
  {
    id: "approve",
    number: "05",
    role: "client",
    side: "left",
    icon: "approve",
    title: "Client approves",
    body: "The client reviews the delivery and approves the milestone when the work matches the terms.",
    cardStatus: "Approved",
    activeRow: "approval",
    typewriter: "Client approves the submitted work.",
    progressIndex: 3,
  },
  {
    id: "release",
    number: "06",
    role: "escrow",
    side: "right",
    icon: "release",
    title: "Funds release",
    body: "Once approved, funds are released from escrow to the provider automatically.",
    cardStatus: "Released",
    activeRow: "release",
    typewriter: "DealLock releases funds to the provider.",
    progressIndex: 4,
  },
];

/** The escrow timeline rendered on the card (5 nodes, 6 steps — see progressIndex). */
export const PROGRESS_LABELS = [
  "Created",
  "Funded",
  "Submitted",
  "Approved",
  "Released",
] as const;

/** Example contract shown on the overlay — illustrative, not live data. */
export const CONTRACT = {
  network: "Ethereum",
  client: "0xA1b2…8C3d",
  provider: "0xF9e8…7B6a",
  amount: "2.5 ETH",
  usd: "$6,325.40",
  milestone: "Website Development",
  milestoneCount: "Milestone 1 of 3",
  address: "0x7c3B…9D2a",
} as const;

export const STEP_COUNT = WORKFLOW_STEPS.length;

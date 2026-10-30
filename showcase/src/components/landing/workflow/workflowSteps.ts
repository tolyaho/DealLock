/*
 * Single source of truth for the workflow scrollytelling section — five steps that
 * narrate the escrow lifecycle so a first-time visitor builds the mental model in a
 * few seconds:
 *
 *   01 Client creates terms → 02 Client locks funds → 03 Provider submits work →
 *   04 Client approves → 05 Smart contract releases payment.
 *
 * The central contract card is the "source of truth": every step drives its status
 * chip (`cardStatus`/`statusTone`), the highlighted region (`activeRow`), the
 * Created→Released escrow rail (`progressIndex`, now 1:1 with the step index), and
 * the in-card CURRENT STEP block (`caption`) that answers "what happened / where is
 * the money / who acts next".
 *
 * The two lanes are role-split so each side reads as one party: the CLIENT lane on
 * the LEFT (create, fund, approve) and the PROVIDER lane on the RIGHT (submit, plus
 * the contract's payout to the provider — release). This mirrors the contract card,
 * whose parties read Client → Escrow → Provider, so money flows left → right.
 */

export type WorkflowSide = "left" | "right";
export type WorkflowRole = "client" | "provider" | "contract";

/** Status chip text shown on the contract overlay for each step. */
export type CardStatus =
  | "Created"
  | "Funds locked"
  | "Awaiting approval"
  | "Approved"
  | "Released";

/** Status chip colour family: purple while in-flight, green once settled. */
export type StatusTone = "progress" | "done";

/** Which overlay region receives the soft purple "active" highlight. */
export type HighlightRow = "parties" | "amount" | "progress";

/** Icon keys resolved in workflowIcons.tsx — monochrome stroke glyphs. */
export type WorkflowIconKey =
  | "create"
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
  /** Status chip text on the central card for this step. */
  cardStatus: CardStatus;
  /** Status chip colour family. */
  statusTone: StatusTone;
  /** Which card region glows for this step (feed-forward: step → affected area). */
  activeRow: HighlightRow;
  /** The in-card CURRENT STEP sentence — the plain-language "what's happening now". */
  caption: string;
  /* Index into PROGRESS_LABELS this step has reached (0–4), 1:1 with the step. */
  progressIndex: number;
  /* Desktop pacing weight — how much of the pinned scroll track this step holds      */
  /* before the next one takes over, relative to the others (default 1 = even). The   */
  /* fund-lock step (the pivotal "money is now locked" beat) gets extra dwell so it    */
  /* doesn't hand off into "Provider submits" too quickly. Only affects WHEN the       */
  /* active step flips on desktop, not layout.                                         */
  scrollWeight?: number;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "create",
    number: "01",
    role: "client",
    side: "left",
    icon: "create",
    title: "Agreement created",
    body: "Client sets the milestone, amount and release terms.",
    cardStatus: "Created",
    statusTone: "progress",
    activeRow: "parties",
    caption: "Client created the agreement and set the milestone terms.",
    progressIndex: 0,
  },
  {
    id: "fund",
    number: "02",
    role: "client",
    side: "left",
    icon: "lock",
    title: "Funds locked",
    body: "Client deposits 2.5 ETH into the contract — held on-chain.",
    cardStatus: "Funds locked",
    statusTone: "progress",
    activeRow: "amount",
    caption: "2.5 ETH locked into the escrow contract — held on-chain.",
    progressIndex: 1,
    /* Hold the "funds are now locked" beat ~30% longer before handing off to the     */
    /* provider-submits step. Tune this one number to dial the dwell.                 */
    scrollWeight: 1.3,
  },
  {
    id: "submit",
    number: "03",
    role: "provider",
    side: "right",
    icon: "submit",
    title: "Work submitted",
    body: "Provider delivers the milestone and submits proof. Funds stay locked.",
    cardStatus: "Awaiting approval",
    statusTone: "progress",
    activeRow: "progress",
    caption: "Provider submitted the work — awaiting client approval.",
    progressIndex: 2,
  },
  {
    id: "approve",
    number: "04",
    role: "client",
    side: "left",
    icon: "approve",
    title: "Client approves",
    body: "Client reviews the delivery and approves the release.",
    cardStatus: "Approved",
    statusTone: "done",
    activeRow: "progress",
    caption: "Client approved the milestone delivery.",
    progressIndex: 3,
  },
  {
    id: "release",
    number: "05",
    role: "contract",
    side: "right",
    icon: "release",
    title: "Funds released",
    body: "The contract sends 2.5 ETH to the provider automatically.",
    cardStatus: "Released",
    statusTone: "done",
    activeRow: "amount",
    caption: "2.5 ETH released to the provider — agreement settled.",
    progressIndex: 4,
  },
];

/** The escrow timeline rendered on the card (5 nodes, 1:1 with the 5 steps). */
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

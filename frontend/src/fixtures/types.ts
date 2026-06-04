/*
 * Typed shapes for the dashboard's mock data. These intentionally mirror the
 * real agreement/milestone domain (statuses, parties, payment assets, indexed
 * activity events) so that wiring read paths to the backend later is a matter
 * of swapping the fixture source — not reshaping the UI.
 *
 * Payment assets are deliberately limited to the registry-backed set
 * (ETH + configured USDC); there is no arbitrary-token concept here, matching
 * the product non-goals in the handoff.
 */

export type Role = "client" | "provider";

export type AssetSymbol = "ETH" | "USDC";

/** Agreement-level lifecycle. Mirrors the states called out in the brief. */
export type AgreementStatus =
  | "draft"
  | "active"
  | "in_review"
  | "approved"
  | "released"
  | "revision_requested"
  | "completed";

/** Per-milestone lifecycle (a superset used inside an active agreement). */
export type MilestoneStatus =
  | "pending"
  | "in_progress"
  | "in_review"
  | "approved"
  | "released"
  | "revision_requested"
  | "completed";

export interface Party {
  id: string;
  name: string;
  kind: "individual" | "company";
  /** 2-letter monogram for the avatar medallion. */
  initials: string;
}

export interface Money {
  /** Major-unit amount (e.g. 12500 = 12,500.00). Display-only; not for math. */
  amount: number;
  asset: AssetSymbol;
}

export interface Deliverable {
  id: string;
  name: string;
  /** Human size label, e.g. "4.2 MB". */
  size: string;
  kind: "doc" | "image" | "archive" | "link" | "code";
}

export interface Comment {
  id: string;
  author: string;
  role: Role;
  text: string;
  /** Relative label for mock display, e.g. "2 days ago". */
  when: string;
}

export interface Milestone {
  id: string;
  order: number;
  title: string;
  description: string;
  value: Money;
  status: MilestoneStatus;
  /** Absolute date label, e.g. "May 24, 2026". */
  dueDate: string;
  deliverables?: Deliverable[];
  submissionNotes?: string;
  checklist?: { id: string; label: string; done: boolean }[];
  comments?: Comment[];
}

export interface FileRef {
  id: string;
  name: string;
  size: string;
}

export type ActivityKind =
  | "created"
  | "funded"
  | "submitted"
  | "approved"
  | "released"
  | "revision_requested"
  | "message"
  | "completed";

export interface ActivityEvent {
  id: string;
  agreementId: string;
  agreementTitle: string;
  kind: ActivityKind;
  /** Short human label, e.g. "Milestone funded". */
  label: string;
  /** Who/what the row is about. */
  actor: string;
  when: string;
  value?: Money;
}

export interface Agreement {
  id: string;
  title: string;
  summary: string;
  status: AgreementStatus;
  client: Party;
  provider: Party;
  /** Total currently held in escrow across funded milestones. */
  locked: Money;
  /** Total already released to the provider. */
  released: Money;
  milestones: Milestone[];
  /** Id of the milestone currently in focus (active/under review). */
  currentMilestoneId: string;
  createdAt: string;
  files?: FileRef[];
  terms?: string[];
}

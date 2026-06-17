/*
 * Create-flow draft model — pure data + validation, no React. Mirrors the
 * agreement/milestone domain (see fixtures/types.ts) so this draft can later be
 * mapped to a `POST /agreements` body without reshaping the wizard. State lives
 * locally in CreatePage for now; nothing here touches the network or chain.
 *
 * Product rule: the CLIENT authors + funds the escrow; the PROVIDER only drafts
 * a proposal the client accepts + funds. The wizard fields are identical for
 * both roles — only the copy and the final action differ (resolved in the page).
 */
import type { AssetSymbol } from "../../../fixtures/types";

export interface DraftMilestone {
  id: string;
  name: string;
  description: string;
  /** Raw input string (major units). Parsed via milestoneAmount for totals. */
  amount: string;
  /** yyyy-mm-dd from <input type="date">; optional. */
  dueDate: string;
}

export interface CreateDraft {
  /** Counterparty email or wallet address. */
  counterparty: string;
  title: string;
  description: string;
  /** Optional overall deadline (yyyy-mm-dd). */
  deadline: string;
  milestones: DraftMilestone[];
  asset: AssetSymbol;
  /** Only Sepolia for now (testnet); kept in the model for later networks. */
  network: "sepolia";
}

export type StepId = "counterparty" | "basics" | "milestones" | "payment" | "review";

export const STEP_ORDER: StepId[] = ["counterparty", "basics", "milestones", "payment", "review"];

export const STEP_LABEL: Record<StepId, string> = {
  counterparty: "Counterparty",
  basics: "Project basics",
  milestones: "Milestones",
  payment: "Payment",
  review: "Review",
};

let _seq = 0;
export function newMilestone(): DraftMilestone {
  _seq += 1;
  return { id: `ms-draft-${Date.now()}-${_seq}`, name: "", description: "", amount: "", dueDate: "" };
}

export function initialDraft(): CreateDraft {
  return {
    counterparty: "",
    title: "",
    description: "",
    deadline: "",
    milestones: [newMilestone()],
    asset: "USDC",
    network: "sepolia",
  };
}

/** A milestone's parsed amount (0 when blank/invalid/≤0). Display-only math. */
export function milestoneAmount(m: DraftMilestone): number {
  const n = Number.parseFloat(m.amount);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function draftTotal(d: CreateDraft): number {
  return d.milestones.reduce((sum, m) => sum + milestoneAmount(m), 0);
}

/** A milestone counts as "complete" once it has a name and a positive amount. */
export function milestoneValid(m: DraftMilestone): boolean {
  return m.name.trim().length > 0 && milestoneAmount(m) > 0;
}

export type StepErrors = Record<string, string>;

/** Field error keys are namespaced; milestone fields use `ms-<id>-name|amount`. */
export function validateStep(step: StepId, d: CreateDraft): StepErrors {
  const e: StepErrors = {};
  switch (step) {
    case "counterparty":
      if (!d.counterparty.trim()) e.counterparty = "Enter an email or wallet address.";
      break;
    case "basics":
      if (!d.title.trim()) e.title = "Give this a clear title.";
      break;
    case "milestones":
      d.milestones.forEach((m) => {
        if (!m.name.trim()) e[`ms-${m.id}-name`] = "Name this milestone.";
        if (milestoneAmount(m) <= 0) e[`ms-${m.id}-amount`] = "Enter an amount greater than 0.";
      });
      break;
    case "payment":
      if (draftTotal(d) <= 0) e.total = "Add milestone amounts so the total is greater than 0.";
      break;
    case "review":
      break;
  }
  return e;
}

/** The first step (in flow order) that has a validation error, or null if valid. */
export function firstInvalidStep(d: CreateDraft): StepId | null {
  for (const step of STEP_ORDER) {
    if (Object.keys(validateStep(step, d)).length > 0) return step;
  }
  return null;
}

/** Format a yyyy-mm-dd date input value as a calm absolute label (or em dash). */
export function formatDateLabel(value: string): string {
  if (!value) return "—";
  const [y, m, day] = value.split("-").map(Number);
  if (!y || !m || !day) return value;
  const d = new Date(y, m - 1, day);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

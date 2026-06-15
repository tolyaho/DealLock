/*
 * Typed mock fixtures (Phase A). These mirror the real agreement/milestone
 * domain so the UI is built against realistic shapes; a later phase can swap
 * this module for `GET /agreements` read paths without touching components.
 *
 * "Jordan Lee" is the signed-in user and is a party to every agreement — as
 * client in some, provider in others — which is what makes the workspace
 * toggle meaningful (one identity, two modes).
 */
import type {
  ActivityEvent,
  Agreement,
  AgreementStatus,
  MilestoneStatus,
  Party,
  Role,
} from "./types";

export const ME = "Jordan";

// ---- parties ---------------------------------------------------------------
const acme: Party = { id: "p-acme", name: "Acme Corporation", kind: "company", initials: "AC" };
const summit: Party = { id: "p-summit", name: "Summit Ventures", kind: "company", initials: "SV" };
const northridge: Party = { id: "p-north", name: "NorthRidge LLC", kind: "company", initials: "NR" };
const harbor: Party = { id: "p-harbor", name: "Harbor & Co.", kind: "company", initials: "HC" };
const meliora: Party = { id: "p-mel", name: "Meliora Studio", kind: "company", initials: "MS" };
const jordan: Party = { id: "p-jordan", name: "Jordan Lee", kind: "individual", initials: "JL" };
const studio: Party = { id: "p-studio", name: "Brightwork Studio", kind: "company", initials: "BW" };

export const STATUS_LABEL: Record<AgreementStatus, string> = {
  draft: "Draft",
  active: "Active",
  in_review: "In review",
  approved: "Approved",
  released: "Released",
  revision_requested: "Revision requested",
  completed: "Completed",
};

export const MILESTONE_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In progress",
  in_review: "In review",
  approved: "Approved",
  released: "Released",
  revision_requested: "Revision requested",
  completed: "Completed",
};

const AGREEMENTS_SEED: Agreement[] = [
  {
    id: "agr-001",
    title: "Master Services Agreement",
    summary:
      "Full website redesign with responsive layout, CMS integration, and SEO optimization. Payments are released per milestone on client approval.",
    status: "in_review",
    client: jordan,
    provider: summit,
    locked: { amount: 48750, asset: "USDC" },
    released: { amount: 12500, asset: "USDC" },
    createdAt: "Apr 12, 2026",
    currentMilestoneId: "ms-001-2",
    terms: [
      "Funds release per milestone on client approval",
      "7-day review window per submission",
      "Two revision rounds included per milestone",
      "Refund grace period before funding is final",
    ],
    files: [
      { id: "f1", name: "Master Services Agreement.pdf", size: "284 KB" },
      { id: "f2", name: "Statement of Work.pdf", size: "192 KB" },
      { id: "f3", name: "Project Plan.pdf", size: "1.1 MB" },
      { id: "f4", name: "Pricing Appendix.pdf", size: "88 KB" },
    ],
    milestones: [
      {
        id: "ms-001-1",
        order: 1,
        title: "Discovery & Research",
        description: "Stakeholder interviews, audit, and content inventory.",
        value: { amount: 12500, asset: "USDC" },
        status: "released",
        dueDate: "Apr 24, 2026",
      },
      {
        id: "ms-001-2",
        order: 2,
        title: "Design & UX Deliverables",
        description: "High-fidelity design system and key page mockups for sign-off.",
        value: { amount: 12500, asset: "USDC" },
        status: "in_review",
        dueDate: "May 24, 2026",
        submissionNotes:
          "Submitting the full design system plus high-fidelity mockups for the home, pricing, and dashboard pages. Components follow the agreed spacing and type scale. Prototype link is included for the primary navigation flow.",
        deliverables: [
          { id: "d1", name: "High-fidelity mockups.fig", size: "24.6 MB", kind: "image" },
          { id: "d2", name: "Design system v2.pdf", size: "4.2 MB", kind: "doc" },
          { id: "d3", name: "Prototype walkthrough.mp4", size: "58 MB", kind: "archive" },
          { id: "d4", name: "Interactive prototype", size: "Figma link", kind: "link" },
        ],
        checklist: [
          { id: "c1", label: "All key pages designed to spec", done: true },
          { id: "c2", label: "Design system documented", done: true },
          { id: "c3", label: "Responsive breakpoints included", done: true },
          { id: "c4", label: "Accessibility contrast checked", done: false },
        ],
        comments: [
          { id: "cm1", author: "Jordan Lee", role: "client", text: "Strong direction overall. Can we tighten the spacing on the pricing cards before final sign-off?", when: "2 days ago" },
          { id: "cm2", author: "Summit Ventures", role: "provider", text: "Adjusted the pricing card spacing and refreshed the prototype link. Ready for review.", when: "1 day ago" },
        ],
      },
      {
        id: "ms-001-3",
        order: 3,
        title: "Development & Integration",
        description: "Build the approved designs and integrate the headless CMS.",
        value: { amount: 13750, asset: "USDC" },
        status: "pending",
        dueDate: "Jun 28, 2026",
      },
      {
        id: "ms-001-4",
        order: 4,
        title: "Launch & Handover",
        description: "Production launch, documentation, and team handover.",
        value: { amount: 10000, asset: "USDC" },
        status: "pending",
        dueDate: "Jul 19, 2026",
      },
    ],
  },
  {
    id: "agr-002",
    title: "Website Redesign Project",
    summary: "Modern marketing site with CMS integration and a refreshed brand system.",
    status: "active",
    client: jordan,
    provider: meliora,
    locked: { amount: 12500, asset: "USDC" },
    released: { amount: 6250, asset: "USDC" },
    createdAt: "Mar 30, 2026",
    currentMilestoneId: "ms-002-3",
    terms: [
      "Funds release per milestone on client approval",
      "Two revision rounds included per milestone",
    ],
    milestones: [
      { id: "ms-002-1", order: 1, title: "Discovery", description: "Define scope and content.", value: { amount: 3125, asset: "USDC" }, status: "released", dueDate: "Apr 6, 2026" },
      { id: "ms-002-2", order: 2, title: "Design", description: "Brand system and page designs.", value: { amount: 3125, asset: "USDC" }, status: "released", dueDate: "Apr 27, 2026" },
      { id: "ms-002-3", order: 3, title: "Development", description: "Build and integrate the CMS.", value: { amount: 3125, asset: "USDC" }, status: "in_progress", dueDate: "May 25, 2026" },
      { id: "ms-002-4", order: 4, title: "Final delivery", description: "Launch and handover.", value: { amount: 3125, asset: "USDC" }, status: "pending", dueDate: "Jun 15, 2026" },
    ],
  },
  {
    id: "agr-003",
    title: "Statement of Work — Brand Refresh",
    summary: "Logo refinement, color system, and brand guidelines.",
    status: "revision_requested",
    client: jordan,
    provider: northridge,
    locked: { amount: 8000, asset: "USDC" },
    released: { amount: 0, asset: "USDC" },
    createdAt: "May 2, 2026",
    currentMilestoneId: "ms-003-1",
    milestones: [
      { id: "ms-003-1", order: 1, title: "Concept directions", description: "Three brand concept directions.", value: { amount: 4000, asset: "USDC" }, status: "revision_requested", dueDate: "May 20, 2026" },
      { id: "ms-003-2", order: 2, title: "Final guidelines", description: "Finalized brand guidelines.", value: { amount: 4000, asset: "USDC" }, status: "pending", dueDate: "Jun 10, 2026" },
    ],
  },
  {
    id: "agr-004",
    title: "Mobile App UI Kit",
    summary: "Reusable component library and screens for the iOS/Android app.",
    status: "active",
    client: harbor,
    provider: jordan,
    locked: { amount: 3.2, asset: "ETH" },
    released: { amount: 0.8, asset: "ETH" },
    createdAt: "Apr 18, 2026",
    currentMilestoneId: "ms-004-2",
    milestones: [
      { id: "ms-004-1", order: 1, title: "Foundations", description: "Tokens, type, and color.", value: { amount: 0.8, asset: "ETH" }, status: "released", dueDate: "Apr 30, 2026" },
      { id: "ms-004-2", order: 2, title: "Core components", description: "Buttons, inputs, navigation, cards.", value: { amount: 1.2, asset: "ETH" }, status: "in_review", dueDate: "May 22, 2026",
        submissionNotes: "Core component set delivered with light and dark variants. Includes interactive states and a usage sheet.",
        deliverables: [
          { id: "d10", name: "Components.fig", size: "31 MB", kind: "image" },
          { id: "d11", name: "Usage notes.pdf", size: "1.8 MB", kind: "doc" },
        ],
        checklist: [
          { id: "c10", label: "All core components delivered", done: true },
          { id: "c11", label: "States documented", done: true },
          { id: "c12", label: "Tokens wired to library", done: false },
        ],
      },
      { id: "ms-004-3", order: 3, title: "Screen templates", description: "Onboarding, home, settings.", value: { amount: 1.2, asset: "ETH" }, status: "pending", dueDate: "Jun 14, 2026" },
    ],
  },
  {
    id: "agr-005",
    title: "Data Pipeline Build",
    summary: "ETL pipeline and reporting dashboard for analytics.",
    status: "active",
    client: acme,
    provider: jordan,
    locked: { amount: 18650, asset: "USDC" },
    released: { amount: 7000, asset: "USDC" },
    createdAt: "Mar 14, 2026",
    currentMilestoneId: "ms-005-2",
    milestones: [
      { id: "ms-005-1", order: 1, title: "Ingestion", description: "Source connectors and ingestion.", value: { amount: 7000, asset: "USDC" }, status: "released", dueDate: "Apr 2, 2026" },
      { id: "ms-005-2", order: 2, title: "Transformations", description: "Modeling and transformation layer.", value: { amount: 6650, asset: "USDC" }, status: "in_progress", dueDate: "May 28, 2026" },
      { id: "ms-005-3", order: 3, title: "Dashboard", description: "Reporting dashboard and handover.", value: { amount: 5000, asset: "USDC" }, status: "pending", dueDate: "Jun 22, 2026" },
    ],
  },
  {
    id: "agr-006",
    title: "Content System Migration",
    summary: "Migrate legacy content into the new headless CMS.",
    status: "completed",
    client: jordan,
    provider: studio,
    locked: { amount: 0, asset: "USDC" },
    released: { amount: 9500, asset: "USDC" },
    createdAt: "Jan 22, 2026",
    currentMilestoneId: "ms-006-2",
    milestones: [
      { id: "ms-006-1", order: 1, title: "Audit & mapping", description: "Content audit and field mapping.", value: { amount: 4500, asset: "USDC" }, status: "released", dueDate: "Feb 8, 2026" },
      { id: "ms-006-2", order: 2, title: "Migration & QA", description: "Migrate and verify all entries.", value: { amount: 5000, asset: "USDC" }, status: "completed", dueDate: "Mar 1, 2026" },
    ],
  },
  {
    id: "agr-007",
    title: "Quarterly Retainer — Design Ops",
    summary: "Ongoing design operations support and component upkeep.",
    status: "draft",
    client: jordan,
    provider: meliora,
    locked: { amount: 0, asset: "USDC" },
    released: { amount: 0, asset: "USDC" },
    createdAt: "Jun 1, 2026",
    currentMilestoneId: "ms-007-1",
    milestones: [
      { id: "ms-007-1", order: 1, title: "Month 1", description: "Initial sprint of design ops support.", value: { amount: 3000, asset: "USDC" }, status: "pending", dueDate: "Jul 1, 2026" },
    ],
  },
  // ---- provider-side agreements (signed-in user is the provider) ----------
  {
    id: "agr-008",
    title: "E-commerce Replatform",
    summary: "Migrate the storefront to a headless commerce stack with a new checkout.",
    status: "in_review",
    client: acme,
    provider: jordan,
    locked: { amount: 14200, asset: "USDC" },
    released: { amount: 4800, asset: "USDC" },
    createdAt: "Apr 4, 2026",
    currentMilestoneId: "ms-008-2",
    milestones: [
      { id: "ms-008-1", order: 1, title: "Architecture", description: "Stack selection and architecture.", value: { amount: 4800, asset: "USDC" }, status: "released", dueDate: "Apr 20, 2026" },
      { id: "ms-008-2", order: 2, title: "Storefront build", description: "Catalog, cart, and checkout build.", value: { amount: 5400, asset: "USDC" }, status: "in_review", dueDate: "May 26, 2026",
        submissionNotes: "Storefront and checkout flow delivered on staging. Includes catalog, cart, and a tokenized checkout. Walkthrough video attached.",
        deliverables: [
          { id: "d20", name: "Staging walkthrough.mp4", size: "62 MB", kind: "archive" },
          { id: "d21", name: "Build notes.pdf", size: "640 KB", kind: "doc" },
          { id: "d22", name: "Staging environment", size: "URL", kind: "link" },
        ],
        checklist: [
          { id: "c20", label: "Catalog + cart complete", done: true },
          { id: "c21", label: "Checkout flow complete", done: true },
          { id: "c22", label: "Performance budget met", done: false },
        ],
      },
      { id: "ms-008-3", order: 3, title: "Launch", description: "Cutover and launch.", value: { amount: 4000, asset: "USDC" }, status: "pending", dueDate: "Jun 25, 2026" },
    ],
  },
  {
    id: "agr-009",
    title: "Analytics Dashboard",
    summary: "Self-serve analytics dashboard with scheduled reporting.",
    status: "in_review",
    client: summit,
    provider: jordan,
    locked: { amount: 9000, asset: "USDC" },
    released: { amount: 3000, asset: "USDC" },
    createdAt: "Apr 21, 2026",
    currentMilestoneId: "ms-009-2",
    milestones: [
      { id: "ms-009-1", order: 1, title: "Data model", description: "Metrics model and queries.", value: { amount: 3000, asset: "USDC" }, status: "released", dueDate: "May 5, 2026" },
      { id: "ms-009-2", order: 2, title: "Dashboard UI", description: "Charts, filters, and exports.", value: { amount: 3000, asset: "USDC" }, status: "in_review", dueDate: "May 27, 2026",
        submissionNotes: "Dashboard UI delivered with charts, filters, and CSV export. Awaiting review.",
        deliverables: [
          { id: "d30", name: "Dashboard build.zip", size: "18 MB", kind: "archive" },
          { id: "d31", name: "Release notes.pdf", size: "320 KB", kind: "doc" },
        ],
        checklist: [
          { id: "c30", label: "All charts implemented", done: true },
          { id: "c31", label: "Exports working", done: true },
        ],
      },
      { id: "ms-009-3", order: 3, title: "Scheduled reports", description: "Email + scheduled delivery.", value: { amount: 3000, asset: "USDC" }, status: "pending", dueDate: "Jun 18, 2026" },
    ],
  },
  {
    id: "agr-010",
    title: "Marketing Site Sprint",
    summary: "Two-week sprint to ship a new marketing site section.",
    status: "revision_requested",
    client: northridge,
    provider: jordan,
    locked: { amount: 6000, asset: "USDC" },
    released: { amount: 0, asset: "USDC" },
    createdAt: "May 6, 2026",
    currentMilestoneId: "ms-010-1",
    milestones: [
      { id: "ms-010-1", order: 1, title: "Build & ship", description: "Build and deploy the new section.", value: { amount: 6000, asset: "USDC" }, status: "revision_requested", dueDate: "May 23, 2026" },
    ],
  },
];

// ---- activity feed ---------------------------------------------------------
const ACTIVITY_SEED: ActivityEvent[] = [
  { id: "ev1", agreementId: "agr-001", agreementTitle: "Master Services Agreement", kind: "submitted", label: "Design deliverables submitted", actor: "Summit Ventures", when: "1 day ago" },
  { id: "ev2", agreementId: "agr-002", agreementTitle: "Website Redesign Project", kind: "released", label: "Milestone released", actor: "to Meliora Studio", when: "2 days ago", value: { amount: 3125, asset: "USDC" } },
  { id: "ev3", agreementId: "agr-003", agreementTitle: "Brand Refresh", kind: "revision_requested", label: "Revision requested", actor: "NorthRidge LLC", when: "3 days ago" },
  { id: "ev4", agreementId: "agr-005", agreementTitle: "Data Pipeline Build", kind: "funded", label: "Milestone funded", actor: "Acme Corporation", when: "4 days ago", value: { amount: 6650, asset: "USDC" } },
  { id: "ev5", agreementId: "agr-004", agreementTitle: "Mobile App UI Kit", kind: "submitted", label: "Core components submitted", actor: "by you", when: "5 days ago" },
  { id: "ev6", agreementId: "agr-001", agreementTitle: "Master Services Agreement", kind: "approved", label: "Discovery milestone approved", actor: "Jordan Lee", when: "6 days ago", value: { amount: 12500, asset: "USDC" } },
  { id: "ev7", agreementId: "agr-006", agreementTitle: "Content System Migration", kind: "completed", label: "Agreement completed", actor: "Brightwork Studio", when: "1 week ago" },
  { id: "ev8", agreementId: "agr-002", agreementTitle: "Website Redesign Project", kind: "message", label: "New message", actor: "Meliora Studio", when: "1 week ago" },
];

// ---- new-client experience toggle -----------------------------------------
/* Flip NEW_CLIENT_EMPTY to `false` to restore the demo fixtures. When `true`,
 * every data read is empty (no agreements / no activity), so Home, Agreements,
 * Counterparties and Statistics all render their first-run / empty states — the
 * brand-new-client experience. Temporary preview switch, not a real auth state. */
export const NEW_CLIENT_EMPTY = true;
export const AGREEMENTS: Agreement[] = NEW_CLIENT_EMPTY ? [] : AGREEMENTS_SEED;
export const ACTIVITY: ActivityEvent[] = NEW_CLIENT_EMPTY ? [] : ACTIVITY_SEED;

// ---- selectors -------------------------------------------------------------
/** Which side of an agreement the signed-in user is on. */
export function myRole(a: Agreement): Role {
  return a.client.name === "Jordan Lee" ? "client" : "provider";
}

export function agreementsForRole(role: Role): Agreement[] {
  return AGREEMENTS.filter((a) => myRole(a) === role);
}

export function getAgreement(id: string): Agreement | undefined {
  return AGREEMENTS.find((a) => a.id === id);
}

export function getMilestone(agreementId: string, milestoneId: string) {
  const a = getAgreement(agreementId);
  return a?.milestones.find((m) => m.id === milestoneId);
}

/** The counterparty (the side that isn't the signed-in user). */
export function counterparty(a: Agreement): Party {
  return myRole(a) === "client" ? a.provider : a.client;
}

const LIVE: AgreementStatus[] = ["active", "in_review", "approved", "revision_requested"];

/** ---- Client overview metrics (computed from fixtures) ------------------ */
export function clientMetrics() {
  const mine = agreementsForRole("client");
  const locked = mine
    .filter((a) => LIVE.includes(a.status) && a.locked.asset === "USDC")
    .reduce((sum, a) => sum + a.locked.amount, 0);
  // Items needing the client: work submitted for review, or a draft to sign.
  const attention = mine.filter((a) => a.status === "in_review" || a.status === "draft");
  const activeCount = mine.filter((a) => LIVE.includes(a.status)).length;
  const needsReview = mine.filter((a) => a.status === "in_review").length;
  const pendingFunding = mine.filter((a) => a.status === "draft").length;
  return { mine, locked, attention, activeCount, needsReview, pendingFunding };
}

/** ---- Provider overview metrics ----------------------------------------- */
export function providerMetrics() {
  const mine = agreementsForRole("provider");
  const ms = mine.flatMap((a) => a.milestones);
  const pendingSubmissions = ms.filter((m) => m.status === "in_review").length;
  const fundedMilestones = ms.filter(
    (m) => m.status === "in_progress" || m.status === "in_review",
  ).length;
  const earningsUSDC = mine
    .filter((a) => a.released.asset === "USDC")
    .reduce((sum, a) => sum + a.released.amount, 0);
  const revisionRequests = ms.filter((m) => m.status === "revision_requested").length;

  // ---- Provider-lens KPI values (keyed to ROLE_CONFIG.provider.kpis) -------
  // The provider reads the same agreements through a "deliver work → get paid"
  // lens: money still in escrow they expect to collect, work waiting on the
  // client, deliverables in flight, and funds already released (withdrawable).
  // Aliases reuse the metrics above where the meaning is the same.
  const expectedPayout = mine
    .filter((a) => LIVE.includes(a.status) && a.locked.asset === "USDC")
    .reduce((sum, a) => sum + a.locked.amount, 0);
  const awaitingApproval = pendingSubmissions;
  const activeWork = fundedMilestones;
  const readyToWithdraw = earningsUSDC;

  return {
    mine,
    pendingSubmissions,
    fundedMilestones,
    earningsUSDC,
    revisionRequests,
    expectedPayout,
    awaitingApproval,
    activeWork,
    readyToWithdraw,
  };
}

/** ---- Milestone helpers -------------------------------------------------- */
/** The milestone an agreement is currently focused on. */
export function currentMilestone(a: Agreement) {
  return a.milestones.find((m) => m.id === a.currentMilestoneId) ?? a.milestones[0];
}

const DONE_MS: MilestoneStatus[] = ["released", "completed"];

/** Progress along an agreement's milestones, by released value and by count. */
export function milestoneProgress(a: Agreement) {
  const total = a.milestones.length;
  const order = currentMilestone(a)?.order ?? 1;
  const doneCount = a.milestones.filter((m) => DONE_MS.includes(m.status)).length;
  const totalValue = a.milestones.reduce((s, m) => s + m.value.amount, 0);
  const doneValue = a.milestones
    .filter((m) => DONE_MS.includes(m.status))
    .reduce((s, m) => s + m.value.amount, 0);
  const fraction = totalValue > 0 ? doneValue / totalValue : 0;
  return { total, order, doneCount, fraction, totalValue, doneValue, asset: a.locked.asset };
}

/** ---- Per-agreement primary action (role + status aware) ----------------- */
export type ActionKind = "view" | "review" | "sign" | "release" | "submit" | "resubmit";
export type ActionVariant = "primary" | "secondary" | "positive" | "ghost";

/**
 * The single clearest action the signed-in user can take on an agreement, given
 * their role. JSX-free (the icon is chosen at the call site) so fixtures stay
 * pure. Drives both the Home "needs attention" list and the Agreements table.
 */
export function rowAction(
  a: Agreement,
  role: Role,
): { kind: ActionKind; label: string; variant: ActionVariant } {
  const ms = currentMilestone(a);
  if (role === "client") {
    if (a.status === "draft") return { kind: "sign", label: "Sign", variant: "primary" };
    if (a.status === "in_review") return { kind: "review", label: "Review", variant: "secondary" };
    if (a.status === "approved") return { kind: "release", label: "Release", variant: "positive" };
    return { kind: "view", label: "View", variant: "ghost" };
  }
  if (a.status === "revision_requested") return { kind: "resubmit", label: "Resubmit", variant: "primary" };
  if (a.status === "active" && ms?.status === "in_progress") return { kind: "submit", label: "Submit", variant: "primary" };
  return { kind: "view", label: "View", variant: "ghost" };
}

/** True when the user (in `role`) has an action to take beyond just viewing. */
export function needsMyAction(a: Agreement, role: Role): boolean {
  return rowAction(a, role).kind !== "view";
}

/** Agreements in a workspace that need the user to act, most-urgent first. */
export function attentionFor(role: Role): Agreement[] {
  const rank: Record<ActionKind, number> = { release: 0, sign: 1, review: 2, resubmit: 3, submit: 4, view: 9 };
  return agreementsForRole(role)
    .filter((a) => needsMyAction(a, role))
    .sort((x, y) => rank[rowAction(x, role).kind] - rank[rowAction(y, role).kind]);
}

/** ---- Counterparties directory (rolled up across all agreements) -------- */
export interface CounterpartyRollup {
  party: Party;
  agreements: number;
  active: number;
  /** total USDC currently locked in escrow across their agreements */
  valueUSDC: number;
}

/** Every distinct counterparty, with how many agreements and value engaged. */
export function counterparties(): CounterpartyRollup[] {
  const map = new Map<string, CounterpartyRollup>();
  for (const a of AGREEMENTS) {
    const cp = counterparty(a);
    const e = map.get(cp.id) ?? { party: cp, agreements: 0, active: 0, valueUSDC: 0 };
    e.agreements += 1;
    if (LIVE.includes(a.status)) e.active += 1;
    if (a.locked.asset === "USDC") e.valueUSDC += a.locked.amount;
    map.set(cp.id, e);
  }
  return [...map.values()].sort((x, y) => y.valueUSDC - x.valueUSDC || y.agreements - x.agreements);
}

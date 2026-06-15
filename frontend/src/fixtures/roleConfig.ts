/*
 * Role identity system — "one agreement, two lenses."
 *
 * DealLock has a single product, a single silver premium UI, and a single nav.
 * What changes between Client and Provider is not the layout but the *operating
 * mode*: priorities, wording, KPIs, the primary action, and how the dashboard
 * frames the work.
 *
 *   Client lens   — Protect funds · review delivery · release payment.
 *   Provider lens — Deliver work · prove completion · receive payment.
 *
 * This module is the ONE source of truth for that role-specific copy. Screens
 * read from it (via `useRoleConfig()` or `ROLE_CONFIG[role]`) instead of
 * hardcoding `role === "client" ? "…" : "…"` ternaries. It is intentionally
 * pure data — no JSX, no React, no behavior — so:
 *   • it can be unit-tested and snapshotted on its own,
 *   • icons / onClick / theming are resolved at the call site (the component
 *     owns the visual + behavior; this file owns the words and priorities),
 *   • later patches can restyle the switcher and the cards against this same
 *     config without touching copy.
 *
 * Keep additions declarative and role-symmetric: if you add a field to one
 * role, add it to the other so every consumer can read it unconditionally.
 */
import type { Role } from "./types";

/** Named glyph for the workspace's primary action; mapped to an icon component
 *  at the call site (this file stays JSX-free). */
export type PrimaryActionIcon = "plus" | "upload";

/** The workspace's identity glyph (shown on the selector). Client = shield
 *  (protect/review), Provider = upload (deliver). Resolved at the call site. */
export type WorkspaceGlyph = "shield" | "upload";

/** Accent *temperature* of the workspace — a subtle micro-accent, NOT a theme.
 *  Maps to the existing semantic palette (sage → secure tokens, champagne →
 *  review tokens) so the app never looks like two different brands. */
export type WorkspaceAccent = "sage" | "champagne";

/** The headline CREATION action that anchors the dashboard header for this role.
 *  Product rule: the CLIENT creates the escrow agreement; the PROVIDER only creates
 *  a proposal (off-chain draft) that the client must accept + fund. So the label is
 *  role-asymmetric: "New agreement" (client) vs "New proposal" (provider). */
export interface RolePrimaryAction {
  /** Active label, e.g. "New agreement" (client) / "New proposal" (provider). */
  label: string;
  /** The role's final create-flow action — client "Create escrow agreement" (they
   *  fund it), provider "Send proposal" (the client funds later, never the provider). */
  altLabel: string;
  icon: PrimaryActionIcon;
}

/** One KPI tile's copy. `key` is the stable identity the component uses to bind
 *  the computed value + icon + tone + deep-link (those stay in the view). */
export interface RoleKpi {
  key: string;
  label: string;
  helper: string;
}

/** One quick-action's copy. `key` binds the icon + onClick at the call site. */
export interface RoleQuickAction {
  key: string;
  label: string;
  helper: string;
}

export interface RoleAttention {
  /** Card title — "Needs your approval" (client) vs "Ready for you" (provider). */
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  /**
   * Status → CTA label, the forward-looking copy table for the attention list
   * and the Agreements row action. NOT yet wired — `rowAction()` in
   * `agreements.ts` still derives these labels — but kept here so a later patch
   * can make this the single source for action wording too. Keys are the
   * role-specific lifecycle moments the spec calls out (a loose copy map, not
   * the strict `AgreementStatus` enum, since the two roles key on different
   * moments — e.g. "submitted" for the client vs "funded" for the provider).
   */
  itemActions: Record<string, string>;
}

export interface RoleConfig {
  /** Short noun for the role — used on the switch and inline. */
  label: string;
  /** Full identity label — "Client workspace" / "Provider workspace". */
  workspaceLabel: string;
  /** Present-tense identity line for the selector — "Operating as Client". */
  operatingLabel: string;
  /** Two-word hint under the selector trigger — "Review & release". */
  triggerHint: string;
  /** The workspace's identity glyph, resolved to an icon at the call site. */
  glyph: WorkspaceGlyph;
  /** The three-beat operating journey, shown in the workspace menu. */
  journey: [string, string, string];
  /** One-sentence description of what this workspace is for. */
  shortDescription: string;
  /** The role's three-beat mantra (· separated) — its operating priorities. */
  mindset: string;
  /** Dashboard greeting subtitle — frames the screen as a workspace identity. */
  greetingSubtitle: string;
  /** The driving question the dashboard answers for this role. */
  dashboardQuestion: string;
  accent: WorkspaceAccent;
  primaryAction: RolePrimaryAction;
  /** Ordered KPI strip — first tile is the anchor money metric. */
  kpis: RoleKpi[];
  attention: RoleAttention;
  quickActions: RoleQuickAction[];
  /** Empty-list copy for the Agreements page. Role-aware: "agreements" for the
   *  client (who creates + funds them) vs "proposals" for the provider (who drafts
   *  + sends them; the client accepts + funds). */
  emptyList: { title: string; text: string };
  /** Counterparty invite copy — who this role invites and what happens next.
   *  Source of truth for a future invite UI; the model is provider-connects-wallet-
   *  before-signing, client-reviews-and-funds. */
  counterparty: { inviteLabel: string; note: string };
}

export const ROLE_CONFIG: Record<Role, RoleConfig> = {
  client: {
    label: "Client",
    workspaceLabel: "Client workspace",
    operatingLabel: "Operating as Client",
    triggerHint: "Review & release",
    glyph: "shield",
    journey: ["Protect funds", "Review work", "Release payment"],
    shortDescription:
      "Review submissions, control locked funds, and release payment.",
    mindset: "Protect funds · review delivery · release payment",
    greetingSubtitle: "Client workspace · Review submissions and control fund release.",
    dashboardQuestion: "What work needs my review?",
    accent: "sage",
    // Client OWNS creation + funding of the escrow.
    primaryAction: { label: "New agreement", altLabel: "Create escrow agreement", icon: "plus" },
    kpis: [
      { key: "inEscrow", label: "In escrow", helper: "Across live agreements" },
      { key: "needsReview", label: "Needs review", helper: "Submitted for approval" },
      { key: "activeAgreements", label: "Active agreements", helper: "In progress" },
      { key: "pendingFunding", label: "Pending funding", helper: "Drafts to sign" },
    ],
    attention: {
      title: "Needs your approval",
      emptyTitle: "No approvals waiting",
      emptyDescription:
        "You're all caught up. New provider submissions will appear here.",
      itemActions: {
        draft: "Sign",
        inReview: "Review",
        submitted: "Review",
        revisionRequested: "View revision",
        pendingFunding: "Fund",
      },
    },
    quickActions: [
      { key: "newAgreement", label: "New agreement", helper: "Draft escrow terms" },
      { key: "reviewMilestone", label: "Review milestone", helper: "Approve or request changes" },
      { key: "message", label: "Message provider", helper: "Open a conversation" },
    ],
    emptyList: {
      title: "No agreements yet",
      text: "Create your first escrow agreement to start protecting a deal.",
    },
    counterparty: {
      inviteLabel: "Invite provider",
      note: "Provider will connect a wallet before signing.",
    },
  },

  provider: {
    label: "Provider",
    workspaceLabel: "Provider workspace",
    operatingLabel: "Operating as Provider",
    triggerHint: "Deliver & collect",
    glyph: "upload",
    journey: ["Deliver work", "Prove completion", "Get paid"],
    shortDescription:
      "Submit milestones, track approvals, and collect released funds.",
    mindset: "Submit work · request approval · get paid",
    greetingSubtitle: "Provider workspace · Submit milestones and track upcoming payouts.",
    dashboardQuestion: "What can I deliver or collect?",
    accent: "champagne",
    // Provider can only DRAFT + SEND a proposal — never create a funded/active escrow.
    // The client accepts + funds. ("Submit work" is a post-funding action, not creation.)
    primaryAction: { label: "New proposal", altLabel: "Send proposal", icon: "plus" },
    kpis: [
      { key: "expectedPayout", label: "Expected payout", helper: "Across active work" },
      { key: "awaitingApproval", label: "Awaiting approval", helper: "Submitted to clients" },
      { key: "activeWork", label: "Active work", helper: "Milestones in progress" },
      { key: "readyToWithdraw", label: "Ready to withdraw", helper: "Released funds" },
    ],
    attention: {
      title: "Ready for you",
      emptyTitle: "No work waiting",
      emptyDescription:
        "Milestones ready for submission or payout will appear here.",
      itemActions: {
        draft: "Prepare",
        funded: "Submit",
        revisionRequested: "Revise",
        approved: "View payout",
        released: "Withdraw",
      },
    },
    quickActions: [
      { key: "submitMilestone", label: "Submit milestone", helper: "Upload deliverables" },
      { key: "requestApproval", label: "Request approval", helper: "Send work for review" },
      { key: "message", label: "Message client", helper: "Open a conversation" },
    ],
    emptyList: {
      title: "No proposals yet",
      text: "Create a proposal and send it to a client — they review, accept, and fund the escrow.",
    },
    counterparty: {
      inviteLabel: "Invite client",
      note: "Client will review the proposal and fund escrow if accepted.",
    },
  },
};

/** Convenience accessor — the config for a given role. */
export function roleConfig(role: Role): RoleConfig {
  return ROLE_CONFIG[role];
}

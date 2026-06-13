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

/** The headline action that anchors the dashboard header for this role. */
export interface RolePrimaryAction {
  /** Active label, e.g. "New agreement" / "Submit work". */
  label: string;
  /** Secondary phrasing for contexts where the primary verb is taken. */
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
    primaryAction: { label: "New agreement", altLabel: "Create escrow", icon: "plus" },
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
    primaryAction: { label: "Submit work", altLabel: "New agreement", icon: "upload" },
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
  },
};

/** Convenience accessor — the config for a given role. */
export function roleConfig(role: Role): RoleConfig {
  return ROLE_CONFIG[role];
}

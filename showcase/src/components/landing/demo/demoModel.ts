/*
 * demoModel — the deterministic, client-side state machine behind the homepage
 * "Interactive demo" section.
 *
 * It models ONE example escrow agreement moving through the REAL DealLock
 * on-chain happy path, with no backend, no wallet, and no chain calls. The
 * transitions mirror the implemented contracts (DealLockV4 / DealLockMultiAsset /
 * DealLockMultiAssetV2) exactly:
 *
 *   Agreement:  Proposed → Accepted → Funded → Completed
 *   Milestone:  Pending  → Submitted → Released            (+ V6 RevisionRequested)
 *
 * Load-bearing rules encoded here (all from the contract source):
 *   • The provider (freelancer) must ACCEPT before the client can FUND.
 *   • Funding is ALL-AT-ONCE: the client deposits the full agreement total; funds
 *     then release per-milestone on approval. (fundAgreement requires msg.value ==
 *     totalAmount.)
 *   • Milestones are SEQUENTIAL: a milestone can only be submitted once every
 *     earlier milestone is Released.
 *   • Approval is MANUAL (client calls approveMilestone) — never automatic.
 *   • There are NO platform fees — the full milestone amount goes to the provider.
 *   • V6 revision path: the client can request a revision instead of approving;
 *     the provider addresses it and resubmits.
 *
 * Everything here is pure data + pure functions so the UI stays a thin view over
 * `reducer(state, action)`. Amounts are display-only (never used for real math).
 */

export type DemoRole = "client" | "freelancer";

/** Agreement-level lifecycle — the on-chain AgreementState happy path. */
export type DemoPhase = "proposed" | "accepted" | "funded" | "completed";

/**
 * Per-milestone lifecycle. Mirrors the contract MilestoneState happy path
 * (Pending → Submitted → Released) plus the V6 RevisionRequested path.
 * `upcoming` = a Pending milestone still blocked by an earlier unreleased one
 * (the contract enforces sequential release); `in_progress` = the current Pending
 * milestone that can now be worked + submitted.
 */
export type DemoMsStatus =
  | "upcoming"
  | "in_progress"
  | "submitted"
  | "revision"
  | "released";

export interface DemoMilestone {
  id: string;
  order: number;
  title: string;
  description: string;
  /** Major-unit amount (display only). */
  amount: number;
  status: DemoMsStatus;
  /** How many revision rounds this milestone has been through. */
  revisions: number;
}

export type DemoEventKind =
  | "created"
  | "accepted"
  | "funded"
  | "submitted"
  | "approved"
  | "revision"
  | "resubmitted"
  | "completed";

export interface DemoEvent {
  id: number;
  kind: DemoEventKind;
  /** Plain-English description of a SIMULATED event (never a real tx/hash). */
  text: string;
  actor: DemoRole | "system";
  /** Value moved by this event, if any (display only). */
  amount?: number;
}

export interface DemoState {
  phase: DemoPhase;
  milestones: DemoMilestone[];
  events: DemoEvent[];
  /** Monotonic event-id counter — deterministic, never Date/Math.random. */
  seq: number;
}

export type DemoAction =
  | { type: "ACCEPT" }
  | { type: "FUND" }
  | { type: "SUBMIT" }
  | { type: "APPROVE" }
  | { type: "REQUEST_REVISION" }
  | { type: "RESUBMIT" }
  | { type: "SKIP_TO_REVIEW" }
  | { type: "RESET" };

/* ── Example scenario (clearly fictional) ─────────────────────────────────── */

export const ASSET = "USDC";

export const PARTIES: Record<DemoRole, { name: string; kind: "individual" | "company"; initials: string; title: string }> = {
  client: { name: "Northwind Labs", kind: "company", initials: "NL", title: "Client" },
  freelancer: { name: "Ava Reyes", kind: "individual", initials: "AR", title: "Freelancer" },
};

export const AGREEMENT = {
  title: "Brand & Marketing Site",
  summary:
    "A new brand system and a four-page marketing site, delivered in three milestones. Funds are locked in escrow and released milestone-by-milestone on the client's approval.",
  reviewPeriodLabel: "7-day review window",
};

const MILESTONE_SEED: Omit<DemoMilestone, "status" | "revisions">[] = [
  {
    id: "m1",
    order: 1,
    title: "Design system & homepage",
    description: "Brand tokens, a reusable component library, and the homepage designed and built.",
    amount: 4000,
  },
  {
    id: "m2",
    order: 2,
    title: "Core pages & CMS",
    description: "Pricing, about, and contact pages wired to a headless CMS.",
    amount: 5000,
  },
  {
    id: "m3",
    order: 3,
    title: "Launch & handoff",
    description: "Production launch, documentation, and a handoff walkthrough.",
    amount: 3000,
  },
];

export function initialDemoState(): DemoState {
  return {
    phase: "proposed",
    milestones: MILESTONE_SEED.map((m) => ({ ...m, status: "upcoming", revisions: 0 })),
    events: [
      {
        id: 0,
        kind: "created",
        actor: "client",
        text: `${PARTIES.client.name} drafted the agreement and proposed it to ${PARTIES.freelancer.name}.`,
      },
    ],
    seq: 1,
  };
}

/* ── Derived selectors ────────────────────────────────────────────────────── */

export function totalAmount(s: DemoState): number {
  return s.milestones.reduce((sum, m) => sum + m.amount, 0);
}

export function releasedAmount(s: DemoState): number {
  return s.milestones.filter((m) => m.status === "released").reduce((sum, m) => sum + m.amount, 0);
}

/** Held in escrow right now: funded total minus whatever has been released. */
export function lockedAmount(s: DemoState): number {
  if (s.phase === "proposed" || s.phase === "accepted") return 0;
  return totalAmount(s) - releasedAmount(s);
}

export function releasedCount(s: DemoState): number {
  return s.milestones.filter((m) => m.status === "released").length;
}

/** The single milestone currently in play (in_progress | submitted | revision). */
export function activeMilestone(s: DemoState): DemoMilestone | undefined {
  return s.milestones.find((m) => m.status === "in_progress" || m.status === "submitted" || m.status === "revision");
}

/* ── Reducer ──────────────────────────────────────────────────────────────── */

function pushEvent(s: DemoState, e: Omit<DemoEvent, "id">): DemoEvent[] {
  return [...s.events, { ...e, id: s.seq }];
}

export function reducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "ACCEPT": {
      if (state.phase !== "proposed") return state;
      return {
        ...state,
        phase: "accepted",
        events: pushEvent(state, {
          kind: "accepted",
          actor: "freelancer",
          text: `${PARTIES.freelancer.name} accepted the terms. The agreement is ready to fund.`,
        }),
        seq: state.seq + 1,
      };
    }

    case "FUND": {
      if (state.phase !== "accepted") return state;
      const total = totalAmount(state);
      // Funding the full total unlocks the first milestone for work.
      const milestones = state.milestones.map((m, i) =>
        i === 0 ? { ...m, status: "in_progress" as DemoMsStatus } : m,
      );
      return {
        ...state,
        phase: "funded",
        milestones,
        events: pushEvent(state, {
          kind: "funded",
          actor: "client",
          amount: total,
          text: `${PARTIES.client.name} funded escrow with the full ${ASSET} total. Funds are now locked in the contract.`,
        }),
        seq: state.seq + 1,
      };
    }

    case "SUBMIT": {
      const active = activeMilestone(state);
      if (state.phase !== "funded" || !active || active.status !== "in_progress") return state;
      return {
        ...state,
        milestones: state.milestones.map((m) =>
          m.id === active.id ? { ...m, status: "submitted" } : m,
        ),
        events: pushEvent(state, {
          kind: "submitted",
          actor: "freelancer",
          text: `${PARTIES.freelancer.name} submitted “${active.title}” for review.`,
        }),
        seq: state.seq + 1,
      };
    }

    case "REQUEST_REVISION": {
      const active = activeMilestone(state);
      if (state.phase !== "funded" || !active || active.status !== "submitted") return state;
      return {
        ...state,
        milestones: state.milestones.map((m) =>
          m.id === active.id ? { ...m, status: "revision", revisions: m.revisions + 1 } : m,
        ),
        events: pushEvent(state, {
          kind: "revision",
          actor: "client",
          text: `${PARTIES.client.name} requested a revision on “${active.title}”.`,
        }),
        seq: state.seq + 1,
      };
    }

    case "RESUBMIT": {
      const active = activeMilestone(state);
      if (state.phase !== "funded" || !active || active.status !== "revision") return state;
      return {
        ...state,
        milestones: state.milestones.map((m) =>
          m.id === active.id ? { ...m, status: "submitted" } : m,
        ),
        events: pushEvent(state, {
          kind: "resubmitted",
          actor: "freelancer",
          text: `${PARTIES.freelancer.name} addressed the feedback and resubmitted “${active.title}”.`,
        }),
        seq: state.seq + 1,
      };
    }

    case "APPROVE": {
      const active = activeMilestone(state);
      if (state.phase !== "funded" || !active || active.status !== "submitted") return state;
      const releasedMilestones = state.milestones.map((m) =>
        m.id === active.id ? { ...m, status: "released" as DemoMsStatus } : m,
      );
      // Sequential release: the next upcoming milestone (if any) starts work.
      const nextIdx = releasedMilestones.findIndex((m) => m.status === "upcoming");
      const allReleased = nextIdx === -1;
      const milestones = allReleased
        ? releasedMilestones
        : releasedMilestones.map((m, i) => (i === nextIdx ? { ...m, status: "in_progress" as DemoMsStatus } : m));

      let events = pushEvent(state, {
        kind: "approved",
        actor: "client",
        amount: active.amount,
        text: `${PARTIES.client.name} approved “${active.title}” — ${active.amount.toLocaleString("en-US")} ${ASSET} released to ${PARTIES.freelancer.name}.`,
      });
      let seq = state.seq + 1;

      if (allReleased) {
        events = [...events, {
          id: seq,
          kind: "completed",
          actor: "system",
          text: `All milestones released. The agreement is complete — nothing remains in escrow.`,
        }];
        seq += 1;
      }

      return {
        ...state,
        phase: allReleased ? "completed" : "funded",
        milestones,
        events,
        seq,
      };
    }

    case "SKIP_TO_REVIEW": {
      // Fast-forward to the moment of value: escrow funded, the first milestone
      // submitted, the client about to approve & release. Synthesizes the
      // intervening (still simulated) events so the ledger reads correctly. Pair
      // with a Client perspective at the call site so the release CTA is front-and-centre.
      const fresh = initialDemoState();
      const total = totalAmount(fresh);
      const first = fresh.milestones[0];
      return {
        phase: "funded",
        milestones: fresh.milestones.map((m, i) => (i === 0 ? { ...m, status: "submitted" } : m)),
        events: [
          fresh.events[0],
          { id: 1, kind: "accepted", actor: "freelancer", text: `${PARTIES.freelancer.name} accepted the terms. The agreement is ready to fund.` },
          { id: 2, kind: "funded", actor: "client", amount: total, text: `${PARTIES.client.name} funded escrow with the full ${ASSET} total. Funds are now locked in the contract.` },
          { id: 3, kind: "submitted", actor: "freelancer", text: `${PARTIES.freelancer.name} submitted “${first.title}” for review.` },
        ],
        seq: 4,
      };
    }

    case "RESET":
      return initialDemoState();

    default:
      return state;
  }
}

/* ── Step model: what's happening now + which actions THIS role can take ────── */

export type DemoBtnVariant = "primary" | "positive" | "secondary" | "ghost";

export interface DemoActionButton {
  label: string;
  action: DemoAction;
  variant: DemoBtnVariant;
}

export interface DemoStep {
  /** Stable key for the current situation (role + phase + milestone status). */
  key: string;
  /** Short stage label for the agreement header chip. */
  stageLabel: string;
  stageTone: "neutral" | "review" | "secure" | "technical";
  /** Is it this role's turn to act? */
  yourMove: boolean;
  title: string;
  detail: string;
  /** Actions available to THIS role right now (empty when waiting). */
  actions: DemoActionButton[];
  /** Shown instead of actions when it's the counterparty's move. */
  waitingText?: string;
}

function money(n: number): string {
  return `${n.toLocaleString("en-US")} ${ASSET}`;
}

/** Agreement header chip label/tone (role-independent). */
export function stageFor(s: DemoState): { label: string; tone: DemoStep["stageTone"] } {
  if (s.phase === "proposed") return { label: "Proposed", tone: "neutral" };
  if (s.phase === "accepted") return { label: "Awaiting funding", tone: "review" };
  if (s.phase === "completed") return { label: "Completed", tone: "secure" };
  const active = activeMilestone(s);
  if (active?.status === "submitted") return { label: "In review", tone: "review" };
  if (active?.status === "revision") return { label: "Revision requested", tone: "review" };
  return { label: "In progress", tone: "technical" };
}

export function stepFor(s: DemoState, role: DemoRole): DemoStep {
  const total = totalAmount(s);
  const active = activeMilestone(s);
  const stage = stageFor(s);
  const base = { stageLabel: stage.label, stageTone: stage.tone };

  if (s.phase === "proposed") {
    if (role === "freelancer") {
      return {
        ...base,
        key: "freelancer:proposed",
        yourMove: true,
        title: "Review & accept the agreement",
        detail: `${PARTIES.client.name} drafted this escrow with three milestones totalling ${money(total)}. Accept to lock in the scope and milestones.`,
        actions: [{ label: "Accept agreement", action: { type: "ACCEPT" }, variant: "primary" }],
      };
    }
    return {
      ...base,
      key: "client:proposed",
      yourMove: false,
      title: "Proposed — awaiting acceptance",
      detail: "You've drafted the agreement. Nothing is funded yet.",
      actions: [],
      waitingText: `Waiting for ${PARTIES.freelancer.name} to accept the terms.`,
    };
  }

  if (s.phase === "accepted") {
    if (role === "client") {
      return {
        ...base,
        key: "client:accepted",
        yourMove: true,
        title: "Fund escrow",
        detail: `${PARTIES.freelancer.name} accepted. Deposit the full ${money(total)} into escrow to start the work — funds stay locked in the contract until you approve each milestone. No platform fee is taken.`,
        actions: [{ label: `Fund escrow · ${money(total)}`, action: { type: "FUND" }, variant: "primary" }],
      };
    }
    return {
      ...base,
      key: "freelancer:accepted",
      yourMove: false,
      title: "Accepted — awaiting funding",
      detail: "You've accepted the terms. Work begins once escrow is funded.",
      actions: [],
      waitingText: `Waiting for ${PARTIES.client.name} to fund escrow with ${money(total)}.`,
    };
  }

  if (s.phase === "completed") {
    return {
      ...base,
      key: "completed",
      yourMove: false,
      title: "Agreement complete",
      detail: `All three milestones were approved and ${money(total)} was released to ${PARTIES.freelancer.name}. Nothing remains in escrow.`,
      actions: [{ label: "Replay the demo", action: { type: "RESET" }, variant: "ghost" }],
    };
  }

  // phase === "funded" — depends on the active milestone's status.
  const label = active ? `Milestone ${active.order}: ${active.title}` : "Funded";
  if (active?.status === "in_progress") {
    if (role === "freelancer") {
      return {
        ...base,
        key: `freelancer:in_progress:${active.id}`,
        yourMove: true,
        title: label,
        detail: `Escrow is funded. When “${active.title}” is ready, submit it for the client's review.`,
        actions: [{ label: "Submit work for review", action: { type: "SUBMIT" }, variant: "primary" }],
      };
    }
    return {
      ...base,
      key: `client:in_progress:${active.id}`,
      yourMove: false,
      title: label,
      detail: `${money(active.amount)} is reserved from escrow for this milestone.`,
      actions: [],
      waitingText: `${PARTIES.freelancer.name} is working on “${active.title}”. You'll review it once it's submitted.`,
    };
  }

  if (active?.status === "submitted") {
    if (role === "client") {
      return {
        ...base,
        key: `client:submitted:${active.id}`,
        yourMove: true,
        title: "Work submitted — your review",
        detail: `${PARTIES.freelancer.name} submitted “${active.title}”. Approve to release ${money(active.amount)} from escrow, or request a revision (within the ${AGREEMENT.reviewPeriodLabel}).`,
        actions: [
          { label: `Approve & release · ${money(active.amount)}`, action: { type: "APPROVE" }, variant: "positive" },
          { label: "Request revision", action: { type: "REQUEST_REVISION" }, variant: "secondary" },
        ],
      };
    }
    return {
      ...base,
      key: `freelancer:submitted:${active.id}`,
      yourMove: false,
      title: "Submitted — in review",
      detail: `You submitted “${active.title}”. Payment releases when the client approves.`,
      actions: [],
      waitingText: `Awaiting ${PARTIES.client.name}'s review of “${active.title}”.`,
    };
  }

  if (active?.status === "revision") {
    if (role === "freelancer") {
      return {
        ...base,
        key: `freelancer:revision:${active.id}`,
        yourMove: true,
        title: "Revision requested",
        detail: `${PARTIES.client.name} asked for changes on “${active.title}”. Address the feedback and resubmit for review.`,
        actions: [{ label: "Revise & resubmit", action: { type: "RESUBMIT" }, variant: "primary" }],
      };
    }
    return {
      ...base,
      key: `client:revision:${active.id}`,
      yourMove: false,
      title: "Revision requested",
      detail: `You requested a revision on “${active.title}”. Funds stay locked in escrow meanwhile.`,
      actions: [],
      waitingText: `Waiting for ${PARTIES.freelancer.name} to resubmit “${active.title}”.`,
    };
  }

  // Fallback (should not happen in the happy path).
  return {
    ...base,
    key: "funded:idle",
    yourMove: false,
    title: "Funded",
    detail: "Escrow is funded.",
    actions: [],
  };
}

/* ── Milestone row presentation ───────────────────────────────────────────── */

export function msStatusLabel(status: DemoMsStatus): string {
  switch (status) {
    case "upcoming": return "Pending";
    case "in_progress": return "In progress";
    case "submitted": return "In review";
    case "revision": return "Revision";
    case "released": return "Released";
  }
}

export function msStatusTone(status: DemoMsStatus): "neutral" | "review" | "secure" | "technical" {
  switch (status) {
    case "upcoming": return "neutral";
    case "in_progress": return "technical";
    case "submitted": return "review";
    case "revision": return "review";
    case "released": return "secure";
  }
}

export { money as formatDemoMoney };

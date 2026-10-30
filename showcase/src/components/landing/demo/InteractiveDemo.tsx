/*
 * InteractiveDemo — the homepage #demo section.
 *
 * A clearly-labelled, self-contained walkthrough of the DealLock escrow workflow
 * that a reviewer can drive without signing up, connecting a wallet, or a backend.
 * It renders the REAL app design system (components + tokens, scoped under
 * `.dl-app`) inside an embedded "product window", driven by a deterministic
 * client-side state machine (see demoModel.ts) whose transitions mirror the
 * implemented contracts: Proposed → Accepted → Funded → Completed, with
 * sequential, manually-approved, all-at-once-funded milestones and no fees.
 *
 * Everything is simulated: no transactions, no addresses, no hashes, no funds.
 */
import { useReducer, useState } from "react";
// The app design system (tokens + component styles) — scoped to `.dl-app`, so
// importing it here never touches the surrounding landing. (Already in the bundle
// via AppShell; imported explicitly so the demo is self-sufficient.)
import "../../../styles/app.css";
import "./demo.css";
import { Button } from "../../app/Button";
import { StatusChip, type ChipTone } from "../../app/StatusChip";
import { SegmentedControl } from "../../app/SegmentedControl";
import { Identity } from "../../app/Identity";
import {
  reducer,
  initialDemoState,
  stepFor,
  stageFor,
  activeMilestone,
  totalAmount,
  lockedAmount,
  releasedAmount,
  releasedCount,
  msStatusLabel,
  msStatusTone,
  PARTIES,
  AGREEMENT,
  ASSET,
  type DemoRole,
  type DemoMilestone,
} from "./demoModel";

function num(n: number): string {
  return n.toLocaleString("en-US");
}

function CheckGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 7.5l2.5 2.5L11 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SummaryTile({ kind, label, value }: { kind: "total" | "lock" | "out"; label: string; value: number }) {
  return (
    <div className={`dl-demo-sum__tile dl-demo-sum__tile--${kind}`}>
      <div className="dl-demo-sum__label">
        <span className="dl-demo-sum__dot" />
        {label}
      </div>
      <div className="dl-demo-sum__value">
        {num(value)}
        <span className="dl-demo-sum__unit">{ASSET}</span>
      </div>
    </div>
  );
}

function MilestoneRow({ m, active }: { m: DemoMilestone; active: boolean }) {
  const done = m.status === "released";
  const cls = ["dl-demo-ms__row", active && "dl-demo-ms__row--active", done && "dl-demo-ms__row--done"]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls}>
      <span className="dl-demo-ms__num">{done ? <CheckGlyph /> : m.order}</span>
      <div className="dl-demo-ms__body">
        <div className="dl-demo-ms__title">{m.title}</div>
        <div className="dl-demo-ms__desc">{m.description}</div>
      </div>
      <div className="dl-demo-ms__right">
        <span className="dl-demo-ms__amt">
          {num(m.amount)} {ASSET}
        </span>
        <StatusChip tone={msStatusTone(m.status) as ChipTone}>{msStatusLabel(m.status)}</StatusChip>
      </div>
    </div>
  );
}

export default function InteractiveDemo() {
  const [state, dispatch] = useReducer(reducer, undefined, initialDemoState);
  const [role, setRole] = useState<DemoRole>("client");

  const step = stepFor(state, role);
  const stage = stageFor(state);
  const active = activeMilestone(state);
  const total = totalAmount(state);
  const locked = lockedAmount(state);
  const released = releasedAmount(state);
  const doneCount = releasedCount(state);
  const fraction = total > 0 ? released / total : 0;
  const pct = Math.round(fraction * 100);

  const other: DemoRole = role === "client" ? "freelancer" : "client";
  const me = PARTIES[role];

  // Early-flow shortcut: let a reviewer jump straight to the release moment (escrow
  // funded, work submitted, client about to approve & release). Shown only before the
  // first milestone has been submitted/released so it never collides with the live flow.
  const showSkip =
    state.phase !== "completed" &&
    releasedCount(state) === 0 &&
    active?.status !== "submitted" &&
    active?.status !== "revision";
  const skipToRelease = () => {
    dispatch({ type: "SKIP_TO_REVIEW" });
    setRole("client");
  };

  return (
    <section className="dl-demo-section" aria-labelledby="dl-demo-title">
      <div className="dl-demo-section__bg" aria-hidden="true" />
      <div className="dl-demo-section__inner">
        <header className="dl-demo-section__header">
          <span className="dl-demo-section__eyebrow">Interactive demo</span>
          <h2 id="dl-demo-title" className="dl-demo-section__title">
            See the escrow work. No wallet required.
          </h2>
          <p className="dl-demo-section__sub">
            Step through a live milestone escrow from either side — accept the terms, fund escrow,
            submit work, and release payment on approval. It's the real DealLock interface, driven by
            example data.
          </p>
          <span className="dl-demo-banner">
            <span className="dl-demo-banner__dot" aria-hidden="true" />
            Interactive demo · Simulated transactions · No real funds
          </span>
        </header>

        {/* The embedded product window. `.dl-app` brings the app tokens/components;
            `.dl-demo` neutralises the full-screen shell so it renders in place. The
            `#demo` anchor sits HERE (not on the section) so the hero's "Try interactive
            demo" jump lands on the live controls, not the intro copy. */}
        <div id="demo" className="dl-app dl-demo">
          <div className="dl-demo__window" role="group" aria-label="DealLock escrow — interactive demo">
            {/* Window chrome */}
            <div className="dl-demo__chrome">
              <span className="dl-demo__dots" aria-hidden="true">
                <span className="dl-demo__dot" />
                <span className="dl-demo__dot" />
                <span className="dl-demo__dot" />
              </span>
              <span className="dl-demo__chrome-title">
                <b>DealLock</b> · Escrow workspace
              </span>
              <span className="dl-demo__chrome-spacer" />
              <span className="dl-demo__sim">Simulated</span>
            </div>

            {/* Perspective toolbar */}
            <div className="dl-demo__toolbar">
              <span className="dl-demo__toolbar-label">
                <span className="dl-label">Your perspective</span>
                <span className="dl-demo__toolbar-persona">
                  Viewing as the <b>{me.title}</b> — {me.name}
                </span>
              </span>
              <span className="dl-demo__toggle-wrap">
                <SegmentedControl<DemoRole>
                  ariaLabel="Switch perspective"
                  value={role}
                  onChange={setRole}
                  options={[
                    { value: "client", label: "Client" },
                    { value: "freelancer", label: "Freelancer" },
                  ]}
                />
              </span>
            </div>

            {/* Body — three grid children (agreement · action · ledger). Desktop: agreement
                left, action+ledger stacked right. Mobile: action FIRST, then agreement, then
                ledger — so the next action shows before the long milestone list. */}
            <div className="dl-demo__body">
              <section className="dl-card dl-demo__main">
                  <div className="dl-demo-agr__head">
                    <div className="dl-demo-agr__titles">
                      <div className="dl-label">Agreement</div>
                      <h3 className="dl-demo-agr__title">{AGREEMENT.title}</h3>
                    </div>
                    <StatusChip tone={stage.tone as ChipTone}>{stage.label}</StatusChip>
                  </div>
                  <p className="dl-demo-agr__summary">{AGREEMENT.summary}</p>

                  <div className="dl-demo-parties">
                    <Identity
                      initials={PARTIES.client.initials}
                      name={PARTIES.client.name}
                      sub={PARTIES.client.title}
                    />
                    {role === "client" && <span className="dl-demo-parties__you">You</span>}
                    <span className="dl-demo-parties__link" aria-hidden="true" />
                    <Identity
                      initials={PARTIES.freelancer.initials}
                      name={PARTIES.freelancer.name}
                      sub={PARTIES.freelancer.title}
                    />
                    {role === "freelancer" && <span className="dl-demo-parties__you">You</span>}
                  </div>

                  <div className="dl-demo-sum">
                    <SummaryTile kind="total" label="Total value" value={total} />
                    <SummaryTile kind="lock" label="In escrow" value={locked} />
                    <SummaryTile kind="out" label="Released" value={released} />
                  </div>

                  <div className="dl-demo-prog">
                    <div className="dl-demo-prog__head">
                      <span className="dl-demo-prog__label">Milestone progress</span>
                      <span className="dl-demo-prog__val">
                        {doneCount} of {state.milestones.length} released · {pct}%
                      </span>
                    </div>
                    <div
                      className="dl-demo-prog__track"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={pct}
                    >
                      <div className="dl-demo-prog__fill" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                  </div>

                  <div className="dl-demo-ms">
                    {state.milestones.map((m) => (
                      <MilestoneRow key={m.id} m={m} active={active?.id === m.id} />
                    ))}
                  </div>
              </section>

              {/* Next-action card — grid top-right on desktop; FIRST on mobile. */}
              <section className="dl-card dl-demo-act dl-demo__action" aria-live="polite">
                  <span className={`dl-demo-act__turn ${step.yourMove ? "dl-demo-act__turn--you" : "dl-demo-act__turn--wait"}`}>
                    {step.yourMove ? "Your move" : "Waiting"}
                  </span>
                  <h4 className="dl-demo-act__title">{step.title}</h4>
                  <p className="dl-demo-act__detail">{step.detail}</p>

                  {step.actions.length > 0 && (
                    <div className="dl-demo-act__btns">
                      {step.actions.map((a) => (
                        <Button
                          key={a.label}
                          variant={a.variant}
                          block
                          onClick={() => dispatch(a.action)}
                        >
                          {a.label}
                        </Button>
                      ))}
                    </div>
                  )}

                  {step.waitingText && (
                    <div className="dl-demo-wait">
                      <span className="dl-demo-wait__text">{step.waitingText}</span>
                      <Button variant="secondary" block onClick={() => setRole(other)}>
                        Continue as {PARTIES[other].title} →
                      </Button>
                    </div>
                  )}

                  {showSkip && (
                    <button type="button" className="dl-demo-act__skip" onClick={skipToRelease}>
                      Short on time? Jump to the payment release →
                    </button>
                  )}
              </section>

              <section className="dl-card dl-demo__ledger" aria-label="Activity">
                  <div className="dl-card__head">
                    <div>
                      <div className="dl-label">Activity</div>
                    </div>
                  </div>
                  <div className="dl-demo-log">
                    {state.events.length === 0 ? (
                      <div className="dl-demo-log__empty">No activity yet.</div>
                    ) : (
                      [...state.events]
                        .reverse()
                        .map((e, i) => (
                          <div
                            key={e.id}
                            className={`dl-demo-log__item${i === 0 ? " dl-demo-log__item--latest" : ""}`}
                          >
                            <span className="dl-demo-log__rail" aria-hidden="true">
                              <span className="dl-demo-log__dot" />
                            </span>
                            <span className="dl-demo-log__text">
                              {e.text}
                              {e.amount != null && (
                                <>
                                  {" "}
                                  <span className="dl-demo-log__amt">
                                    {num(e.amount)} {ASSET}
                                  </span>
                                </>
                              )}
                            </span>
                          </div>
                        ))
                    )}
                  </div>
              </section>
            </div>

            {/* Footer */}
            <div className="dl-demo__foot">
              <span className="dl-demo__foot-note">Simulated — no transactions are broadcast and no funds move.</span>
              <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "RESET" })}>
                Reset demo
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

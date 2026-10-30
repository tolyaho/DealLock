/*
 * ContractCardOverlay — the readable contract UI and the "source of truth" for the
 * escrow state. Rendered as crisp HTML/CSS over the metal/glass material plate (see
 * WorkflowContractStage), it answers, at a glance, the three questions a first-time
 * visitor has:
 *
 *   What happened?  → the status chip + CURRENT STEP block
 *   Where is the money? → the Client → Escrow → Provider capsule + the amount lock pill
 *   Who acts next?  → the CURRENT STEP sentence
 *
 * Everything is derived from a single `activeStep` index:
 *   - the status chip text + tone follow step.cardStatus / step.statusTone
 *   - the escrow capsule lock + amount lock pill narrate pending → locked → released
 *   - exactly one region carries the soft purple "active" highlight (step.activeRow)
 *   - the Created→Released escrow rail fills to step.progressIndex (1:1 with the step)
 *   - the CURRENT STEP block restates the active step in plain language (step.caption)
 *
 * The overlay is decorative/illustrative (the clickable action cards carry the
 * accessible narrative), so the stage wrapper marks it aria-hidden.
 */

import { memo } from "react";
import {
  CONTRACT,
  PROGRESS_LABELS,
  WORKFLOW_STEPS,
} from "./workflowSteps";

interface Props {
  activeStep: number;
}

function ContractCardOverlay({ activeStep }: Props) {
  const step = WORKFLOW_STEPS[Math.min(activeStep, WORKFLOW_STEPS.length - 1)];
  const { activeRow, cardStatus, statusTone, caption, progressIndex } = step;

  // Money state drives the escrow lock + amount pill: nothing locked at step 0,
  // locked while work is in flight, released once the contract pays out (step 5).
  const moneyState =
    activeStep >= 4 ? "released" : activeStep >= 1 ? "locked" : "pending";

  const lockText =
    moneyState === "released"
      ? "Released to provider"
      : moneyState === "locked"
        ? "Locked in escrow"
        : "Not yet funded";

  const rowActive = (row: string) => (row === activeRow ? " is-active" : "");

  return (
    <div className="dl-contract">
      {/* Brand + live status chip */}
      <header className="dl-contract__top">
        <span className="dl-contract__brand">DEALLOCK</span>
        <span className={`dl-contract__chip dl-contract__chip--${statusTone}`}>
          <span className="dl-contract__chip-dot" />
          {cardStatus}
        </span>
      </header>

      {/* Agreement title + network */}
      <div className="dl-contract__title-row">
        <span className="dl-contract__eyebrow">Milestone Agreement</span>
        <span className="dl-contract__net">
          <span className="dl-contract__net-dot" />
          {CONTRACT.network}
        </span>
      </div>

      {/* Parties + escrow capsule — Client → Escrow contract → Provider. Lanes are     */}
      {/* role-split (Client left, Provider right) to match the step columns; money      */}
      {/* flows left → right, so the arrows point right. The middle lock is where the    */}
      {/* money sits and lights up while funds are locked.                              */}
      <div className={`dl-contract__parties${rowActive("parties")}`}>
        <div className="dl-contract__party dl-contract__party--client">
          <span className="dl-contract__party-label">Client</span>
          <span className="dl-contract__party-addr">{CONTRACT.client}</span>
        </div>

        <div className={`dl-contract__escrow dl-contract__escrow--${moneyState}`}>
          <span className="dl-contract__escrow-flow">
            <span className="dl-contract__escrow-arrow" aria-hidden="true">→</span>
            <span className="dl-contract__escrow-icon" aria-hidden="true">
              {moneyState === "released" ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M8 11V8a4 4 0 0 1 8 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              )}
            </span>
            <span className="dl-contract__escrow-arrow" aria-hidden="true">→</span>
          </span>
          <span className="dl-contract__escrow-label">Escrow</span>
        </div>

        <div className="dl-contract__party dl-contract__party--provider">
          <span className="dl-contract__party-label">Provider</span>
          <span className="dl-contract__party-addr">{CONTRACT.provider}</span>
        </div>
      </div>

      {/* Milestone */}
      <div className="dl-contract__milestone">
        <span className="dl-contract__milestone-title">{CONTRACT.milestone}</span>
        <span className="dl-contract__milestone-count">{CONTRACT.milestoneCount}</span>
      </div>

      {/* Amount locked — the financial anchor. The lock pill is part of this module */}
      {/* (not a floating tag) so the "Locked in escrow" state reads as the value's    */}
      {/* status, and it narrates pending → locked → released.                          */}
      <div className={`dl-contract__amount dl-contract__amount--${moneyState}${rowActive("amount")}`}>
        <div className="dl-contract__amount-main">
          <span className="dl-contract__amount-eth">{CONTRACT.amount}</span>
          <span className="dl-contract__amount-usd">≈ {CONTRACT.usd} USD</span>
        </div>
        <span className="dl-contract__lock">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {moneyState === "released" ? (
              <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <>
                <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </>
            )}
          </svg>
          {lockText}
        </span>
      </div>

      {/* Escrow rail — Created → Released, fills to the current step. */}
      <div className={`dl-contract__progress${rowActive("progress")}`}>
        {PROGRESS_LABELS.map((label, i) => {
          const node =
            i < progressIndex ? "done" : i === progressIndex ? "current" : "pending";
          return (
            <div key={label} className={`dl-contract__step is-${node}`}>
              <span className="dl-contract__step-dot">
                {node === "done" && (
                  <svg width="8" height="8" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M3 7.5l2.5 2.5L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="dl-contract__step-label">{label}</span>
            </div>
          );
        })}
      </div>

      {/* Current step — the plain-language "what's happening now" block. */}
      <div className="dl-contract__current">
        <span className="dl-contract__current-dot" aria-hidden="true" />
        <div className="dl-contract__current-body">
          <span className="dl-contract__current-label">Current step</span>
          <span className="dl-contract__current-text">{caption}</span>
        </div>
      </div>

      {/* Footer — this card shows a SAMPLE agreement to illustrate the flow; it is not a
          live or verified transaction (the address/amounts are illustrative placeholders).
          Labelled honestly, consistent with the interactive demo's "simulated" framing. */}
      <footer className="dl-contract__addr">
        <span className="dl-contract__verified">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 11v5.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="12" cy="7.6" r="1.15" fill="currentColor" />
          </svg>
          Illustrative example
        </span>
        <span className="dl-contract__addr-hash">Example {CONTRACT.address}</span>
      </footer>
    </div>
  );
}

export default memo(ContractCardOverlay);

/*
 * ContractCardOverlay — the readable contract UI rendered as crisp HTML/CSS on
 * top of the CSS metal/glass material plate (see WorkflowContractStage). The
 * important text lives here (not in the plate) so it stays sharp, updates
 * instantly per scroll step, and is responsive.
 *
 * Everything it shows is derived from a single `activeStep` index:
 *   - the status chip text + tone follow step.cardStatus
 *   - exactly one row carries the soft purple "active" highlight (step.activeRow)
 *   - the Created→Released timeline fills to step.progressIndex
 *   - the provider wallet stays masked until the provider has accepted (step 2)
 *   - the amount panel narrates pending → locked → released
 *
 * The overlay is decorative/illustrative (the action cards carry the accessible
 * narrative), so the stage wrapper marks it aria-hidden.
 */

import { memo } from "react";
import {
  CONTRACT,
  PROGRESS_LABELS,
  WORKFLOW_STEPS,
  type CardStatus,
} from "./workflowSteps";

const STATUS_TONE: Record<CardStatus, string> = {
  Draft: "draft",
  Accepted: "accepted",
  Funded: "funded",
  Submitted: "submitted",
  Approved: "approved",
  Released: "released",
};

interface Props {
  activeStep: number;
}

function ContractCardOverlay({ activeStep }: Props) {
  const step = WORKFLOW_STEPS[Math.min(activeStep, WORKFLOW_STEPS.length - 1)];
  const { activeRow, cardStatus, progressIndex } = step;

  const providerRevealed = activeStep >= 1; // provider accepted
  const amountState =
    activeStep >= 5 ? "released" : activeStep >= 2 ? "locked" : "pending";

  const rowActive = (...rows: string[]) =>
    rows.includes(activeRow) ? " is-active" : "";

  return (
    <div className="dl-contract">
      {/* Brand + live status chip */}
      <header className="dl-contract__top">
        <span className="dl-contract__brand">DEALLOCK</span>
        <span className={`dl-contract__chip dl-contract__chip--${STATUS_TONE[cardStatus]}`}>
          <span className="dl-contract__chip-dot" />
          {cardStatus}
        </span>
      </header>

      {/* Agreement title */}
      <div className={`dl-contract__title-row${rowActive("agreement")}`}>
        <span className="dl-contract__eyebrow">Milestone Agreement</span>
        <span className="dl-contract__net">
          <span className="dl-contract__net-dot" />
          {CONTRACT.network}
        </span>
      </div>

      {/* Parties */}
      <div className={`dl-contract__parties${rowActive("provider")}`}>
        <div className="dl-contract__party">
          <span className="dl-contract__party-label">Client</span>
          <span className="dl-contract__party-addr">{CONTRACT.client}</span>
        </div>
        <span className="dl-contract__party-link" aria-hidden="true" />
        <div
          className={`dl-contract__party dl-contract__party--provider${
            providerRevealed ? " is-revealed" : ""
          }`}
        >
          <span className="dl-contract__party-label">Provider</span>
          <span className="dl-contract__party-addr">
            {providerRevealed ? CONTRACT.provider : "Awaiting…"}
          </span>
        </div>
      </div>

      {/* Milestone */}
      <div className="dl-contract__milestone">
        <span className="dl-contract__milestone-title">{CONTRACT.milestone}</span>
        <span className="dl-contract__milestone-count">{CONTRACT.milestoneCount}</span>
      </div>

      {/* Amount locked */}
      <div className={`dl-contract__amount dl-contract__amount--${amountState}${rowActive("amount", "release")}`}>
        <div className="dl-contract__amount-main">
          <span className="dl-contract__amount-eth">{CONTRACT.amount}</span>
          <span className="dl-contract__amount-usd">≈ {CONTRACT.usd} USD</span>
        </div>
        <span className="dl-contract__amount-state">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {amountState === "released" ? (
              <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <>
                <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </>
            )}
          </svg>
          {amountState === "released"
            ? "Released to provider"
            : amountState === "locked"
              ? "Locked in escrow"
              : "Not yet locked"}
        </span>
      </div>

      {/* Progress timeline */}
      <div className={`dl-contract__progress${rowActive("submission", "approval", "release")}`}>
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

      {/* Contract address */}
      <footer className="dl-contract__addr">
        <span className="dl-contract__addr-label">Contract</span>
        <span className="dl-contract__addr-hash">{CONTRACT.address}</span>
      </footer>
    </div>
  );
}

export default memo(ContractCardOverlay);

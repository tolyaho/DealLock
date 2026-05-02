import {
  type MilestoneData,
  type DisputeData,
  type SettlementProposalData,
  type DeadlineExtensionRequestData,
  milestoneLabel,
  formatTimestamp,
} from "../types.ts";
import { formatAssetAmount, type PaymentAsset } from "../tokens.ts";
import CopyButton from "./ui/CopyButton.tsx";

interface Props {
  milestones: MilestoneData[];
  milestoneNotes?: string[];
  agreementState?: number;
  /** V3+: grace period in seconds (24n). 0n or undefined for V1/V2. */
  gracePeriodSeconds?: bigint;
  /** V4: review period in seconds. */
  reviewPeriodSeconds?: bigint;
  /** V4: per-milestone review deadline. */
  milestoneReviewDeadlines?: bigint[];
  /** V4: per-milestone dispute info. */
  milestoneDisputes?: DisputeData[];
  /** V4: per-milestone settlement proposals. */
  milestoneSettlements?: SettlementProposalData[];
  /** V6: per-milestone deadline extension requests. */
  milestoneExtensions?: DeadlineExtensionRequestData[];
  paymentAsset: PaymentAsset;
}

function nextActionableIndex(ms: MilestoneData[], agreementState?: number): number | null {
  if (agreementState !== 2) return null;
  const submitted = ms.findIndex((m) => m.state === 1);
  if (submitted >= 0) return submitted;
  const pending = ms.findIndex((m) => m.state === 0);
  return pending >= 0 ? pending : null;
}

function stepGlyph(state: number): string {
  if (state === 2 || state === 5) return "✓";
  if (state === 1) return "●";
  if (state === 3) return "↺";
  if (state === 4) return "!";
  if (state === 6) return "?";
  return "";
}

export default function MilestoneList({
  milestones,
  milestoneNotes,
  agreementState,
  gracePeriodSeconds,
  reviewPeriodSeconds,
  milestoneReviewDeadlines = [],
  milestoneDisputes = [],
  milestoneSettlements = [],
  milestoneExtensions = [],
  paymentAsset,
}: Props) {
  const grace = gracePeriodSeconds ?? 0n;
  const review = reviewPeriodSeconds ?? 0n;
  const formatAmount = (amount: bigint) => formatAssetAmount(amount, paymentAsset);
  if (milestones.length === 0) {
    return (
      <section className="surface-card surface-card--pad anim-fade-rise" id="dealock-milestones">
        <div className="section-header">
          <h2 className="section-header-title">Milestones</h2>
        </div>
        <div className="milestone-empty">
          <h3 className="empty-state-title">No milestones yet</h3>
          <p className="empty-state-text">
            Load a contract to see on-chain milestones, amounts, and delivery evidence.
          </p>
        </div>
      </section>
    );
  }

  const nextIdx = nextActionableIndex(milestones, agreementState);

  return (
    <section className="surface-card surface-card--pad anim-fade-rise" id="dealock-milestones">
      <div className="section-header">
        <h2 className="section-header-title">Milestone timeline</h2>
        <span className="section-header-desc">
          {milestones.length} milestone{milestones.length === 1 ? "" : "s"} · sequential escrow
        </span>
      </div>

      <ol className="milestone-timeline">
        {milestones.map((m, idx) => {
          const stateStr = milestoneLabel(m.state);
          const slug = stateStr.toLowerCase();
          const note = milestoneNotes?.[m.id]?.trim();
          const dispute = milestoneDisputes[m.id];
          const proposal = milestoneSettlements[m.id];
          const extension = milestoneExtensions[m.id];
          const reviewDeadline =
            milestoneReviewDeadlines[m.id] ??
            (review > 0n && m.submittedAt > 0n ? m.submittedAt + review : 0n);
          const isLast = idx === milestones.length - 1;
          const isNext = nextIdx === idx;
          const glyph = stepGlyph(m.state);
          return (
            <li
              key={m.id}
              className={`milestone-node milestone-node--${slug} ${isNext ? "milestone-node--next" : ""}`}
            >
              <div className="milestone-node-rail">
                <span className="milestone-node-step" aria-hidden>
                  {glyph || m.id}
                </span>
                {!isLast && <span className="milestone-node-line" aria-hidden />}
              </div>
              <div className="milestone-node-card">
                <div className="milestone-node-top">
                  <div className="milestone-node-top-left">
                    <span className="milestone-node-id">#{m.id}</span>
                    {isNext && <span className="milestone-node-nextchip">Next up</span>}
                  </div>
                  <span className={`state-pill state-pill--${slug}`}>{stateStr}</span>
                </div>
                <h3 className="milestone-node-title">{m.description}</h3>
                <dl className="milestone-node-grid">
                  <div>
                    <dt>Amount</dt>
                    <dd className="mono">{formatAmount(m.amount)}</dd>
                  </div>
                  <div>
                    <dt>Deadline</dt>
                    <dd>{formatTimestamp(m.deadline)}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{formatTimestamp(m.submittedAt)}</dd>
                  </div>
                  {grace > 0n && m.state === 0 && (
                    <div>
                      <dt>Refund opens</dt>
                      <dd>{formatTimestamp(m.deadline + grace)}</dd>
                    </div>
                  )}
                  {grace > 0n && m.state === 0 && (
                    <div>
                      <dt>Submit until</dt>
                      <dd>{formatTimestamp(m.deadline + grace)}</dd>
                    </div>
                  )}
                  {reviewDeadline > 0n && (
                    <div>
                      <dt>Review deadline</dt>
                      <dd>{formatTimestamp(reviewDeadline)}</dd>
                    </div>
                  )}
                </dl>
                {note && (
                  <div className="milestone-note">
                    <span className="milestone-note-label">Off-chain note</span>
                    <p>{note}</p>
                  </div>
                )}
                {m.proof && (
                  <div className="milestone-proof-box">
                    <span className="milestone-note-label">On-chain evidence</span>
                    <code className="milestone-proof-text">{m.proof}</code>
                    <div className="milestone-proof-row">
                      <CopyButton text={m.proof} label="Copy evidence" className="btn-xs" />
                    </div>
                  </div>
                )}
                {dispute?.exists && (
                  <div className="milestone-note">
                    <span className="milestone-note-label">Dispute</span>
                    <p>{dispute.reason}</p>
                    <p>Opened {formatTimestamp(dispute.openedAt)}</p>
                  </div>
                )}
                {proposal?.exists && (
                  <div className="milestone-note">
                    <span className="milestone-note-label">Settlement proposal</span>
                    <p>
                      Provider: {formatAmount(proposal.providerAmount)} · Client:{" "}
                      {formatAmount(m.amount - proposal.providerAmount)}
                    </p>
                    {proposal.note && <p>{proposal.note}</p>}
                  </div>
                )}
                {extension?.active && (
                  <div className="milestone-note">
                    <span className="milestone-note-label">Deadline extension request</span>
                    <p>
                      Proposed deadline: {formatTimestamp(extension.proposedDeadline)} · requested{" "}
                      {formatTimestamp(extension.requestedAt)}
                    </p>
                    {extension.reason && <p>{extension.reason}</p>}
                    <p>Ignoring this request does not block refund after the current grace window.</p>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

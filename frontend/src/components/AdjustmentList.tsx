import {
  type AdjustmentData,
  type DisputeData,
  type SettlementProposalData,
  type DeadlineExtensionRequestData,
  adjustmentLabel,
  formatTimestamp,
} from "../types.ts";
import { formatAssetAmount, type PaymentAsset } from "../tokens.ts";

interface AdjustmentListProps {
  adjustments: AdjustmentData[];
  /** If provided, only show adjustments for this milestone. */
  targetMilestoneId?: number;
  /** V3+: grace period in seconds (24n). 0n or undefined for V1/V2. */
  gracePeriodSeconds?: bigint;
  /** V4: review period in seconds. */
  reviewPeriodSeconds?: bigint;
  /** V4: per-adjustment review deadline. */
  adjReviewDeadlines?: bigint[];
  /** V4: per-adjustment dispute info. */
  adjDisputes?: DisputeData[];
  /** V4: per-adjustment settlement proposals. */
  adjSettlements?: SettlementProposalData[];
  /** V6: per-adjustment deadline extension requests. */
  adjExtensions?: DeadlineExtensionRequestData[];
  paymentAsset: PaymentAsset;
}

function adjustmentStateClass(state: number): string {
  const label = adjustmentLabel(state).toLowerCase();
  return `adjustment-state-pill adjustment-state--${label}`;
}

export default function AdjustmentList({
  adjustments,
  targetMilestoneId,
  gracePeriodSeconds,
  reviewPeriodSeconds,
  adjReviewDeadlines = [],
  adjDisputes = [],
  adjSettlements = [],
  adjExtensions = [],
  paymentAsset,
}: AdjustmentListProps) {
  const grace = gracePeriodSeconds ?? 0n;
  const review = reviewPeriodSeconds ?? 0n;
  const formatAmount = (amount: bigint) => formatAssetAmount(amount, paymentAsset);
  const visible =
    targetMilestoneId !== undefined
      ? adjustments.filter((a) => a.targetMilestoneId === targetMilestoneId)
      : adjustments;

  if (visible.length === 0) return null;

  return (
    <div className="adjustment-list">
      {visible.map((adj) => {
        const dispute = adjDisputes[adj.id];
        const proposal = adjSettlements[adj.id];
        const extension = adjExtensions[adj.id];
        const reviewDeadline =
          adjReviewDeadlines[adj.id] ??
          (review > 0n && adj.submittedAt > 0n ? adj.submittedAt + review : 0n);

        return (
          <div key={adj.id} className={`adjustment-card adjustment-card--state-${adjustmentLabel(adj.state).toLowerCase()}`}>
            <div className="adjustment-card-header">
              <span className="adjustment-card-id">Adj #{adj.id}</span>
              <span className={adjustmentStateClass(adj.state)}>
                {adjustmentLabel(adj.state)}
              </span>
              <span className="adjustment-card-amount">{formatAmount(adj.amount)}</span>
            </div>

            <p className="adjustment-card-desc">{adj.description}</p>

            <div className="adjustment-card-meta">
              <span>Milestone #{adj.targetMilestoneId}</span>
              <span>Deadline: {formatTimestamp(adj.deadline)}</span>
              {adj.submittedAt > 0n && (
                <span>Submitted: {formatTimestamp(adj.submittedAt)}</span>
              )}
              {grace > 0n && adj.state === 2 && (
                <span>Refund opens: {formatTimestamp(adj.deadline + grace)}</span>
              )}
              {grace > 0n && adj.state === 2 && (
                <span>Submit until: {formatTimestamp(adj.deadline + grace)}</span>
              )}
              {reviewDeadline > 0n && (
                <span>Review deadline: {formatTimestamp(reviewDeadline)}</span>
              )}
            </div>

            {adj.proof && (
              <div className="adjustment-card-proof">
                <span className="adjustment-card-proof-label">Proof</span>
                <code className="adjustment-card-proof-value">{adj.proof}</code>
              </div>
            )}

            {dispute?.exists && (
              <div className="adjustment-card-proof">
                <span className="adjustment-card-proof-label">Dispute</span>
                <span className="adjustment-card-proof-value">
                  {dispute.reason} · opened {formatTimestamp(dispute.openedAt)}
                </span>
              </div>
            )}

            {proposal?.exists && (
              <div className="adjustment-card-proof">
                <span className="adjustment-card-proof-label">Settlement proposal</span>
                <span className="adjustment-card-proof-value">
                  Provider: {formatAmount(proposal.providerAmount)} · Client:{" "}
                  {formatAmount(adj.amount - proposal.providerAmount)}
                  {proposal.note ? ` · ${proposal.note}` : ""}
                </span>
              </div>
            )}

            {extension?.active && (
              <div className="adjustment-card-proof">
                <span className="adjustment-card-proof-label">Deadline extension request</span>
                <span className="adjustment-card-proof-value">
                  Proposed deadline: {formatTimestamp(extension.proposedDeadline)} · requested{" "}
                  {formatTimestamp(extension.requestedAt)}
                  {extension.reason ? ` · ${extension.reason}` : ""}
                  {" · Ignoring it does not block refund after the current grace window."}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

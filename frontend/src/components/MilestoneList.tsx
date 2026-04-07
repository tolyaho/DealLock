import {
  type MilestoneData,
  milestoneLabel,
  formatEth,
  formatTimestamp,
} from "../types.ts";

interface Props {
  milestones: MilestoneData[];
  /** Off-chain notes from local storage, index-aligned with milestone id. */
  milestoneNotes?: string[];
}

export default function MilestoneList({ milestones, milestoneNotes }: Props) {
  if (milestones.length === 0) {
    return (
      <section className="card">
        <div className="card-header">
          <span className="card-title">Milestones</span>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No milestones loaded</div>
          <p className="empty-state-text">Load a contract to view milestone details.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-header">
        <span className="card-title">Milestones</span>
        <span className="badge badge-lg badge-proposed">{milestones.length} total</span>
      </div>
      <p className="milestone-section-hint">
        On-chain states and amounts. Delivery references are submission evidence (links, hashes, CIDs).
      </p>
      {milestones.map((m) => {
        const stateStr = milestoneLabel(m.state);
        const badgeClass = `badge badge-${stateStr.toLowerCase()}`;
        const note = milestoneNotes?.[m.id]?.trim();
        return (
          <div key={m.id} className="milestone-card">
            <div className="milestone-header">
              <h3>
                <span className="milestone-index">{m.id}</span>
                {m.description}
              </h3>
              <span className={badgeClass}>{stateStr}</span>
            </div>
            <div className="milestone-details">
              <span className="dim">Amount</span>
              <span>{formatEth(m.amount)} ETH</span>
              <span className="dim">Deadline</span>
              <span>{formatTimestamp(m.deadline)}</span>
              <span className="dim">Submitted</span>
              <span>{formatTimestamp(m.submittedAt)}</span>
            </div>
            {note && (
              <div className="milestone-offchain-note">
                <span className="dim">Off-chain note: </span>
                {note}
              </div>
            )}
            {m.proof && (
              <div className="milestone-proof">
                <span className="dim">Evidence: </span>
                {m.proof}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

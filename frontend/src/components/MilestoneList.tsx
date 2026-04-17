import {
  type MilestoneData,
  milestoneLabel,
  formatEth,
  formatTimestamp,
} from "../types.ts";
import CopyButton from "./ui/CopyButton.tsx";

interface Props {
  milestones: MilestoneData[];
  milestoneNotes?: string[];
  agreementState?: number;
}

/**
 * "Next up" = the earliest milestone that a party can act on right now.
 * - Pending (0) during Funded (state 2): provider should submit this one next.
 * - Submitted (1): client should approve this one next.
 * Only highlight one node to keep the signal strong.
 */
function nextActionableIndex(ms: MilestoneData[], agreementState?: number): number | null {
  if (agreementState !== 2) return null;
  const submitted = ms.findIndex((m) => m.state === 1);
  if (submitted >= 0) return submitted;
  const pending = ms.findIndex((m) => m.state === 0);
  return pending >= 0 ? pending : null;
}

function stepGlyph(state: number): string {
  if (state === 2) return "✓"; // Released
  if (state === 1) return "●"; // Submitted
  if (state === 3) return "↺"; // Refunded
  return ""; // Pending (show index)
}

export default function MilestoneList({ milestones, milestoneNotes, agreementState }: Props) {
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
                    <dd className="mono">{formatEth(m.amount)} ETH</dd>
                  </div>
                  <div>
                    <dt>Deadline</dt>
                    <dd>{formatTimestamp(m.deadline)}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{formatTimestamp(m.submittedAt)}</dd>
                  </div>
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
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

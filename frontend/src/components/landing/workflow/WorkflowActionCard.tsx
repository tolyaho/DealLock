/*
 * WorkflowActionCard — one explanatory step card flanking the central contract
 * card. Client steps sit in the left column, provider/system steps on the right;
 * `side` flips the icon-tile/text order and the direction the connector line
 * reaches toward the centre.
 *
 * Visual state is driven by `position` — the card's distance from the active
 * scroll step, NOT its absolute index. Only the active card (centred, full focus,
 * connector drawn in) and its immediate neighbours ("prev"/"next", faint, nudged
 * above/below) are visible; everything else ("past"/"future") fades out entirely.
 * This is what keeps the scene to ~one card in focus instead of a wall of six, so
 * it survives short viewports. `done` (the step is already behind us) swaps the
 * number badge for a check and tints it as completed — independent of position.
 */

import { forwardRef, memo, type CSSProperties } from "react";
import type { WorkflowStep } from "./workflowSteps";
import { WorkflowIcon } from "./workflowIcons";

export type CardPosition = "active" | "prev" | "next" | "past" | "future";

// Who is acting this step — surfaced as a small chip so "who acts now?" is explicit
// (client steps left, provider/system steps right; escrow = the contract itself).
const ROLE_LABEL: Record<WorkflowStep["role"], string> = {
  client: "Client",
  provider: "Provider",
  escrow: "Escrow",
};

interface Props {
  step: WorkflowStep;
  /** Distance-from-active state that drives visibility + vertical offset (CSS). */
  position: CardPosition;
  /** True once the step is behind the active one — shows the check badge. */
  done: boolean;
  index: number;
  /** Stable desktop grid column (by side); inert once the scene becomes a flex column. */
  style?: CSSProperties;
}

const WorkflowActionCard = forwardRef<HTMLElement, Props>(function WorkflowActionCard(
  { step, position, done, index, style },
  ref,
) {
  return (
    <article
      ref={ref}
      data-step-index={index}
      style={style}
      className={`dl-wf-card dl-wf-card--${step.side} is-${position}${done ? " is-done" : ""}`}
    >
      <span className="dl-wf-card__connector" aria-hidden="true">
        <span className="dl-wf-card__node" />
      </span>

      <span className="dl-wf-card__icon" aria-hidden="true">
        <WorkflowIcon name={step.icon} />
      </span>

      <div className="dl-wf-card__body">
        <div className="dl-wf-card__meta">
          <span className="dl-wf-card__num">
            {done ? (
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path
                  d="M3 7.5l2.5 2.5L11 4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              step.number
            )}
          </span>
          <span className="dl-wf-card__role">{ROLE_LABEL[step.role]}</span>
        </div>
        <h3 className="dl-wf-card__title">{step.title}</h3>
        <p className="dl-wf-card__text">{step.body}</p>
      </div>
    </article>
  );
});

// Memoized so a step change only re-renders the cards whose `position`/`done`
// actually flip (a handful per step) rather than all six. Relies on `style` being a
// stable object per card — WorkflowStory memoizes the column styles (fixed per side)
// so the reference doesn't change on every parent render.
export default memo(WorkflowActionCard);

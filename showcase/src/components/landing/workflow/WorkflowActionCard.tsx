/*
 * WorkflowActionCard — one explanatory step card flanking the central contract
 * card. It is part of one connected journey: a step number, the actor (CLIENT /
 * PROVIDER / CONTRACT), an action title, a one-line explanation, and a clear
 * DONE / ACTIVE NOW / UPCOMING state tag.
 *
 * Visual state is driven by `position` — the card's distance from the active step,
 * NOT its absolute index. Only the active card (centred, full focus, connector drawn
 * in) and its immediate neighbours ("prev"/"next", faint, nudged above/below) are
 * visible; everything else ("past"/"future") fades out entirely, so the scene stays
 * to ~one card in focus instead of a wall of five and survives short viewports.
 * `done` (the step is already behind us) swaps the number badge for a check.
 *
 * The whole card is a button (role="button" + keyboard support): clicking/tapping it
 * walks the central card to that step, so "tap a step to walk the flow" is real.
 */

import { forwardRef, memo, type CSSProperties, type KeyboardEvent } from "react";
import type { WorkflowStep } from "./workflowSteps";
import { WorkflowIcon } from "./workflowIcons";

export type CardPosition = "active" | "prev" | "next" | "past" | "future";

// Who is acting this step — surfaced so "who acts now?" is explicit.
const ROLE_LABEL: Record<WorkflowStep["role"], string> = {
  client: "Client",
  provider: "Provider",
  contract: "Contract",
};

interface Props {
  step: WorkflowStep;
  /** Distance-from-active state that drives visibility + vertical offset (CSS). */
  position: CardPosition;
  /** True once the step is behind the active one — shows the check badge + DONE tag. */
  done: boolean;
  index: number;
  /** Walk the central card to this step (scrolls the pinned track / scrolls into view). */
  onSelect: (index: number) => void;
  /** Stable desktop grid column (by side); inert once the scene becomes a flex column. */
  style?: CSSProperties;
}

const WorkflowActionCard = forwardRef<HTMLElement, Props>(function WorkflowActionCard(
  { step, position, done, index, onSelect, style },
  ref,
) {
  const active = position === "active";
  // DONE (behind us) → ACTIVE NOW (current) → UPCOMING (ahead). Calm, confirmed,
  // dominant, secondary — the four tones the prompt asks for, on one tag.
  const state = active ? "active" : done ? "done" : "upcoming";
  const tagLabel = active ? "Active now" : done ? "Done" : "Upcoming";

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(index);
    }
  };

  return (
    <article
      ref={ref}
      data-step-index={index}
      style={style}
      className={`dl-wf-card dl-wf-card--${step.side} is-${position}${done ? " is-done" : ""}`}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      aria-label={`Step ${step.number}, ${ROLE_LABEL[step.role]}: ${step.title}. ${tagLabel}.`}
      onClick={() => onSelect(index)}
      onKeyDown={handleKeyDown}
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
          <span className={`dl-wf-card__tag dl-wf-card__tag--${state}`}>{tagLabel}</span>
        </div>
        <h3 className="dl-wf-card__title">{step.title}</h3>
        <p className="dl-wf-card__text">{step.body}</p>
      </div>
    </article>
  );
});

// Memoized so a step change only re-renders the cards whose `position`/`done`
// actually flip (a handful per step) rather than all five. Relies on `style` being a
// stable object per card — WorkflowStory memoizes the column styles (fixed per side)
// so the reference doesn't change on every parent render.
export default memo(WorkflowActionCard);

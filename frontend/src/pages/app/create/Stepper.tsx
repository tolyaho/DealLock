/*
 * Stepper — the wizard progress indicator. Five steps with a connecting rail;
 * completed steps carry a sage check and are clickable (jump back), the current
 * step is ringed, and future steps are calm + disabled. Labels hide on small
 * widths (the card eyebrow always states "Step n of 5 · Title"). aria via a
 * labelled <ol> + aria-current on the active step.
 */
import { Fragment } from "react";
import { IconCheck } from "../../../components/app/icons";
import { STEP_LABEL, STEP_ORDER, type StepId } from "./model";

interface Props {
  current: StepId;
  /** Highest step index the user has reached (controls what's clickable). */
  reached: number;
  onJump: (step: StepId) => void;
}

export function Stepper({ current, reached, onJump }: Props) {
  const currentIndex = STEP_ORDER.indexOf(current);

  return (
    <ol className="dl-stepper" aria-label="Progress">
      {STEP_ORDER.map((step, i) => {
        const isComplete = i < currentIndex;
        const isCurrent = i === currentIndex;
        const canJump = i <= reached && !isCurrent;
        const stateCls = isCurrent ? " is-current" : isComplete ? " is-complete" : "";
        return (
          <Fragment key={step}>
            {i > 0 && <li className="dl-stepper__line" data-filled={i <= currentIndex ? "true" : undefined} aria-hidden="true" />}
            <li className="dl-stepper__item">
              <button
                type="button"
                className={`dl-stepper__step${stateCls}`}
                onClick={() => canJump && onJump(step)}
                disabled={!canJump}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span className="dl-stepper__dot" aria-hidden="true">
                  {isComplete ? <IconCheck /> : i + 1}
                </span>
                <span className="dl-stepper__label">{STEP_LABEL[step]}</span>
              </button>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

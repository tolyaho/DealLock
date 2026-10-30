/*
 * WorkflowStepNav — the small carousel-style step selector under the contract card.
 *
 * The action cards are tappable too, but only the active card and its two immediate
 * neighbours are ever visible (the rest fade out / go pointer-events:none), so "tap a
 * step to walk the flow" could only ever reach ±1 step and the target was a faint,
 * shifting card. This is the honest, always-visible control: five dots — one per step,
 * each a real button — so ANY step is reachable with a stable, obvious tap target. The
 * active dot stretches into a pill; completed steps read filled, upcoming ones faint.
 * It mirrors the 5-step model 1:1 (not the in-card status rail, which stays decorative).
 */

import { WORKFLOW_STEPS } from "./workflowSteps";

const ROLE_LABEL = { client: "Client", provider: "Provider", contract: "Contract" } as const;

interface Props {
  activeStep: number;
  onSelect: (index: number) => void;
}

export default function WorkflowStepNav({ activeStep, onSelect }: Props) {
  return (
    <nav className="dl-wf-steps" aria-label="Walk the escrow flow — jump to a step">
      {WORKFLOW_STEPS.map((step, i) => {
        const state = i === activeStep ? "active" : i < activeStep ? "done" : "upcoming";
        return (
          <button
            key={step.id}
            type="button"
            className={`dl-wf-step-pip is-${state}`}
            aria-current={i === activeStep ? "step" : undefined}
            aria-label={`Step ${step.number}, ${ROLE_LABEL[step.role]}: ${step.title}`}
            onClick={() => onSelect(i)}
          >
            <span className="dl-wf-step-pip__dot" aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}

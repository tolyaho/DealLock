/*
 * WorkflowStory — the scrollytelling section below the hero. A central metal/glass
 * contract card stays pinned while the user scrolls; the six action cards (client
 * left, provider/system right) light up one at a time, the contract overlay updates
 * its status/active-row/progress, connectors draw in, and a typed line narrates the
 * active step.
 *
 * Layout strategy (one DOM, two behaviours via CSS):
 *   Desktop — the header scrolls THROUGH first, then `.dl-workflow__scroll` (a tall
 *   track) pins `.dl-workflow__sticky` (a header-aware, single-ROW scene) so the
 *   central contract card stays the focal object. Each action card sits in its
 *   left/right column but is positioned by its DISTANCE from the active step, not a
 *   fixed row — so only the active card (centred) and its neighbours (faint, nudged
 *   above/below) take up space. Past/future cards collapse to opacity 0. This is why
 *   the scene fits short viewports: it never lays out all six cards at once.
 *   Mobile — the scene becomes a single flex column (the inline grid column goes
 *   inert), the centre card sticks to the top, and the action cards stack beneath
 *   it; the active step is driven by which stacked card crosses mid-viewport.
 *
 * Every card's position (+ done flag) is derived purely by comparing its index to
 * `activeStep`, so both scroll strategies share one state.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { WORKFLOW_STEPS, STEP_COUNT } from "./workflowSteps";
import { useWorkflowStep } from "./useWorkflowStep";
import WorkflowActionCard, { type CardPosition } from "./WorkflowActionCard";
import WorkflowContractStage from "./WorkflowContractStage";
import TypewriterText from "./TypewriterText";
import MetalOrbitLines from "../MetalOrbitLines";
import MetalSheen from "../MetalSheen";
import { useMediaQuery } from "../useMediaQuery";

// Position is the card's DISTANCE from the active step, not its absolute index — so
// only the active card (+ its immediate neighbours) is ever placed/visible. This is
// what stops all six cards being laid out at once (the short-viewport overflow bug):
// past/future cards collapse to opacity 0 instead of occupying vertical space.
function cardPosition(index: number, activeStep: number): CardPosition {
  const rel = index - activeStep;
  if (rel === 0) return "active";
  if (rel === -1) return "prev";
  if (rel === 1) return "next";
  return rel < 0 ? "past" : "future";
}

// Header copy + cadence. The title is FIXED (not typed): a large display face typed
// per-character re-laid-out a big text node on every keystroke while the header was
// still scrolling through the viewport, and that concurrent relayout stuttered. So the
// title just fades in with the eyebrow; a short beat later the subtitle types out in
// small mono — which reveals as smoothly as the pinned contract narration does.
const WF_TITLE = "The Milestone Flow";
const WF_SUB =
  "DealLock secures each milestone. Funds stay locked until work is approved.";
const WF_SUB_SPEED = 15;
const WF_SUB_DELAY = 520;

export default function WorkflowStory() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);

  // Per-step desktop dwell weights (stable identity so the scroll effect doesn't
  // re-subscribe every render). Even by default; the fund-lock step holds longer.
  const stepWeights = useMemo(
    () => WORKFLOW_STEPS.map((step) => step.scrollWeight ?? 1),
    [],
  );

  const { activeStep } = useWorkflowStep({
    trackRef,
    cardRefs,
    stepCount: STEP_COUNT,
    stepWeights,
  });

  // On phones the scene is a static stack and the narration is hidden, so drop the
  // typed subtitle too — a partially-typed line + caret reads as a glitch on mobile.
  const compact = useMediaQuery("(max-width: 767px)");

  // Latch the header reveal the first time it scrolls meaningfully into view, then
  // disconnect — the title/subtitle reveal once and stay (no re-trigger on scroll-back).
  const headerRef = useRef<HTMLElement | null>(null);
  const [headerInView, setHeaderInView] = useState(false);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setHeaderInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Column placement only: each card lives in its side column, single shared row
  // (cards in a column overlap and are separated by their per-position transform, so
  // there's no fixed vertical slot to overflow). Built once as stable style objects
  // (column is fixed per side) so memo(WorkflowActionCard) isn't defeated by a fresh
  // `style` reference on every scroll-step render.
  const placement = useMemo<CSSProperties[]>(
    () =>
      WORKFLOW_STEPS.map((step) => ({
        gridColumn: step.side === "left" ? 1 : 3,
        gridRow: 1,
      })),
    [],
  );

  const narration = WORKFLOW_STEPS[Math.min(activeStep, STEP_COUNT - 1)].typewriter;

  return (
    <section id="workflow" className="dl-workflow" aria-labelledby="dl-workflow-title">
      <div className="dl-workflow__bg" aria-hidden="true">
        <div className="dl-workflow__bg-glow" />
      </div>

      {/* Seam bridge — melts the hard edge where the hero's shadowed floor meets    */}
      {/* this lighter section. Sits at the very top (clear of the hero scroll cue),  */}
      {/* opaque in the hero's bottom tone and ramping down into the workflow surface. */}
      <div className="dl-workflow__seam" aria-hidden="true" />

      {/* Header sits ABOVE the sticky track, so it scrolls through/away as the       */}
      {/* contract-card scene takes over and pins as the central focal object.        */}
      <header className="dl-workflow__header" ref={headerRef}>
        <span className={`dl-workflow__eyebrow${headerInView ? " is-in" : ""}`}>
          Workflow
        </span>
        <h2
          id="dl-workflow-title"
          className={`dl-workflow__title${headerInView ? " is-in" : ""}`}
        >
          {WF_TITLE}
        </h2>
        <p className="dl-workflow__sub">
          <TypewriterText
            text={WF_SUB}
            start={headerInView}
            speed={WF_SUB_SPEED}
            startDelay={WF_SUB_DELAY}
            disabled={compact}
          />
        </p>
      </header>

      <div className="dl-workflow__scroll" ref={trackRef}>
        <div className="dl-workflow__sticky">
          {/* Pinned metallic background for the focal stage: specular reflection sweeps */}
          {/* (strongest variant) under the orbital guide. Both are decorative layers    */}
          {/* (z-index below the scene) — they never touch the contract or the cards.    */}
          <MetalSheen className="dl-sheen--workflow" />
          {/* Decorative orbital guide pinned behind the contract — implies "flow"     */}
          {/* without becoming an infographic. Background layer only (z-index below).   */}
          <MetalOrbitLines className="dl-orbit--workflow" />
          <div className="dl-workflow__scene">
            <div className="dl-workflow__center">
              <WorkflowContractStage activeStep={activeStep} />
              <p className="dl-workflow__narration">
                <TypewriterText key={activeStep} text={narration} />
              </p>
            </div>

            {WORKFLOW_STEPS.map((step, i) => (
              <WorkflowActionCard
                key={step.id}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                step={step}
                index={i}
                position={cardPosition(i, activeStep)}
                done={i < activeStep}
                // Desktop grid column; ignored once the scene switches to flex on mobile.
                style={placement[i]}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

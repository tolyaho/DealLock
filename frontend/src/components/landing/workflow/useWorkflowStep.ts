/*
 * useWorkflowStep — maps the user's scroll position onto a discrete active step
 * (0…stepCount-1) for the workflow scrollytelling scene. It runs ONE of two
 * strategies depending on viewport width, switching live on resize:
 *
 *   Desktop (> mobile breakpoint): the scroll track is a tall element with a
 *   sticky 100vh scene pinned inside it. We read the TRACK's getBoundingClientRect
 *   each frame and convert how far it has scrolled past the top into 0…1 progress,
 *   then bucket that into equal step bands. (The section header sits ABOVE the
 *   track and scrolls away first — so measuring the track, not the whole section,
 *   keeps step 1 starting exactly when the scene pins.) rAF-throttled, passive.
 *
 *   Mobile (<= breakpoint): there is no pinned scene — action cards stack
 *   vertically. An IntersectionObserver watches each stacked card and the active
 *   step becomes the highest-index card currently crossing the viewport's middle
 *   band, so the sticky contract card updates as you scroll past each card.
 *
 * Either way the output is a single `activeStep`; the rest of the UI derives
 * active / completed / upcoming purely from comparing indices against it.
 *
 * It also returns `scrollToStep(i)`, which the (now clickable) action cards call so
 * "tap a step to walk the flow" is real: on desktop it scrolls the window to the
 * middle of that step's band on the pinned track (the scroll handler then flips the
 * active step), and on mobile it scrolls that stacked card to centre. Scroll stays
 * the single source of truth either way — clicks just move the scroll position.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";

const MOBILE_QUERY = "(max-width: 960px)";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface Options {
  /** The tall sticky scroll track (.dl-workflow__scroll), measured on desktop. */
  trackRef: RefObject<HTMLElement | null>;
  /** Refs to each stacked card, used only on the mobile path. */
  cardRefs: RefObject<(HTMLElement | null)[]>;
  stepCount: number;
  /**
   * Desktop-only relative dwell per step (length === stepCount). Each step holds a
   * slice of the scroll track proportional to its weight; omit or pass all-1 for
   * perfectly even bands. (Mobile is card-driven, so weights don't apply there.)
   */
  stepWeights?: number[];
}

export function useWorkflowStep({ trackRef, cardRefs, stepCount, stepWeights }: Options) {
  const [activeStep, setActiveStep] = useState(0);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );

  // Mirror activeStep in a ref so scrollToStep can short-circuit a tap on the current
  // step without taking `activeStep` as a dep (which would change its identity every
  // step and defeat the memoized cards/step-nav).
  const activeStepRef = useRef(activeStep);
  activeStepRef.current = activeStep;

  // Track viewport mode so we can swap scroll strategies without a full remount.
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Upper progress bound of each step, derived from the per-step dwell weights
  // (defaults to even bands when no weights are given). Memoized so both the scroll
  // effect and scrollToStep share one definition. With all weights === 1 this
  // reproduces the old Math.floor(progress * stepCount) equal-band behaviour exactly.
  const bounds = useMemo(() => {
    const weights =
      stepWeights && stepWeights.length === stepCount
        ? stepWeights
        : Array.from({ length: stepCount }, () => 1);
    const totalWeight = weights.reduce((a, w) => a + w, 0);
    let acc = 0;
    return weights.map((w) => (acc += w) / totalWeight); // ascending, last === 1
  }, [stepWeights, stepCount]);

  // Desktop: scroll progress over the sticky scroll track → step band.
  useEffect(() => {
    if (isMobile) return;
    const track = trackRef.current;
    if (!track) return;

    let raf = 0;
    const measure = () => {
      raf = 0;
      const rect = track.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      if (total <= 0) {
        setActiveStep(0);
        return;
      }
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      const progress = scrolled / total;
      // First band whose upper bound the progress hasn't passed; the final step
      // holds through the tail of the scroll (progress === 1 falls through to it).
      let step = stepCount - 1;
      for (let i = 0; i < stepCount; i++) {
        if (progress < bounds[i]) {
          step = i;
          break;
        }
      }
      setActiveStep((prev) => (prev === step ? prev : step));
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [isMobile, trackRef, stepCount, bounds]);

  // Mobile: the highest stacked card crossing the viewport's centre band wins.
  useEffect(() => {
    if (!isMobile) return;
    const cards = cardRefs.current?.filter(Boolean) as HTMLElement[] | undefined;
    if (!cards || cards.length === 0) return;

    const visible = new Set<number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = Number((entry.target as HTMLElement).dataset.stepIndex);
          if (Number.isNaN(idx)) continue;
          if (entry.isIntersecting) visible.add(idx);
          else visible.delete(idx);
        }
        if (visible.size > 0) {
          const next = Math.max(...visible);
          setActiveStep((prev) => (prev === next ? prev : next));
        }
      },
      // Thin activation band across the vertical middle of the viewport.
      { rootMargin: "-42% 0px -42% 0px", threshold: 0 },
    );
    cards.forEach((card) => io.observe(card));
    return () => io.disconnect();
  }, [isMobile, cardRefs, stepCount]);

  // Walk the flow to step `i` from a click/tap. Scroll stays the source of truth:
  // on desktop we scroll the window to the middle of that step's band on the pinned
  // track (the scroll handler then sets activeStep); on mobile we bring the stacked
  // card to centre. Honours reduced-motion (jumps instead of smooth-scrolling).
  const scrollToStep = useCallback(
    (i: number) => {
      // Tapping the step you're already on should do nothing — otherwise it snaps the
      // free-scrolled position to the band midpoint, which reads as a jiggle.
      if (i === activeStepRef.current) return;
      const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";

      if (isMobile) {
        cardRefs.current?.[i]?.scrollIntoView({ behavior, block: "center" });
        return;
      }

      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      if (total <= 0) return;
      // Midpoint of band i (lower bound = previous band's upper bound, or 0).
      const lower = i === 0 ? 0 : bounds[i - 1];
      const upper = bounds[i];
      const progress = (lower + upper) / 2;
      // To land progress P we need the track top at -(P*total) in the viewport, i.e.
      // scroll to currentScrollY + rect.top + P*total. Native smooth scroll keeps the
      // active step updating live as it passes each band (a brief "walk through the
      // flow"), and the user can interrupt it at any time.
      const top = window.scrollY + rect.top + progress * total;
      window.scrollTo({ top, behavior });
    },
    [isMobile, cardRefs, trackRef, bounds],
  );

  return { activeStep, isMobile, scrollToStep };
}

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
 */

import { useEffect, useState, type RefObject } from "react";

const MOBILE_QUERY = "(max-width: 960px)";

interface Options {
  /** The tall sticky scroll track (.dl-workflow__scroll), measured on desktop. */
  trackRef: RefObject<HTMLElement | null>;
  /** Refs to each stacked card, used only on the mobile path. */
  cardRefs: RefObject<(HTMLElement | null)[]>;
  stepCount: number;
}

export function useWorkflowStep({ trackRef, cardRefs, stepCount }: Options) {
  const [activeStep, setActiveStep] = useState(0);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );

  // Track viewport mode so we can swap scroll strategies without a full remount.
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

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
      // Equal bands; clamp so the final step holds through the tail of the scroll.
      const step = Math.min(stepCount - 1, Math.floor(progress * stepCount));
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
  }, [isMobile, trackRef, stepCount]);

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

  return { activeStep, isMobile };
}

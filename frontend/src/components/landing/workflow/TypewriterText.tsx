/*
 * TypewriterText — types `text` out one character at a time. A soft caret blinks
 * while typing and disappears once the line is complete.
 *
 * Triggering:
 *   - By default (`start` omitted) it types on mount and restarts whenever `text`
 *     changes — used by the per-step narration.
 *   - Pass `start={false}` to hold it empty until something flips it true (e.g. the
 *     header scrolling into view), so the line "types in" on scroll. `startDelay`
 *     waits before the first character, used to sequence the title then the sub.
 *
 * Reduced motion: when the user prefers reduced motion we skip the animation
 * entirely and render the full line immediately (once started) with no caret.
 */

import { useEffect, useRef, useState } from "react";

interface Props {
  text: string;
  /** ms between characters. */
  speed?: number;
  className?: string;
  /** Hold empty until true, then type once. Defaults to true (type on mount). */
  start?: boolean;
  /** ms to wait after `start` is true before the first character (for sequencing). */
  startDelay?: number;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function TypewriterText({
  text,
  speed = 24,
  className,
  start = true,
  startDelay = 0,
}: Props) {
  // Start empty whenever we will animate, so a remount (e.g. the narration's
  // key={activeStep}) never paints the full line for one frame before typing — that
  // flash read as a per-step stutter. Reduced motion still shows the line instantly.
  const [shown, setShown] = useState(() =>
    start && prefersReducedMotion() ? text : "",
  );
  const [typing, setTyping] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    clear();

    if (!start) {
      setShown("");
      setTyping(false);
      return;
    }

    if (prefersReducedMotion()) {
      setShown(text);
      setTyping(false);
      return;
    }

    let i = 0;
    setShown("");
    const begin = () => {
      setTyping(true);
      const tick = () => {
        i += 1;
        setShown(text.slice(0, i));
        if (i >= text.length) {
          setTyping(false);
          return;
        }
        timers.current.push(window.setTimeout(tick, speed));
      };
      timers.current.push(window.setTimeout(tick, speed));
    };
    timers.current.push(window.setTimeout(begin, startDelay));

    return clear;
  }, [text, speed, start, startDelay]);

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden="true">{shown}</span>
      <span
        className={`dl-wf-caret${typing ? " is-typing" : ""}`}
        aria-hidden="true"
      />
    </span>
  );
}

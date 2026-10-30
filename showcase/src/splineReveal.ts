import { useCallback, useState } from "react";

/*
 * useStableSplineReveal — the one stable loading gate shared by every lazy Spline
 * vault (landing hero + /login + /signup). It keeps `loaded` false (so the canvas
 * stays opacity:0 and a static poster covers the slot) until the scene's onLoad
 * has fired AND two animation frames + a short settle delay have elapsed.
 *
 * The double-rAF + delay is the load-bearing part: revealing in the same tick as
 * onLoad exposes the scene's first, unstable WebGL frame (and the dark clear
 * colour for one frame) — the "incomplete render / white flash" the poster exists
 * to hide. Deferring lets the transparent clear paint and the figure settle, so
 * the crossfade only ever shows a finished frame.
 *
 * Failure model (deliberate): the poster IS the premium terminal state. So there
 * is no timeout that "reveals anyway" and no error handler that flips `loaded` —
 * if the scene errors, is blocked, or is slow, onLoad simply never fires, `loaded`
 * stays false, and the frozen poster keeps covering the slot. A blank/failed
 * canvas is never shown (this is also why an aborted scene no longer blanks the
 * hero). Pass `onError` as a no-op so the runtime can't surface an unhandled error.
 */
export function useStableSplineReveal(opts?: { settleMs?: number }) {
  const settleMs = opts?.settleMs ?? 200;
  const [loaded, setLoaded] = useState(false);

  const reveal = useCallback(() => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.setTimeout(() => setLoaded(true), settleMs);
      }),
    );
  }, [settleMs]);

  return { loaded, reveal };
}

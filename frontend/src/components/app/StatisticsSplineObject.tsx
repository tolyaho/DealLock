/*
 * StatisticsSplineObject — the LIVE Spline "statistics" object (a circular silver
 * medallion) for the Statistics empty state. Exported from Spline (Code Export →
 * React) and embedded with @splinetool/react-spline (NOT react-three-fiber).
 *
 * Rendered as JUST the circular object on a TRANSPARENT canvas — no square plate,
 * no backing, no hard crop. Centered above the empty-state title, ~168px desktop /
 * ~124px mobile (1:1 footprint, proportions preserved). It's softly blended into
 * the silver page: a faint pearl glow behind it, a soft circular drop-shadow that
 * follows the coin's silhouette (not a rectangle), a whisper of edge glow, and a
 * touch of transparency — so it merges with the UI instead of looking pasted on.
 * pointer-events:none (never blocks the CTA). The scene animation autoplays.
 *
 * The canvas clear colour is forced transparent on load (setBackgroundColor) so no
 * pale square shows even if the scene still carries one.
 *
 * Robustness:
 * - lazy-loaded so the Spline runtime stays out of the main bundle,
 * - a FIXED-size box, so there is no layout shift while it streams in,
 * - a subtle silver glow fallback shown until the scene reports `onLoad`.
 */
import { lazy, Suspense, useState } from "react";
import type { Application } from "@splinetool/runtime";

const Spline = lazy(() => import("@splinetool/react-spline"));

const SCENE_URL = "https://prod.spline.design/I2TlY5dzVGdvp0vh/scene.splinecode";

export function StatisticsSplineObject() {
  const [loaded, setLoaded] = useState(false);

  const handleLoad = (app: Application) => {
    // force a transparent canvas clear so only the circular object shows
    try {
      app.setBackgroundColor("transparent");
    } catch {
      /* older runtimes — the re-exported transparent scene covers this */
    }
    setLoaded(true);
  };

  return (
    <div className="dl-spline-object" aria-hidden="true">
      <div className="dl-spline-object__object">
        {/* subtle silver glow placeholder — fades the moment the scene loads */}
        <span className="dl-spline-object__fallback" data-hidden={loaded || undefined} />
        <Suspense fallback={null}>
          <Spline scene={SCENE_URL} className="dl-spline-object__scene" onLoad={handleLoad} />
        </Suspense>
      </div>
    </div>
  );
}

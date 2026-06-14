/*
 * SectionEmblemSpline — a small, premium 3D "section emblem" (Resend-style) that
 * sits centered ABOVE a landing section's heading as a decorative intro icon. It is
 * NOT a second hero: it lives in a fixed, small square box (~132px desktop / ~100px
 * mobile) so the page never shifts as the runtime streams in, and it is purely
 * decorative — aria-hidden and pointer-events:none, so the canvas never receives
 * pointer events (no hover/orbit/zoom; a drag just scrolls the page).
 *
 * Embedded with @splinetool/react-spline on a TRANSPARENT canvas so only the object
 * shows — no square plate, no frame, no crop. The heavy runtime is code-split via
 * React.lazy so it never blocks first paint; a frosted silver placeholder holds the
 * slot until onLoad, then CROSSFADES to the live object (and unmounts) — no spinner,
 * no dark flash, no layout jump.
 *
 * Grounding lives on a `drop-shadow` filter that tracks the object's own alpha (it
 * can never detach into an offset circle the way a center-pinned glow would). The
 * clear colour is forced transparent on load so no pale square shows.
 *
 * `scale` normalizes apparent object size across scenes framed at different zooms; it
 * resizes the canvas CONTAINER (not a CSS transform), so an upscale stays sharp and
 * the wrapper footprint is unchanged (overflow is transparent, pointer-events:none).
 *
 * Accessibility: under prefers-reduced-motion we skip the WebGL scene entirely (and
 * its ~2MB download) and render a static silver medallion instead — the same policy
 * the hero vault uses.
 */
import { lazy, Suspense, useCallback, useEffect, useState, type CSSProperties } from "react";
import type { Application } from "@splinetool/runtime";

const Spline = lazy(() => import("@splinetool/react-spline"));

type SplineCamera = { zoom: number; updateProjectionMatrix?: () => void };

function usePrefersReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

interface Props {
  scene: string;
  /** Normalizes apparent object size for scenes framed at a different zoom. */
  scale?: number;
  /** <1 pulls the camera back so an edge-to-edge object gets margin inside the
   *  canvas (un-crops it) and reads a touch smaller. Same guarded path as the hero. */
  zoomOut?: number;
  /** Opt-in mild vertical bob (disabled under prefers-reduced-motion). */
  float?: boolean;
  /** Extra modifier class for per-section tuning. */
  className?: string;
}

export default function SectionEmblemSpline({ scene, scale, zoomOut, float, className }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);

  const onLoad = useCallback((app: Application) => {
    try {
      app.setBackgroundColor("transparent");
      if (zoomOut) {
        // Pull the camera back so an edge-framed object is fully visible with margin.
        const cam = (app as unknown as { _camera?: SplineCamera })._camera;
        if (cam) {
          cam.zoom *= zoomOut;
          cam.updateProjectionMatrix?.();
          app.requestRender?.();
        }
      }
    } catch {
      /* older runtimes — a transparent-exported scene covers this */
    }
    // Reveal only AFTER the transparent clear colour has painted. Setting it and
    // revealing in the same tick exposes the scene's dark WebGL clear colour for a
    // frame (a dark flash); two rAFs + a short beat let it settle, then crossfade.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.setTimeout(() => setLoaded(true), 60);
      }),
    );
  }, [zoomOut]);

  // Crossfade, then unmount the placeholder so nothing lingers/animates behind it.
  useEffect(() => {
    if (!loaded) return;
    const t = window.setTimeout(() => setShowSkeleton(false), 650);
    return () => window.clearTimeout(t);
  }, [loaded]);

  // Fallback reveal in case onLoad never fires (slow/blocked Spline).
  useEffect(() => {
    if (reducedMotion) return;
    const t = window.setTimeout(() => setLoaded(true), 9000);
    return () => window.clearTimeout(t);
  }, [reducedMotion]);

  const cls = `dl-emblem${loaded ? " is-loaded" : ""}${float ? " dl-emblem--float" : ""}${className ? ` ${className}` : ""}`;

  if (reducedMotion) {
    return (
      <div className={`dl-emblem dl-emblem--static${className ? ` ${className}` : ""}`} aria-hidden="true">
        <span className="dl-emblem__medallion" />
      </div>
    );
  }

  return (
    <div className={cls} aria-hidden="true">
      {showSkeleton && (
        <span className="dl-emblem__skeleton" data-done={loaded || undefined} />
      )}
      <div
        className="dl-emblem__object"
        style={scale ? ({ "--emblem-scale": scale } as CSSProperties) : undefined}
      >
        <Suspense fallback={null}>
          <Spline
            scene={scene}
            onLoad={onLoad}
            onError={() => setLoaded(true)}
            className="dl-emblem__canvas"
          />
        </Suspense>
      </div>
    </div>
  );
}

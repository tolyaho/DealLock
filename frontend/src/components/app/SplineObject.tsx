/*
 * SplineObject — a small, premium live Spline object for empty states. Embedded
 * with @splinetool/react-spline (NOT react-three-fiber) and rendered on a
 * TRANSPARENT canvas so only the object shows — no square plate, no hard crop, no
 * mask. Centered in a fixed 1:1 box (~168px desktop / ~120px mobile) so there's no
 * layout shift while the runtime streams in. pointer-events:none so it never blocks
 * the CTA. The scene animation autoplays.
 *
 * Loading: the react-spline runtime is a ~2MB lazy chunk, so there's a real wait
 * before the scene paints. A beautiful silver loader (a brushed pearl medallion with
 * a specular arc sweeping its rim) fills the box from the first frame and stays until
 * `onLoad`. On load it CROSSFADES to the live object (loader fades out while the
 * object fades in) and is then UNMOUNTED, so only the live canvas layer remains — no
 * lingering glow behind the object.
 *
 * IMPORTANT — no center-pinned glows on the OBJECT. Spline scenes don't frame their
 * object dead-centre, so a glow pinned to the box centre would read as a detached
 * circle offset to one side. The object's grounding lives on a `drop-shadow` filter
 * that tracks its own alpha (see app.css) and can never detach. (A centred loader is
 * fine — it's only ever shown alone, before the object exists.)
 *
 * The canvas clear colour is forced transparent on load (setBackgroundColor) so no
 * pale square shows even if a scene still carries one.
 *
 * `scale` normalizes APPARENT object size across scenes that frame their object at
 * different zooms (e.g. the Messages bubble sits tiny in its canvas while the coin
 * fills it). It resizes the canvas CONTAINER (not a CSS transform), so the object
 * grows/shrinks relative to the fixed wrapper while the canvas still renders at native
 * resolution — i.e. an upscale stays sharp. The wrapper footprint is unchanged (the
 * extra canvas overflows transparently, pointer-events:none), so layout is untouched.
 *
 * `zoomOut` (<1) pulls the scene's CAMERA back to leave margin INSIDE the canvas. Some
 * scenes frame the object edge-to-edge (e.g. the wallet fills ~98% of frame) and a
 * baked float/bob animation then clips against the canvas viewport — container `scale`
 * can't fix that (the object keeps the same fraction of the canvas). Zooming the
 * camera out gives the animation room; pair it with a larger `scale` to keep apparent
 * size. Uses the same guarded `_camera.zoom` path as HeroVaultSpline.
 */
import { lazy, Suspense, useEffect, useState, type CSSProperties } from "react";
import type { Application } from "@splinetool/runtime";

const Spline = lazy(() => import("@splinetool/react-spline"));

type SplineCamera = { zoom: number; updateProjectionMatrix?: () => void };

interface Props {
  scene: string;
  scale?: number;
  zoomOut?: number;
  /** Opt-in mild floating drift for scenes whose object is otherwise static. */
  float?: boolean;
}

export function SplineObject({ scene, scale, zoomOut, float }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [showLoader, setShowLoader] = useState(true);

  const handleLoad = (app: Application) => {
    try {
      app.setBackgroundColor("transparent");
      if (zoomOut) {
        // Pull the camera back so a baked float/bob animation has room and never
        // clips against the canvas edge. Guarded — runtime internals must never throw.
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
    // frame (an ugly dark flash); two rAFs + a short beat let it settle first, so the
    // loader holds until the object is genuinely ready, then crossfades cleanly.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.setTimeout(() => setLoaded(true), 60);
      }),
    );
  };

  // Crossfade, then unmount the loader so no static layer lingers behind the object.
  // 480ms > the 320ms (--dur-4) fade, so the loader is fully transparent before it goes.
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => setShowLoader(false), 480);
    return () => clearTimeout(t);
  }, [loaded]);

  return (
    <div
      className={`dl-spline-object${loaded ? " is-loaded" : ""}${float ? " dl-spline-object--float" : ""}`}
      aria-hidden="true"
      style={scale ? ({ "--spline-scale": scale } as CSSProperties) : undefined}
    >
      {showLoader && (
        <span className="dl-spline-object__loader" data-done={loaded || undefined}>
          <span className="dl-spline-object__loader-ring" />
        </span>
      )}
      <div className="dl-spline-object__object">
        <Suspense fallback={null}>
          <Spline scene={scene} className="dl-spline-object__scene" onLoad={handleLoad} />
        </Suspense>
      </div>
    </div>
  );
}

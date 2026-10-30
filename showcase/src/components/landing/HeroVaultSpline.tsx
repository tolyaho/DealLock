/*
 * HeroVaultSpline — the interactive Spline "circular glass vault" that is the
 * hero's right-side visual. The COMPLETE Spline figure is shown as designed —
 * the circular glass vault together with its own metal/glass plate/frame. The
 * plate is part of the 3D scene, not a CSS element: the canvas is transparent
 * and never clipped (overflow stays visible), so the full object reads against
 * the matte wall with no extra card or fake backing rectangle. The plate is made
 * visible by pulling the camera back in onLoad (see TARGET_ZOOM), not by CSS.
 *
 * Interaction model: camera orbit/pan/zoom stay DISABLED (a scene-export setting,
 * not CSS) — a drag/touch can never rotate the vault and instead scrolls the page.
 * But the lock/ring DO respond to hover and click, because the published scene
 * already authors object-level events (mouseHover / mouseDown / mouseUp on the
 * lock + a dedicated `vault_hover_hit_area`). Those only fire once the canvas
 * actually receives pointer events — which is why `.dl-spline-vault` is
 * pointer-events:auto and nothing is layered above the canvas with hit-testing on.
 *
 * On top of the scene's own reactions we add a light DOM garnish the 3D scene
 * can't do: a subtle hover lift + glow (pure CSS :hover), and on click a circular
 * "seal" pulse plus a "Funds locked" status hint. All of those overlays are
 * pointer-events:none, so they never block a click reaching the canvas.
 *
 * The heavy @splinetool runtime is code-split via React.lazy so it never blocks
 * first paint; a soft glass placeholder holds the (fixed, square) container until
 * the scene is ready, so there is no layout shift. Sizing is owned by the
 * surrounding `.dl-vault-wrap--spline` CSS, not by the canvas.
 *
 * Accessibility & fallback: the visual is decorative (the headline carries the
 * meaning), so the wrapper is aria-hidden by its parent. A static JPG still of the
 * real vault (`assets/hero-vault-poster.jpg`) is the base layer: it holds the slot
 * during load and remains as the graceful fallback if the scene errors or never
 * settles — so a blocked CDN / disabled WebGL never shows a blank or a "Loading…"
 * that sticks. Under `prefers-reduced-motion: reduce` we render that still ALONE and
 * never mount the WebGL scene (no motion, no runtime download). Otherwise the live
 * Spline crossfades over the still once it has settled. (The old hand-drawn SVG
 * stand-in was removed — it read as a canister, not a vault.)
 */

import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import type { Application } from "@splinetool/runtime";
import heroVaultPoster from "../../assets/hero-vault-poster.jpg";
import { SPLINE_SCENES } from "../../splineScenes";
import { useStableSplineReveal } from "../../splineReveal";
import SplineBoundary from "../SplineBoundary";

const Spline = lazy(() => import("@splinetool/react-spline"));

const SCENE_URL = SPLINE_SCENES.heroVault;

/*
 * The published scene's camera frames the figure so its square metal/glass plate
 * bleeds past the canvas edges — only the circular vault disc shows. Spline's
 * public setZoom() clamps before the whole plate clears the frame, so we set the
 * perspective camera's zoom directly to pull the camera back far enough that the
 * COMPLETE figure (vault disc + plate + luminous frame + corner screws) sits in
 * the matte wall with breathing room. Lower = further back / smaller figure;
 * raise toward ~0.12 to fill more of the column.
 */
const TARGET_ZOOM = 0.088;

/*
 * Calm the plate's luminous frame/glow so it reads as a MATTE object recessed into
 * the wall niche rather than a lit panel sitting on top. The frame stays visible —
 * just dimmed. Values are absolute target alphas (not multipliers) so applying this
 * on both the initial load and the re-assert is idempotent. Raise toward the scene
 * defaults (frame ~0.8, panel 1) for more glow; lower toward 0 for fully matte.
 */
const PLATE_GLOW: Record<string, number> = {
  inner_luminous_frame: 0.45,
  inner_glow_panel: 0.5,
};

type SplineCamera = { zoom: number; updateProjectionMatrix?: () => void };

function frameFullFigure(app: Application) {
  try {
    // Clear any background plane baked into the scene so the figure sits directly
    // on the CSS matte wall — no opaque square behind it.
    app.setBackgroundColor("transparent");
    const cam = (app as unknown as { _camera?: SplineCamera })._camera;
    if (cam) {
      cam.zoom = TARGET_ZOOM;
      cam.updateProjectionMatrix?.();
    } else {
      // Internals changed in a future runtime: best-effort public fallback
      // (clamped, so the plate may still bleed — adjust via a Spline re-export).
      app.setZoom(0.5);
    }
    // Tone down the glow elements (guarded per-object; missing names are skipped).
    for (const [name, alpha] of Object.entries(PLATE_GLOW)) {
      const obj = app.findObjectByName(name);
      if (obj?.material) obj.material.alpha = alpha;
    }
    app.requestRender?.();
  } catch {
    // Runtime API drift must never break the hero — fall back to default framing.
  }
}

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

export default function HeroVaultSpline() {
  const reducedMotion = usePrefersReducedMotion();
  const [sealed, setSealed] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  // The static vault poster (a still of the real scene) holds the slot during load
  // and IS the graceful fallback: the live Spline crossfades over it when motion is
  // allowed and the scene settles; otherwise the poster stays. Under
  // prefers-reduced-motion we render the poster alone — no WebGL, no animation.
  const { loaded, reveal } = useStableSplineReveal();

  const onSplineLoad = useCallback(
    (app: Application) => {
      frameFullFigure(app);
      // Re-assert once in case the scene runs an intro camera transition on start.
      window.setTimeout(() => frameFullFigure(app), 600);
      // Reveal only after the transparent clear colour has painted and the figure
      // has settled — the poster covers every frame until then.
      reveal();
    },
    [reveal],
  );

  // Click TOGGLES the vault seal: seal → unseal → seal. The scene plays its own
  // authored lock animation; we add the DOM-only confirmation the 3D scene can't
  // render (pulse ring + a "Funds locked" status hint that fades back out when
  // the vault is clicked again). Each click pulses as tactile click feedback.
  const handleSeal = useCallback(() => {
    setSealed((s) => !s);
    setPulseKey((k) => k + 1);
  }, []);

  // Reduced-motion: render the still poster alone — never mount the WebGL scene.
  if (reducedMotion) {
    return (
      <div className="dl-spline-vault dl-spline-vault--static">
        <img className="dl-spline-vault__poster-img" src={heroVaultPoster} alt="" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      className={`dl-spline-vault${sealed ? " is-sealed" : ""}${loaded ? " is-loaded" : ""}`}
      onClick={handleSeal}
    >
      {/* Static poster — a still of the real vault. Holds the slot during load and
          stays as the graceful fallback if the scene errors or never settles. */}
      <div className="dl-spline-vault__poster" aria-hidden="true">
        <img className="dl-spline-vault__poster-img" src={heroVaultPoster} alt="" />
      </div>

      {/* The scene can throw (via a rejected Suspense promise) if its CDN is blocked/
          slow or WebGL is unavailable. The boundary catches that so the static poster
          (sibling, above) stays put instead of the whole app unmounting (white screen). */}
      <SplineBoundary>
        <Suspense fallback={null}>
          <Spline
            scene={SCENE_URL}
            onLoad={onSplineLoad}
            // On error keep the quiet poster rather than a blank/failed canvas.
            onError={() => {}}
            className="dl-spline-vault__canvas"
          />
        </Suspense>
      </SplineBoundary>

      <div className="dl-spline-vault__fx" aria-hidden="true">
        <span className="dl-spline-vault__glow" />
        <span
          key={pulseKey}
          className={`dl-spline-vault__pulse${pulseKey > 0 ? " is-active" : ""}`}
        />
        <span className="dl-spline-vault__status">Funds locked</span>
      </div>
    </div>
  );
}

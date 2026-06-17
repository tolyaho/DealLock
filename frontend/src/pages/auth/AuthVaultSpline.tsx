/*
 * AuthVaultSpline — the DealLock safe, mounted into the auth scene as a physical
 * module (not a floating decoration). It renders its own dedicated scene
 * (SPLINE_SCENES.authVault — the metallic safe) and is fully passive here:
 *   - pointer-events:none (set in CSS on the wrapper) so it never steals a click
 *     and never orbits/zooms — a drag scrolls the page.
 *   - transparent canvas, clamped by the recessed plate (CSS) so it can never
 *     paint a background slab outside its mount.
 *   - the square footprint is reserved before load (aspect-ratio in CSS), so the
 *     form never shifts; the canvas fades in on load — no spinner.
 *   - under prefers-reduced-motion we render the static VaultObject SVG and never
 *     download the WebGL runtime.
 *
 * Framing is left at the scene's authored camera (this scene is composed to sit
 * centred on its own) — we only clear the baked background to transparent so the
 * safe reads against the CSS recess rather than an opaque square, and re-assert
 * that once after the intro settles. The @splinetool runtime is code-split so it
 * never blocks the auth form's paint.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import type { Application } from "@splinetool/runtime";
import VaultObject from "../../components/landing/VaultObject";
import { SPLINE_SCENES } from "../../splineScenes";
import { useStableSplineReveal } from "../../splineReveal";

const Spline = lazy(() => import("@splinetool/react-spline"));

function clearBackground(app: Application) {
  try {
    // Drop any background plane baked into the scene so the safe sits directly on
    // the CSS recess — no opaque/black square behind it.
    app.setBackgroundColor("transparent");
    app.requestRender?.();
  } catch {
    /* runtime API drift must never break the auth scene */
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

export default function AuthVaultSpline() {
  const reducedMotion = usePrefersReducedMotion();
  // Same stable gate as the landing hero: the static poster covers the slot until
  // the scene has loaded and rendered a stable frame, then the canvas crossfades
  // in (see useStableSplineReveal + .dl-auth-vault__poster in auth.css).
  const { loaded, reveal } = useStableSplineReveal();

  const onLoad = useCallback(
    (app: Application) => {
      clearBackground(app);
      // Re-assert once the scene's intro has settled, in case it repaints a bg.
      window.setTimeout(() => clearBackground(app), 600);
      reveal();
    },
    [reveal],
  );

  if (reducedMotion) {
    return (
      <div className="dl-auth-vault dl-auth-vault--static">
        <div className="dl-auth-vault__svg">
          <VaultObject />
        </div>
      </div>
    );
  }

  return (
    <div className={`dl-auth-vault${loaded ? " is-loaded" : ""}`}>
      {/* simple loading state — a quiet "Loading secure vault…" label; no backup
       *  sculpture, no orb. Holds the slot then fades out under the live canvas. */}
      <div className="dl-auth-vault__poster" aria-hidden="true">
        <span className="dl-auth-vault__loadlabel">Loading secure vault…</span>
      </div>
      <Suspense fallback={null}>
        <Spline
          scene={SPLINE_SCENES.authVault}
          onLoad={onLoad}
          // On error keep the poster: never flip to a blank/failed canvas.
          onError={() => {}}
          className="dl-auth-vault__canvas"
        />
      </Suspense>
    </div>
  );
}

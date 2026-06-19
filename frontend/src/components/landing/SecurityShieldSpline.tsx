/*
 * SecurityShieldSpline — the small 3D shield emblem above the Security section
 * heading. A thin wrapper around the shared SectionEmblemSpline (all the loading,
 * fade-in, transparent-canvas, reduced-motion and decorative behaviour lives there).
 */
import SectionEmblemSpline from "./SectionEmblemSpline";
import { SPLINE_SCENES } from "../../splineScenes";
import { useMediaQuery } from "./useMediaQuery";

export default function SecurityShieldSpline() {
  // The emblem box shrinks to ~64–80px on phones, where the shield's tight scene
  // framing lets its bottom tip touch (and clip against) the square canvas edge.
  // Pull the camera back harder on phones so the shield keeps a margin all around;
  // desktop framing is unchanged.
  const isPhone = useMediaQuery("(max-width: 767px)");
  return (
    <SectionEmblemSpline
      scene={SPLINE_SCENES.securityShield}
      zoomOut={isPhone ? 0.62 : 0.8}
      float
    />
  );
}

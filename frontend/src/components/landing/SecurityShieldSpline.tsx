/*
 * SecurityShieldSpline — the small 3D shield emblem above the Security section
 * heading. A thin wrapper around the shared SectionEmblemSpline (all the loading,
 * fade-in, transparent-canvas, reduced-motion and decorative behaviour lives there).
 */
import SectionEmblemSpline from "./SectionEmblemSpline";
import { SPLINE_SCENES } from "../../splineScenes";

export default function SecurityShieldSpline() {
  return <SectionEmblemSpline scene={SPLINE_SCENES.securityShield} zoomOut={0.8} float />;
}

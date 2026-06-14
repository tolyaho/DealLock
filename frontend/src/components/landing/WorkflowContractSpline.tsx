/*
 * WorkflowContractSpline — the small 3D connected-contract emblem above the Workflow
 * section heading. A thin wrapper around the shared SectionEmblemSpline, matching the
 * Security shield in scale and treatment (loading, fade-in, transparent canvas,
 * reduced-motion and decorative behaviour all live in the shared component).
 */
import SectionEmblemSpline from "./SectionEmblemSpline";
import { SPLINE_SCENES } from "../../splineScenes";

export default function WorkflowContractSpline() {
  return <SectionEmblemSpline scene={SPLINE_SCENES.workflowContract} zoomOut={0.8} float />;
}

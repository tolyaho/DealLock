/*
 * WorkflowContractStage — the anchored centre of the workflow scene. Two layers:
 *
 *   z-0  a CSS "material" plate (.dl-contract-stage__material) — a polished metal/
 *        glass slab rendered purely in CSS. It sits BEHIND the readable card and is
 *        a touch larger, so its lit edges + sheen frame the text like a mounting
 *        plate. Pure CSS so it is always perfectly centred behind the card, never
 *        drifts across screen sizes, and renders identically everywhere (no WebGL).
 *   z-1  the readable contract UI (ContractCardOverlay), opaque HTML/CSS so the text
 *        stays crisp and updates instantly per scroll step.
 *
 * (This replaced a Spline 3D object whose framing was derived from the canvas size
 * at mount, so it drifted out from behind the card at window sizes other than the
 * one it was tuned at. The CSS plate carries the same material read without that
 * fragility.) The stage is aria-hidden: the surrounding action cards carry the
 * accessible narrative.
 */

import { memo } from "react";
import ContractCardOverlay from "./ContractCardOverlay";

interface Props {
  activeStep: number;
}

function WorkflowContractStage({ activeStep }: Props) {
  return (
    <div className="dl-contract-stage" aria-hidden="true">
      <div className="dl-contract-stage__material" />
      <ContractCardOverlay activeStep={activeStep} />
    </div>
  );
}

// Memoized on `activeStep`: the central card (and its perpetual float) re-renders
// only when the step changes, never when the sibling narration types out a line.
export default memo(WorkflowContractStage);

/*
 * WorkflowContractStage — the anchored centre of the workflow scene. It's just the
 * readable contract UI (ContractCardOverlay) presented as a self-contained floating
 * instrument: opaque HTML/CSS so the text stays crisp and updates per scroll step,
 * lifted off the matte wall by its own shadow plus the stage's ambient halo
 * (.dl-contract-stage::before) and floor reflection (.dl-contract-stage::after).
 *
 * (Earlier versions sat the card on a CSS "material" plate, which itself replaced a
 * drifting Spline slab; the plate was removed — the card now reads as the object,
 * bigger and unframed.) The stage is aria-hidden: the surrounding action cards carry
 * the accessible narrative.
 */

import { memo } from "react";
import ContractCardOverlay from "./ContractCardOverlay";

interface Props {
  activeStep: number;
}

function WorkflowContractStage({ activeStep }: Props) {
  return (
    <div className="dl-contract-stage" aria-hidden="true">
      <ContractCardOverlay activeStep={activeStep} />
    </div>
  );
}

// Memoized on `activeStep`: the central card (and its perpetual float) re-renders
// only when the step changes, never when the sibling narration types out a line.
export default memo(WorkflowContractStage);

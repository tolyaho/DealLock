/*
 * EmptyStateStage — the large frosted-silver "product moment" panel for a page
 * with no data yet. A centered metal object (SplineObjectSlot), a confident
 * title, one calm line of copy, and a clear primary CTA (+ optional secondary).
 *
 * It is deliberately spacious — the blank space is intentional, not unfinished.
 * Actions route via the router when given a `to`, so the empty state is a real
 * way forward, not a dead end.
 */
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./Button";
import { SplineObjectSlot, type SplineSlotType } from "./SplineObjectSlot";

export interface StageAction {
  label: string;
  /** in-app route to navigate to on activate */
  to?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
}

interface Props {
  splineType: SplineSlotType;
  title: string;
  description: string;
  primaryAction?: StageAction;
  secondaryAction?: StageAction;
  slotSize?: "md" | "lg";
  /** a custom centered object (e.g. a live Spline scene). When given, it renders
   *  in place of the static SplineObjectSlot placeholder. */
  object?: ReactNode;
}

export function EmptyStateStage({
  splineType,
  title,
  description,
  primaryAction,
  secondaryAction,
  slotSize = "lg",
  object,
}: Props) {
  const navigate = useNavigate();
  const run = (a: StageAction) => () => {
    a.onClick?.();
    if (a.to) navigate(a.to);
  };

  return (
    <section className="dl-stage">
      {object ?? <SplineObjectSlot type={splineType} size={slotSize} />}
      <h2 className="dl-stage__title">{title}</h2>
      <p className="dl-stage__text">{description}</p>
      {(primaryAction || secondaryAction) && (
        <div className="dl-stage__actions">
          {primaryAction && (
            <Button variant="primary" icon={primaryAction.icon} onClick={run(primaryAction)}>
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="ghost" icon={secondaryAction.icon} onClick={run(secondaryAction)}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

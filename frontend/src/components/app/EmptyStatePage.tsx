/*
 * EmptyStatePage — the one-call composition for a polished "no data yet" screen:
 * PageContainer (with the calm data-surface atmosphere) → PageHeader (title +
 * subtitle, optional right-aligned action) → optional PageToolbar → the large
 * EmptyStateStage. Pages pass copy + a Spline concept; role-aware wording is
 * resolved at the call site so this stays presentational.
 */
import type { ReactNode } from "react";
import { PageContainer } from "./PageContainer";
import { PageHeader } from "./PageHeader";
import { EmptyStateStage, type StageAction } from "./EmptyStateStage";
import type { SplineSlotType } from "./SplineObjectSlot";

interface Props {
  eyebrow?: string;
  title: string;
  subtitle: ReactNode;
  /** optional right-aligned header action (kept rare — the stage owns the CTA) */
  headerActions?: ReactNode;
  /** compact control strip (a <PageToolbar/>) shown above the stage */
  toolbar?: ReactNode;
  splineType: SplineSlotType;
  emptyTitle: string;
  emptyDescription: string;
  primaryAction?: StageAction;
  secondaryAction?: StageAction;
  /** custom centered object (e.g. a live Spline scene) in place of the placeholder */
  object?: ReactNode;
}

export function EmptyStatePage({
  eyebrow,
  title,
  subtitle,
  headerActions,
  toolbar,
  splineType,
  emptyTitle,
  emptyDescription,
  primaryAction,
  secondaryAction,
  object,
}: Props) {
  return (
    <PageContainer className="app-page--atmos app-page--fill">
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} actions={headerActions} />
      {toolbar}
      <EmptyStateStage
        splineType={splineType}
        title={emptyTitle}
        description={emptyDescription}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
        object={object}
      />
    </PageContainer>
  );
}

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
import { StageSkeleton, usePageLoading } from "./Skeleton";

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
  // While loading, the stage shows a skeleton; once it resolves with no data we
  // fall through to the polished empty state (never a skeleton forever).
  const loading = usePageLoading();
  return (
    <PageContainer className="app-page--atmos app-page--fill">
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} actions={headerActions} />
      {toolbar}
      {loading ? (
        // display:contents keeps .dl-stage a flow child of .app-page so the
        // --fill flex-grow still applies (no shift when it swaps to the stage)
        <div aria-busy="true" style={{ display: "contents" }}>
          <StageSkeleton />
        </div>
      ) : (
        <EmptyStateStage
          splineType={splineType}
          title={emptyTitle}
          description={emptyDescription}
          primaryAction={primaryAction}
          secondaryAction={secondaryAction}
          object={object}
        />
      )}
    </PageContainer>
  );
}

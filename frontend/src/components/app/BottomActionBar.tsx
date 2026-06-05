/*
 * BottomActionBar — a frosted, sticky bar pinned to the bottom of the page
 * scroll region for commit-style actions (e.g. an agreement's accept / fund
 * step). Optional left-side summary (label · value); actions on the right.
 * PageContainer reserves bottom padding when a page renders one.
 */
import type { ReactNode } from "react";

interface Props {
  label?: string;
  value?: ReactNode;
  children: ReactNode;
}

export function BottomActionBar({ label, value, children }: Props) {
  return (
    <div className="dl-actionbar" role="region" aria-label="Page actions">
      {(label || value != null) && (
        <div className="dl-actionbar__info">
          {label && <span className="dl-actionbar__label">{label}</span>}
          {value != null && <span className="dl-actionbar__value">{value}</span>}
        </div>
      )}
      <div className="dl-actionbar__actions">{children}</div>
    </div>
  );
}

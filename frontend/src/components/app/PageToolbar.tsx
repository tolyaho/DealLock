/*
 * PageToolbar — the compact control strip that sits between a PageHeader and the
 * page body (reuses the shared `.dl-toolbar` console module). `filters` go left
 * (segmented control / filter chips), `end` goes right (search, counts). On an
 * empty page these are honest forward-looking placeholders: they communicate
 * what the page will let you do, without pretending to have data.
 */
import type { ReactNode } from "react";

interface Props {
  /** left cluster — segmented filters / category chips */
  filters?: ReactNode;
  /** right cluster — search field, counts */
  end?: ReactNode;
}

export function PageToolbar({ filters, end }: Props) {
  return (
    <div className="dl-toolbar">
      {filters && <div className="dl-toolbar__filters">{filters}</div>}
      {end && <div className="dl-toolbar__end">{end}</div>}
    </div>
  );
}

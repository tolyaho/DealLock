/*
 * EmptyState — object-like, never a bare placeholder. A brushed-metal medallion
 * holding an icon, a title, a calm explanation, and an optional action. Used for
 * "nothing here yet" and honest "coming soon" states.
 */
import type { ReactNode } from "react";

interface Props {
  /** brushed-metal medallion glyph — used when no `object` is provided */
  icon?: ReactNode;
  /** a custom centered object (e.g. a live <SplineObject/>) shown above the title in
   *  place of the medallion — matches the EmptyStateStage `object` slot. It brings its
   *  own 1:1 footprint, so no extra sizing is needed here. */
  object?: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}

export function EmptyState({ icon, object, title, text, action }: Props) {
  return (
    <div className="dl-empty">
      {object
        ? object
        : icon && (
            <div className="dl-empty__icon" aria-hidden="true">
              {icon}
            </div>
          )}
      <div className="dl-empty__title">{title}</div>
      <p className="dl-empty__text">{text}</p>
      {action && <div className="dl-empty__action">{action}</div>}
    </div>
  );
}

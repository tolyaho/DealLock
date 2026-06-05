/*
 * EmptyState — object-like, never a bare placeholder. A brushed-metal medallion
 * holding an icon, a title, a calm explanation, and an optional action. Used for
 * "nothing here yet" and honest "coming soon" states.
 */
import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, text, action }: Props) {
  return (
    <div className="dl-empty">
      <div className="dl-empty__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="dl-empty__title">{title}</div>
      <p className="dl-empty__text">{text}</p>
      {action && <div className="dl-empty__action">{action}</div>}
    </div>
  );
}

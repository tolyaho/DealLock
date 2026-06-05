/*
 * PageHeader — the top of every page: optional mono eyebrow, the page title
 * (Inter semibold — NOT the display serif; titles are frequent, so they stay
 * machine-grade UI), an optional subtitle, and right-aligned actions.
 */
import type { ReactNode } from "react";

interface Props {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: Props) {
  return (
    <header className="dl-pagehead">
      <div>
        {eyebrow && <div className="dl-pagehead__eyebrow">{eyebrow}</div>}
        <h1 className="dl-pagehead__title">{title}</h1>
        {subtitle && <p className="dl-pagehead__sub">{subtitle}</p>}
      </div>
      {actions && <div className="dl-pagehead__actions">{actions}</div>}
    </header>
  );
}

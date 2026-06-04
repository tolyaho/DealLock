/* Page header — serif title (the only serif on the screen) + sans subtitle and
 * optional right-aligned actions. Used at the top of every dashboard page. */
import type { ReactNode } from "react";

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
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

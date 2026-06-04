/* Scroll container for a dashboard page's content. `actionBar` reserves space
 * at the bottom for a fixed BottomActionBar; otherwise content gets normal
 * bottom padding. Keeps every page's outer rhythm identical. */
import type { ReactNode } from "react";

export function PageContent({
  children,
  actionBar,
}: {
  children: ReactNode;
  actionBar?: boolean;
}) {
  return (
    <div
      className={`dl-dash__content ${actionBar ? "dl-dash__content--actionbar" : "dl-dash__content--padded"}`}
    >
      <div className="dl-dash__page">{children}</div>
    </div>
  );
}

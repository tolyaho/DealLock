/*
 * PageContainer — the consistent content frame for every page: centred, capped
 * to a readable max-width, with uniform padding and a vertical rhythm (gap)
 * between blocks. `actionBar` reserves bottom space for a BottomActionBar;
 * `wide` removes the max-width for full-bleed layouts (e.g. tables / lab).
 */
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  actionBar?: boolean;
  wide?: boolean;
}

export function PageContainer({ children, actionBar, wide }: Props) {
  const cls = ["app-page", wide && "app-page--wide", actionBar && "app-page--actionbar"]
    .filter(Boolean)
    .join(" ");
  return <div className={cls}>{children}</div>;
}

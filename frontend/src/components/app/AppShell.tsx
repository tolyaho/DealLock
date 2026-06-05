/*
 * AppShell — the one frame shared by every /app screen.
 *
 *   wall (.dl-app) → lit satin panel (.app-shell) → [ Sidebar | (Topbar / scroll) ]
 *
 * The layout is pure flex with min-height:0 on the scrolling regions, so it
 * survives short viewports with no clipping/overlap: the topbar is fixed height,
 * the sidebar scrolls internally, and the page content scrolls in `.app-scroll`.
 *
 * The nav toggle adapts to the viewport: it collapses the rail on desktop and
 * opens the off-canvas drawer (+ scrim) on mobile. The drawer auto-closes on
 * navigation. Workspace mode is provided here so every page can read it.
 */
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import "../../styles/app.css";
import { WorkspaceProvider } from "./WorkspaceContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const MOBILE_QUERY = "(max-width: 960px)";

export default function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rail, setRail] = useState(false);
  const location = useLocation();

  // Close the mobile drawer on any navigation.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const toggleNav = () => {
    const isMobile =
      typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches;
    if (isMobile) setDrawerOpen((open) => !open);
    else setRail((collapsed) => !collapsed);
  };

  const cls = ["dl-app", rail && "is-rail", drawerOpen && "is-drawer-open"]
    .filter(Boolean)
    .join(" ");

  return (
    <WorkspaceProvider>
      <div className={cls}>
        <div className="app-shell">
          <div className="app-shell__shine" aria-hidden="true" />
          <Sidebar />
          <div className="app-main">
            <Topbar onToggleNav={toggleNav} />
            <div className="app-scroll">
              <Outlet />
            </div>
          </div>
          {/* drawer scrim (mobile) — sits below the sidebar, above content */}
          <div className="app-scrim" aria-hidden="true" onClick={() => setDrawerOpen(false)} />
        </div>
      </div>
    </WorkspaceProvider>
  );
}

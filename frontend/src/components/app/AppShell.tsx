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
 * navigation.
 *
 * Workspace mode is provided here. The frame reads it so the shell carries the
 * active identity: `data-workspace` flips a subtle role accent (temperature,
 * not a theme), and `switching` drives the premium "reboot into the other
 * workspace" transition — the scroll region desaturates/fades for the switch
 * window while a status pill announces the new mode.
 */
import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import "../../styles/app.css";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext";
import { ROLE_CONFIG } from "../../fixtures/roleConfig";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const MOBILE_QUERY = "(max-width: 960px)";

export default function AppShell() {
  return (
    <WorkspaceProvider>
      <AppShellFrame />
    </WorkspaceProvider>
  );
}

function AppShellFrame() {
  const { workspace, switching } = useWorkspace();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rail, setRail] = useState(false);
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Close the mobile drawer on any navigation.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Each route lands at the top: the page content scrolls inside `.app-scroll`,
  // not the window, so reset that container (not window.scrollTo) on navigation.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0 });
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
    <div className={cls} data-workspace={workspace}>
      <div className="app-shell">
        <div className="app-shell__shine" aria-hidden="true" />
        <Sidebar />
        <div className="app-main">
          <Topbar onToggleNav={toggleNav} />
          <div ref={scrollRef} className="app-scroll" data-switching={switching ? "true" : undefined}>
            <Outlet />
          </div>
          {/* Switch transition status — a quiet announcement, auto-clears. */}
          <div className="dl-ws-status" data-show={switching ? "true" : undefined} role="status" aria-live="polite">
            {switching ? `Switching to ${ROLE_CONFIG[workspace].workspaceLabel}…` : ""}
          </div>
        </div>
        {/* drawer scrim (mobile) — sits below the sidebar, above content */}
        <div className="app-scrim" aria-hidden="true" onClick={() => setDrawerOpen(false)} />
      </div>
    </div>
  );
}

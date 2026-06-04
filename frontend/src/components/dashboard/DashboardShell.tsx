/*
 * DashboardShell — the one app frame shared by every /app screen:
 *   left icon rail · centered workspace toggle · right top-bar actions · outlet
 *
 * The rail is icon-only (76px) with hover tooltips + aria-labels (STYLE_GUIDE:
 * "left navigation rail with soft icon buttons"). Below 900px it slides in as a
 * drawer behind a scrim, opened by the top-bar menu button. Overlap with content
 * is handled by the flex layout + the content's own padding — never z-index.
 */
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import "../../styles/dashboard.css";
import { WorkspaceProvider } from "./WorkspaceContext";
import WorkspaceToggle from "./WorkspaceToggle";
import { Avatar } from "./primitives";
import {
  IconActivity,
  IconAgreements,
  IconBell,
  IconCounterparties,
  IconHome,
  IconLock,
  IconMenu,
  IconMessages,
  IconProvider,
  IconSettings,
  IconStatistics,
  IconWallet,
} from "./icons";
import type { ComponentType, SVGProps } from "react";

interface NavDef {
  to: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Tiny champagne dot = needs attention (mock). */
  dot?: boolean;
}

const PRIMARY_NAV: NavDef[] = [
  { to: "/app/home", label: "Home", Icon: IconHome },
  { to: "/app/agreements", label: "Agreements", Icon: IconAgreements, dot: true },
  { to: "/app/provider", label: "Provider workspace", Icon: IconProvider },
  { to: "/app/activity", label: "Activity", Icon: IconActivity },
  { to: "/app/messages", label: "Messages", Icon: IconMessages },
  { to: "/app/counterparties", label: "Counterparties", Icon: IconCounterparties },
  { to: "/app/statistics", label: "Statistics", Icon: IconStatistics },
];

const FOOTER_NAV: NavDef[] = [
  { to: "/app/wallet", label: "Wallet", Icon: IconWallet },
  { to: "/app/settings", label: "Settings", Icon: IconSettings },
];

function RailButton({ to, label, Icon, dot }: NavDef) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `dl-navbtn${isActive ? " is-active" : ""}`}
      aria-label={label}
    >
      <Icon />
      {dot && <span className="dl-navbtn__dot" />}
      <span className="dl-navbtn__tip">{label}</span>
    </NavLink>
  );
}

export default function DashboardShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer on any navigation.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <WorkspaceProvider>
      <div className={`dl-dash${drawerOpen ? " is-drawer-open" : ""}`}>
        <div className="dl-dash__shell">
          {/* scrim sits behind the rail when the drawer is open (mobile) */}
          <div
            className="dl-dash__scrim"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />

          <nav className="dl-dash__rail" aria-label="Primary">
            <NavLink to="/app/home" className="dl-dash__brand" aria-label="DealLock home">
              <IconLock />
            </NavLink>
            <div className="dl-dash__rail-group">
              {PRIMARY_NAV.map((n) => (
                <RailButton key={n.to} {...n} />
              ))}
            </div>
            <div className="dl-dash__rail-spacer" />
            <div className="dl-dash__rail-group">
              {FOOTER_NAV.map((n) => (
                <RailButton key={n.to} {...n} />
              ))}
            </div>
          </nav>

          <div className="dl-dash__main">
            <div className="dl-dash__topbar">
              <div className="dl-dash__topbar-left">
                <button
                  type="button"
                  className="dl-iconbtn dl-dash__menu"
                  aria-label="Open navigation"
                  onClick={() => setDrawerOpen(true)}
                >
                  <IconMenu />
                </button>
              </div>

              <WorkspaceToggle />

              <div className="dl-dash__topbar-right">
                <button type="button" className="dl-iconbtn" aria-label="Notifications">
                  <IconBell />
                  <span className="dl-iconbtn__dot" />
                </button>
                <Avatar initials="JL" size="md" />
              </div>
            </div>

            <Outlet />
          </div>
        </div>
      </div>
    </WorkspaceProvider>
  );
}

/*
 * Sidebar — the labelled primary navigation (collapsible to an icon rail on
 * desktop; an off-canvas drawer on mobile, see AppShell). Brand pinned top,
 * grouped nav in the scroll region, Wallet/Settings/Design-lab pinned bottom.
 * Active item reads as a raised white keycap with a sage location rail.
 */
import { NavLink } from "react-router-dom";
import { IconLock } from "./icons";
import { NAV_FOOTER, NAV_GROUPS, type NavItem } from "./nav";

function Item({ to, label, Icon, dot }: NavItem) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `app-nav-item${isActive ? " is-active" : ""}`}
    >
      <Icon className="app-nav-item__icon" />
      <span className="app-nav-item__label">{label}</span>
      {dot && <span className="app-nav-item__dot" aria-hidden="true" />}
    </NavLink>
  );
}

export function Sidebar() {
  return (
    <nav className="app-sidebar" aria-label="Primary">
      <NavLink to="/app/home" className="app-sidebar__brand" aria-label="DealLock home">
        <span className="app-sidebar__mark" aria-hidden="true">
          <IconLock />
        </span>
        <span className="app-sidebar__wordmark">DealLock</span>
      </NavLink>

      <div className="app-sidebar__scroll">
        {NAV_GROUPS.map((group) => (
          <div className="app-nav-group" key={group.label}>
            <div className="app-nav-group__label">{group.label}</div>
            {group.items.map((item) => (
              <Item key={item.to} {...item} />
            ))}
          </div>
        ))}
      </div>

      <div className="app-sidebar__footer">
        {NAV_FOOTER.map((item) => (
          <Item key={item.to} {...item} />
        ))}
      </div>
    </nav>
  );
}

/*
 * Topbar — fixed-height bar above the page scroll region.
 *   left   · nav toggle (collapses the rail on desktop / opens the drawer on mobile)
 *   centre · WorkspaceSwitch (Client ⇄ Provider)
 *   right  · search · notifications · account avatar
 * Search is local + non-functional for now (foundation phase).
 */
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { IconButton } from "./Button";
import { SearchInput } from "./SearchInput";
import { WorkspaceSwitch } from "./WorkspaceSwitch";
import { Avatar } from "./Avatar";
import { IconBell, IconMenu } from "./icons";
import { useAuth } from "../../auth/AuthContext";
import { displayName, initialsFor } from "../../auth/userDisplay";

export function Topbar({ onToggleNav }: { onToggleNav: () => void }) {
  const [query, setQuery] = useState("");
  const { user, wallets } = useAuth();
  const name = displayName(user, wallets) || "your profile";
  return (
    <header className="app-topbar">
      <div className="app-topbar__inner">
        <div className="app-topbar__left">
          <IconButton label="Toggle navigation" icon={<IconMenu />} onClick={onToggleNav} />
        </div>

        <div className="app-topbar__center">
          <WorkspaceSwitch />
        </div>

        <div className="app-topbar__right">
          <div className="app-topbar__search">
            <SearchInput value={query} onChange={setQuery} placeholder="Search agreements…" ariaLabel="Search" block />
          </div>
          <IconButton label="Notifications" icon={<IconBell />} dot />
          <NavLink
            to="/app/profile"
            className="app-topbar__account"
            aria-label={`Open ${name}`}
            title={name}
          >
            <Avatar initials={initialsFor(user, wallets)} size="md" />
          </NavLink>
        </div>
      </div>
    </header>
  );
}

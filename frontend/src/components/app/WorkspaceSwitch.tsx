/*
 * WorkspaceSwitch — the workspace SELECTOR (not a tab).
 *
 * DealLock has one agreement object but two operating modes. This control makes
 * switching feel like changing workspace identity, not flipping a filter:
 *   • the trigger states the active identity — "Operating as Client" + a hint,
 *   • the menu presents each mode as a full workspace card (glyph, 3-beat
 *     journey, description, subtle role accent, active check),
 *   • choosing a *different* mode resets the screen — it navigates to that
 *     role's home so page-local filters/search/pagination clear and the whole
 *     dashboard recontextualizes (the WorkspaceContext raises `switching` for
 *     the premium fade/desaturate transition).
 *
 * All copy is read from ROLE_CONFIG — no role text is hardcoded here.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "./WorkspaceContext";
import { ROLE_CONFIG } from "../../fixtures/roleConfig";
import type { WorkspaceGlyph } from "../../fixtures/roleConfig";
import type { Role } from "../../fixtures/types";
import { IconCheck, IconChevronRight, IconShield, IconUpload } from "./icons";

const ROLES: Role[] = ["client", "provider"];
const GLYPH: Record<WorkspaceGlyph, ReactNode> = {
  shield: <IconShield />,
  upload: <IconUpload />,
};

export function WorkspaceSwitch() {
  const { workspace, setWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cfg = ROLE_CONFIG[workspace];

  // Dismiss the menu on outside click or Escape (premium popover behaviour).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (r: Role) => {
    setOpen(false);
    if (r === workspace) return;
    setWorkspace(r);
    // Reset the screen into the role's command center. Leaving the current
    // page drops its local filters/search/sort; the dashboard remounts in the
    // new mode. (If unsure where to land, the brief says default to role home.)
    navigate("/app/home");
  };

  return (
    <div className="dl-ws" ref={ref} data-workspace={workspace}>
      <button
        type="button"
        className="dl-ws__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${cfg.operatingLabel}. Switch workspace`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dl-ws__glyph" aria-hidden="true">
          {GLYPH[cfg.glyph]}
        </span>
        <span className="dl-ws__id">
          <span className="dl-ws__op">{cfg.operatingLabel}</span>
          <span className="dl-ws__hint">{cfg.triggerHint}</span>
        </span>
        <span className={`dl-ws__chev${open ? " is-open" : ""}`} aria-hidden="true">
          <IconChevronRight />
        </span>
      </button>

      {open && (
        <div className="dl-ws-menu" role="menu" aria-label="Switch workspace">
          <div className="dl-ws-menu__head">Switch workspace</div>
          {ROLES.map((r) => {
            const rc = ROLE_CONFIG[r];
            const active = r === workspace;
            return (
              <button
                key={r}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={`dl-ws-opt${active ? " is-active" : ""}`}
                data-workspace={r}
                onClick={() => choose(r)}
              >
                <span className="dl-ws-opt__glyph" aria-hidden="true">
                  {GLYPH[rc.glyph]}
                </span>
                <span className="dl-ws-opt__body">
                  <span className="dl-ws-opt__title">{rc.workspaceLabel}</span>
                  <span className="dl-ws-opt__journey">{rc.journey.join(" · ")}</span>
                  <span className="dl-ws-opt__desc">{rc.shortDescription}</span>
                </span>
                <span className="dl-ws-opt__check" aria-hidden="true">
                  {active ? <IconCheck /> : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

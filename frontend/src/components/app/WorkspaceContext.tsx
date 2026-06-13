/*
 * Workspace mode — "one app, two modes". The signed-in user can act as client
 * or provider; the toggle lives in the top bar on every dashboard screen and
 * only changes which content/cards/CTAs are emphasized — never the nav, type,
 * or component language.
 *
 * Source of truth is React context (so it survives in-app navigation), seeded
 * from the `?workspace=` URL param then localStorage, and mirrored back into
 * the URL for shareable links.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import type { Role } from "../../fixtures/types";
import { ROLE_CONFIG, type RoleConfig } from "../../fixtures/roleConfig";

interface WorkspaceCtx {
  workspace: Role;
  /** Change the active workspace. A no-op if `r` is already active. Switching
   *  to a *different* role raises `switching` for the transition window. */
  setWorkspace: (r: Role) => void;
  /** True for the brief window right after a real mode change — drives the
   *  premium "reboot into the other workspace" transition (fade/desaturate +
   *  status pill). Callers should also navigate to the role home so the screen
   *  recontextualizes and page-local state (filters/search/pagination) resets. */
  switching: boolean;
}

const Ctx = createContext<WorkspaceCtx | null>(null);
const STORAGE_KEY = "dl.workspace";
/** Transition window length — calm, premium, within the 280–420ms brief. */
const SWITCH_MS = 360;

function isRole(v: unknown): v is Role {
  return v === "client" || v === "provider";
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();

  const [workspace, setWorkspaceState] = useState<Role>(() => {
    const fromUrl = params.get("workspace");
    if (isRole(fromUrl)) return fromUrl;
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isRole(stored)) return stored;
    }
    return "client";
  });

  const [switching, setSwitching] = useState(false);
  // Keep the live role in a ref so `setWorkspace` can guard no-op switches
  // without being recreated on every change (stable identity for consumers).
  const currentRef = useRef(workspace);
  currentRef.current = workspace;
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const setWorkspace = useCallback((r: Role) => {
    if (r === currentRef.current) return; // already in this workspace — do nothing
    setWorkspaceState(r);
    try {
      localStorage.setItem(STORAGE_KEY, r);
    } catch {
      /* storage may be unavailable; context still holds the value */
    }
    // Raise the transition flag for the switch window, then settle.
    setSwitching(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSwitching(false), SWITCH_MS);
  }, []);

  // Mirror the active mode into the URL (replace, so it doesn't spam history).
  useEffect(() => {
    if (params.get("workspace") === workspace) return;
    const next = new URLSearchParams(params);
    next.set("workspace", workspace);
    setParams(next, { replace: true });
  }, [workspace, params, setParams]);

  const value = useMemo(
    () => ({ workspace, setWorkspace, switching }),
    [workspace, setWorkspace, switching],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

/**
 * The role identity config for the active workspace — the one place screens
 * pull role-specific copy (labels, KPIs, action wording, descriptions) from.
 * Sugar over `ROLE_CONFIG[useWorkspace().workspace]` so components never branch
 * on the role just to read a string.
 */
export function useRoleConfig(): RoleConfig {
  return ROLE_CONFIG[useWorkspace().workspace];
}

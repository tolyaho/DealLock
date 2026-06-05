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
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import type { Role } from "../../fixtures/types";

interface WorkspaceCtx {
  workspace: Role;
  setWorkspace: (r: Role) => void;
}

const Ctx = createContext<WorkspaceCtx | null>(null);
const STORAGE_KEY = "dl.workspace";

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

  const setWorkspace = useCallback(
    (r: Role) => {
      setWorkspaceState(r);
      try {
        localStorage.setItem(STORAGE_KEY, r);
      } catch {
        /* storage may be unavailable; context still holds the value */
      }
    },
    [],
  );

  // Mirror the active mode into the URL (replace, so it doesn't spam history).
  useEffect(() => {
    if (params.get("workspace") === workspace) return;
    const next = new URLSearchParams(params);
    next.set("workspace", workspace);
    setParams(next, { replace: true });
  }, [workspace, params, setParams]);

  const value = useMemo(() => ({ workspace, setWorkspace }), [workspace, setWorkspace]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

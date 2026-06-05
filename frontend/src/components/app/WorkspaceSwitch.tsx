/*
 * WorkspaceSwitch — Client ⇄ Provider, the one mode toggle present on every
 * app screen. A segmented metal pill (top-bar centre). Only the content beneath
 * changes between modes — never the nav, type, or component language. State
 * lives in WorkspaceContext (URL + localStorage backed).
 */
import { useWorkspace } from "./WorkspaceContext";
import { IconClient, IconProvider } from "./icons";

export function WorkspaceSwitch() {
  const { workspace, setWorkspace } = useWorkspace();
  return (
    <div className="dl-ws" role="tablist" aria-label="Workspace">
      <button
        type="button"
        role="tab"
        aria-selected={workspace === "client"}
        className={`dl-ws__btn${workspace === "client" ? " is-active" : ""}`}
        onClick={() => setWorkspace("client")}
      >
        <IconClient />
        <span>Client</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={workspace === "provider"}
        className={`dl-ws__btn${workspace === "provider" ? " is-active" : ""}`}
        onClick={() => setWorkspace("provider")}
      >
        <IconProvider />
        <span>Provider</span>
      </button>
    </div>
  );
}

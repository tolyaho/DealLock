/* The Client / Provider workspace toggle. Identical on every screen — only the
 * content beneath it changes. Segmented pill matching the references. */
import { useWorkspace } from "./WorkspaceContext";
import { IconClient, IconProvider } from "./icons";

export default function WorkspaceToggle() {
  const { workspace, setWorkspace } = useWorkspace();
  return (
    <div className="dl-wstoggle" role="tablist" aria-label="Workspace">
      <button
        type="button"
        role="tab"
        aria-selected={workspace === "client"}
        className={`dl-wstoggle__btn${workspace === "client" ? " is-active" : ""}`}
        onClick={() => setWorkspace("client")}
      >
        <IconClient />
        <span>Client workspace</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={workspace === "provider"}
        className={`dl-wstoggle__btn${workspace === "provider" ? " is-active" : ""}`}
        onClick={() => setWorkspace("provider")}
      >
        <IconProvider />
        <span>Provider workspace</span>
      </button>
    </div>
  );
}

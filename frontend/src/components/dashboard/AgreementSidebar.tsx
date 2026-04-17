import { useMemo } from "react";
import { type Address } from "viem";
import {
  loadAgreementRegistry,
  removeAgreementFromRegistry,
  registryRoleForWallet,
  sortRegistryEntries,
} from "../../storage.ts";
import { agreementLabel, shortAddress, type AgreementSidebarFilter, type Role } from "../../types.ts";
import { templateLabel } from "../../templates.ts";

interface AgreementSidebarProps {
  wallet: Address | undefined;
  activeAddress: Address | null;
  filter: AgreementSidebarFilter;
  onFilterChange: (f: AgreementSidebarFilter) => void;
  onSelect: (addr: Address) => void;
  onNewAgreement: () => void;
  onLoadByAddress: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onRemovedFromRegistry: (contractAddress: string) => void;
}

function stateRowClass(state: number | null): string {
  if (state == null) return "agreement-row-state agreement-row-state--muted";
  const slug = agreementLabel(state).toLowerCase();
  const known = [
    "proposed", "accepted", "funded", "completed", "cancelled",
    "pending", "submitted", "released", "refunded",
  ];
  return `agreement-row-state agreement-row-state--${known.includes(slug) ? slug : "unknown"}`;
}

export default function AgreementSidebar({
  wallet,
  activeAddress,
  filter,
  onFilterChange,
  onSelect,
  onNewAgreement,
  onLoadByAddress,
  collapsed,
  onToggleCollapse,
  onRemovedFromRegistry,
}: AgreementSidebarProps) {
  const raw = useMemo(() => sortRegistryEntries(loadAgreementRegistry()), []);

  const counts = useMemo(() => {
    let client = 0;
    let provider = 0;
    let other = 0;
    for (const e of raw) {
      const r = registryRoleForWallet(e, wallet);
      if (r === "client") client++;
      else if (r === "provider") provider++;
      else other++;
    }
    return { all: raw.length, client, provider, other };
  }, [raw, wallet]);

  const filtered = raw.filter((e) => {
    if (filter === "all") return true;
    const r = registryRoleForWallet(e, wallet);
    return r === filter;
  });

  const filters: Array<[AgreementSidebarFilter, string, number]> = [
    ["all", "All", counts.all],
    ["client", "Client", counts.client],
    ["provider", "Provider", counts.provider],
    ["other", "Viewer", counts.other],
  ];

  return (
    <aside className={`agreement-sidebar ${collapsed ? "agreement-sidebar--collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-header-row">
          <h2 className="sidebar-title">My agreements</h2>
          <button
            type="button"
            className="btn-icon-bare"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapse}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>
        <div className="sidebar-header-body">
          <p className="sidebar-hint">
            Stored only in this browser — not synced across devices.
          </p>
          <div className="sidebar-actions">
            <button type="button" className="btn btn-primary btn-sm btn-block" onClick={onNewAgreement}>
              + New agreement
            </button>
            <button type="button" className="btn btn-secondary btn-sm btn-block" onClick={onLoadByAddress}>
              Load by address
            </button>
          </div>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="sidebar-filter-tabs" role="tablist" aria-label="Filter by role">
            {filters.map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                className={`sidebar-filter-tab ${filter === key ? "sidebar-filter-tab--active" : ""}`}
                onClick={() => onFilterChange(key)}
              >
                <span>{label}</span>
                <span className="sidebar-filter-count">{count}</span>
              </button>
            ))}
          </div>

          <div className="agreement-sidebar-list">
            {filtered.length === 0 ? (
              <div className="sidebar-empty">
                <p className="sidebar-empty-title">
                  {raw.length === 0 ? "No agreements yet" : "Nothing in this filter"}
                </p>
                <p className="sidebar-empty-text">
                  {raw.length === 0
                    ? "Deploy one with “New agreement”, or load an existing contract."
                    : "Try another filter above."}
                </p>
              </div>
            ) : (
              filtered.map((entry) => {
                const active =
                  activeAddress &&
                  entry.contractAddress === String(activeAddress).toLowerCase();
                const r: Role = registryRoleForWallet(entry, wallet);
                const title =
                  entry.projectTitle?.trim() ||
                  `Agreement ${shortAddress(entry.contractAddress)}`;
                const tmpl =
                  entry.serviceTemplate != null ? templateLabel(entry.serviceTemplate) : null;
                const roleTag = r === "client" ? "Client" : r === "provider" ? "Provider" : "Viewer";
                const roleTagClass =
                  r === "client"
                    ? "agreement-row-role-tag--client"
                    : r === "provider"
                      ? "agreement-row-role-tag--provider"
                      : "agreement-row-role-tag--viewer";
                const stamp = new Date(entry.lastAccessedAt);
                const stampLabel = stamp.toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                });
                return (
                  <div
                    key={entry.contractAddress}
                    className={`agreement-row agreement-row--role-${r} ${active ? "agreement-row--active" : ""}`}
                  >
                    <button
                      type="button"
                      className="agreement-row-main"
                      onClick={() => onSelect(entry.contractAddress as Address)}
                    >
                      <div className="agreement-row-top">
                        <div className="agreement-row-title">{title}</div>
                        <span className={`agreement-row-role-tag ${roleTagClass}`}>{roleTag}</span>
                      </div>
                      <div className="agreement-row-meta">
                        <code>{shortAddress(entry.contractAddress)}</code>
                        <span className={stateRowClass(entry.agreementState)}>
                          {entry.agreementState != null ? agreementLabel(entry.agreementState) : "–"}
                        </span>
                      </div>
                      <div className="agreement-row-foot">
                        <span className="agreement-row-template">{tmpl ?? "Custom"}</span>
                        <span className="agreement-row-time">{stampLabel}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="btn-icon-bare agreement-row-remove"
                      title="Remove from this list (on-chain contract stays)"
                      aria-label="Remove from local list"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        removeAgreementFromRegistry(entry.contractAddress);
                        onRemovedFromRegistry(entry.contractAddress);
                      }}
                    >
                      ×
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </aside>
  );
}

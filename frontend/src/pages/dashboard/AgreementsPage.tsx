/* Agreements list — a lightweight table of every agreement the user is party
 * to (both roles), with a working search + status filter. Matches the
 * supplemental "All agreements" reference: icon+title, counterparty, role,
 * status pill, amount locked, current milestone, and a View action. */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AGREEMENTS, myRole } from "../../fixtures/agreements";
import type { AgreementStatus } from "../../fixtures/types";
import { formatMoney } from "../../fixtures/format";
import { PageContent } from "../../components/dashboard/Page";
import PageHeader from "../../components/dashboard/PageHeader";
import {
  Avatar,
  Button,
  SectionCard,
  Segmented,
  StatusPill,
} from "../../components/dashboard/primitives";
import { IconAgreements, IconSearch } from "../../components/dashboard/icons";

type FilterKey = "all" | "active" | "in_review" | "completed";
const FILTERS: { value: FilterKey; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "in_review", label: "In review" },
  { value: "completed", label: "Completed" },
];

function matchesFilter(status: AgreementStatus, f: FilterKey): boolean {
  if (f === "all") return true;
  if (f === "active") return status === "active" || status === "approved" || status === "revision_requested";
  if (f === "in_review") return status === "in_review";
  return status === "completed" || status === "released";
}

export default function AgreementsPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return AGREEMENTS.filter((a) => {
      if (!matchesFilter(a.status, filter)) return false;
      if (!q) return true;
      const other = myRole(a) === "client" ? a.provider.name : a.client.name;
      return a.title.toLowerCase().includes(q) || other.toLowerCase().includes(q);
    });
  }, [query, filter]);

  return (
    <PageContent>
      <PageHeader
        title="All agreements"
        subtitle="Track and manage your secured agreements."
        actions={
          <div className="dl-toolbar">
            <label className="dl-search">
              <IconSearch />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search agreements"
                aria-label="Search agreements"
              />
            </label>
            <Segmented options={FILTERS} value={filter} onChange={setFilter} ariaLabel="Filter by status" />
          </div>
        }
      />

      <p className="dl-label" style={{ marginBottom: 12 }}>{rows.length} agreements</p>

      <SectionCard flush>
        <table className="dl-table">
          <thead>
            <tr>
              <th>Agreement</th>
              <th className="dl-table__hide-sm">Counterparty</th>
              <th className="dl-table__hide-sm">Role</th>
              <th>Status</th>
              <th className="dl-table__right">Amount locked</th>
              <th className="dl-table__hide-sm">Current milestone</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const role = myRole(a);
              const other = role === "client" ? a.provider : a.client;
              const current = a.milestones.find((m) => m.id === a.currentMilestoneId);
              return (
                <tr key={a.id} onClick={() => navigate(`/app/agreements/${a.id}`)} style={{ cursor: "pointer" }}>
                  <td>
                    <div className="dl-table__name">
                      <span className="dl-row__icon" style={{ width: 34, height: 34 }}>
                        <IconAgreements />
                      </span>
                      <div>
                        <div className="dl-table__name-title">{a.title}</div>
                        <div className="dl-table__name-sub">{a.id.toUpperCase()}</div>
                      </div>
                    </div>
                  </td>
                  <td className="dl-table__hide-sm">
                    <div className="dl-table__name">
                      <Avatar initials={other.initials} size="sm" />
                      <span>{other.name}</span>
                    </div>
                  </td>
                  <td className="dl-table__hide-sm" style={{ textTransform: "capitalize" }}>{role}</td>
                  <td><StatusPill status={a.status} /></td>
                  <td className="dl-table__right dl-table__num">{formatMoney(a.locked)}</td>
                  <td className="dl-table__hide-sm">{current?.title ?? "—"}</td>
                  <td className="dl-table__right">
                    <Button small variant="secondary" onClick={(e) => { e.stopPropagation(); navigate(`/app/agreements/${a.id}`); }}>
                      View
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SectionCard>
    </PageContent>
  );
}

/*
 * Agreements — scan & manage every secured agreement the user is party to (as
 * client AND provider; the Role column distinguishes them). Toolbar = status
 * filter (SegmentedControl) + search; body = TableShell with one clear, role +
 * status-aware action per row. Built from the foundation kit only.
 *
 * Filters are URL-reflected (?status=) so the Home KPIs can deep-link in.
 * `?empty=1` previews the onboarding empty state for design review. Row actions
 * are presentational until the agreement-detail flow lands in a later phase.
 */
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ReactNode } from "react";
import {
  Button,
  Card,
  EmptyState,
  Identity,
  PageContainer,
  PageHeader,
  SearchInput,
  SegmentedControl,
  StatusChip,
  TableShell,
  type ChipTone,
  type Column,
} from "../../components/app";
import {
  IconAgreements,
  IconArrowRight,
  IconEdit,
  IconPlus,
  IconShield,
  IconUpload,
} from "../../components/app/icons";
import {
  AGREEMENTS,
  STATUS_LABEL,
  counterparty,
  currentMilestone,
  myRole,
  rowAction,
  type ActionKind,
} from "../../fixtures/agreements";
import { formatMoney } from "../../fixtures/format";
import type { AgreementStatus } from "../../fixtures/types";

const TONE: Record<AgreementStatus, ChipTone> = {
  active: "secure",
  in_review: "review",
  approved: "secure",
  released: "secure",
  revision_requested: "review",
  completed: "neutral",
  draft: "neutral",
};

const ACTION_ICON: Record<ActionKind, ReactNode> = {
  view: <IconArrowRight />,
  review: <IconShield />,
  sign: <IconEdit />,
  release: <IconShield />,
  submit: <IconUpload />,
  resubmit: <IconUpload />,
};

type Filter = "all" | "active" | "in_review" | "completed" | "draft";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "in_review", label: "In review" },
  { value: "completed", label: "Completed" },
  { value: "draft", label: "Draft" },
];
const GROUP: Record<Exclude<Filter, "all">, AgreementStatus[]> = {
  active: ["active", "approved", "revision_requested"],
  in_review: ["in_review"],
  completed: ["completed", "released"],
  draft: ["draft"],
};

// Stable widths (table-layout: fixed). Agreement is left auto so it takes the
// remaining space and stays the largest; the rest are sized to their content.
const COLUMNS: Column[] = [
  { key: "agreement", label: "Agreement" },
  { key: "counterparty", label: "Counterparty", width: "196px" },
  { key: "role", label: "Role", width: "90px" },
  { key: "status", label: "Status", width: "166px" },
  { key: "locked", label: "Amount locked", align: "right", width: "112px" },
  { key: "milestone", label: "Current milestone", width: "132px" },
  { key: "action", label: "Action", align: "right", width: "128px" },
];

export default function AgreementsPage() {
  const [params, setParams] = useSearchParams();
  const urlFilter = params.get("status") as Filter | null;
  const [filter, setFilter] = useState<Filter>(
    urlFilter && FILTERS.some((f) => f.value === urlFilter) ? urlFilter : "all",
  );
  const [query, setQuery] = useState("");

  const setFilterAndUrl = (f: Filter) => {
    setFilter(f);
    const next = new URLSearchParams(params);
    if (f === "all") next.delete("status");
    else next.set("status", f);
    setParams(next, { replace: true });
  };

  const previewEmpty = params.get("empty") === "1";
  const source = previewEmpty ? [] : AGREEMENTS;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return source.filter((a) => {
      const inFilter = filter === "all" || GROUP[filter].includes(a.status);
      const inQuery =
        !q || a.title.toLowerCase().includes(q) || counterparty(a).name.toLowerCase().includes(q);
      return inFilter && inQuery;
    });
  }, [source, filter, query]);

  return (
    <PageContainer>
      <PageHeader
        title="All agreements"
        subtitle="Track and manage your secured agreements."
        actions={
          <Button variant="primary" icon={<IconPlus />}>
            New agreement
          </Button>
        }
      />

      {source.length > 0 && (
        <div className="dl-toolbar">
          <div className="dl-toolbar__filters">
            <SegmentedControl<Filter>
              ariaLabel="Filter by status"
              value={filter}
              onChange={setFilterAndUrl}
              options={FILTERS}
            />
          </div>
          <div className="dl-toolbar__search">
            <SearchInput value={query} onChange={setQuery} placeholder="Search agreements or counterparty…" block />
          </div>
        </div>
      )}

      {rows.length > 0 ? (
        <Card flush>
          <TableShell columns={COLUMNS} caption="All agreements" className="dl-table--agreements">
            {rows.map((a) => {
              const role = myRole(a);
              const act = rowAction(a, role);
              const ms = currentMilestone(a);
              return (
                <tr key={a.id}>
                  <td className="dl-cell-agreement">
                    <div className="dl-table__name">{a.title}</div>
                    <div className="dl-table__sub">{a.summary}</div>
                  </td>
                  <td className="dl-cell-party">
                    <Identity initials={counterparty(a).initials} name={counterparty(a).name} size="sm" />
                  </td>
                  <td>
                    <span className="dl-role">{role === "client" ? "Client" : "Provider"}</span>
                  </td>
                  <td>
                    <StatusChip tone={TONE[a.status]}>{STATUS_LABEL[a.status]}</StatusChip>
                  </td>
                  <td data-align="right" className="dl-table__num">
                    {a.locked.amount > 0 ? formatMoney(a.locked) : "—"}
                  </td>
                  <td className="dl-cell-ms">
                    <div className="dl-table__name dl-num">
                      {ms ? `${ms.order} / ${a.milestones.length}` : "—"}
                    </div>
                    {ms && <div className="dl-table__sub">{ms.title}</div>}
                  </td>
                  <td data-align="right">
                    <Button size="sm" variant={act.variant} icon={ACTION_ICON[act.kind]}>
                      {act.label}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </TableShell>
        </Card>
      ) : source.length === 0 ? (
        <Card flush>
          <EmptyState
            icon={<IconAgreements />}
            title="No agreements yet"
            text="Create your first escrow agreement to start protecting a deal."
            action={
              <Button variant="primary" icon={<IconPlus />}>
                New agreement
              </Button>
            }
          />
        </Card>
      ) : (
        <Card flush>
          <EmptyState
            icon={<IconAgreements />}
            title="No matching agreements"
            text="No agreements match this status or search. Try a different filter."
            action={
              <Button variant="secondary" onClick={() => { setFilterAndUrl("all"); setQuery(""); }}>
                Clear filters
              </Button>
            }
          />
        </Card>
      )}
    </PageContainer>
  );
}

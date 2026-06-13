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
import {
  Button,
  Card,
  EmptyState,
  Identity,
  MetalCTA,
  PageContainer,
  PageHeader,
  SearchInput,
  SegmentedControl,
  StatusChip,
  TableShell,
  type ChipTone,
  type Column,
} from "../../components/app";
import { IconAgreements, IconPlus } from "../../components/app/icons";
import {
  AGREEMENTS,
  STATUS_LABEL,
  counterparty,
  currentMilestone,
  milestoneProgress,
  myRole,
  rowAction,
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

// Compact chip copy for the dense table (the full label lives in STATUS_LABEL /
// the detail view). Only the long one is shortened so the status column stays
// tight and every chip reads on one line.
const STATUS_CHIP_LABEL: Partial<Record<AgreementStatus, string>> = {
  revision_requested: "Revision",
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

// Stable widths (table-layout: fixed). Agreement is the one auto column so it
// absorbs the slack and stays the largest; the rest are sized to their content
// (measured: counterparty names, the widest status chip, and the "Resubmit"
// action all fit with 0 clip). Sum of fixed widths (796) is tuned against the
// table min-width (920) so the whole table fits with NO in-card scroll at
// ≥1280 — re-measure if you add or resize a column.
const COLUMNS: Column[] = [
  { key: "agreement", label: "Agreement" },
  { key: "counterparty", label: "Counterparty", width: "188px" },
  { key: "role", label: "Role", width: "92px" },
  { key: "status", label: "Status", width: "130px" },
  // Locked stays LEFT-aligned (header + value) so its label lines up with the
  // amount directly below it and the table reads calm; tabular numerals
  // (.dl-table__num) keep the digits in a tidy column without right-alignment.
  { key: "locked", label: "Locked", width: "116px" },
  { key: "milestone", label: "Milestone", width: "150px" },
  { key: "action", label: "Action", align: "right", width: "120px" },
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
    <PageContainer className="app-page--atmos">
      <PageHeader
        title="All agreements"
        subtitle="Track and manage your secured agreements."
        actions={
          <MetalCTA icon={<IconPlus />}>New agreement</MetalCTA>
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
          <div className="dl-toolbar__end">
            <span className="dl-toolbar__count" aria-live="polite">
              {rows.length} of {source.length}
            </span>
            <div className="dl-toolbar__search">
              <SearchInput value={query} onChange={setQuery} placeholder="Search agreements or counterparty…" block />
            </div>
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
              const prog = milestoneProgress(a);
              // The fill must match the DISPLAYED fraction exactly: the current
              // milestone position over total ("{ms.order} / {total}"), clamped
              // 0–100. Pure data — no presets, no cross-row normalization.
              const fillPercent =
                prog.total > 0 ? Math.max(0, Math.min((prog.order / prog.total) * 100, 100)) : 0;
              // Every row action wears the cool frosted-glass control so the
              // Action column reads as one calm, light column — deliberately NOT
              // metallic (the brushed-metal disc now belongs to the page CTA and
              // the landing's signature buttons, not every row).
              const actVariant = "glass" as const;
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
                    <StatusChip tone={TONE[a.status]}>
                      {STATUS_CHIP_LABEL[a.status] ?? STATUS_LABEL[a.status]}
                    </StatusChip>
                  </td>
                  <td className="dl-table__num">
                    {a.locked.amount > 0 ? formatMoney(a.locked) : "—"}
                  </td>
                  <td className="dl-cell-ms">
                    {ms ? (
                      <>
                        <div className="dl-ms">
                          <span className="dl-ms__count">{ms.order} / {prog.total}</span>
                          <span className="dl-ms__track">
                            <span
                              className={`dl-ms__fill${fillPercent >= 100 ? " dl-ms__fill--full" : ""}`}
                              style={{ width: `${fillPercent}%` }}
                            />
                          </span>
                        </div>
                        <div className="dl-table__sub">{ms.title}</div>
                      </>
                    ) : (
                      <div className="dl-table__name dl-num">—</div>
                    )}
                  </td>
                  <td data-align="right">
                    <Button size="sm" variant={actVariant}>
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
            action={<MetalCTA icon={<IconPlus />}>New agreement</MetalCTA>}
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

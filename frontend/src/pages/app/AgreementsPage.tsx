/*
 * Agreements (skeleton) — demonstrates TableShell + StatusChip with the real
 * fixture data and a SegmentedControl filter. The full list (expandable rows,
 * detail view, create flow) is a later phase; rows don't navigate yet.
 */
import { useMemo, useState } from "react";
import {
  PageContainer,
  PageHeader,
  Button,
  Card,
  SegmentedControl,
  StatusChip,
  TableShell,
  type ChipTone,
  type Column,
  useWorkspace,
} from "../../components/app";
import { IconPlus } from "../../components/app/icons";
import { STATUS_LABEL, agreementsForRole, counterparty } from "../../fixtures/agreements";
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

const COLUMNS: Column[] = [
  { key: "title", label: "Agreement" },
  { key: "party", label: "Counterparty" },
  { key: "status", label: "Status" },
  { key: "value", label: "In escrow", align: "right" },
];

type Filter = "all" | "live" | "review" | "done";
const LIVE: AgreementStatus[] = ["active", "approved", "revision_requested"];

export default function AgreementsPage() {
  const { workspace } = useWorkspace();
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => {
    const mine = agreementsForRole(workspace);
    if (filter === "all") return mine;
    if (filter === "live") return mine.filter((a) => LIVE.includes(a.status));
    if (filter === "review") return mine.filter((a) => a.status === "in_review");
    return mine.filter((a) => a.status === "completed" || a.status === "released");
  }, [workspace, filter]);

  return (
    <PageContainer>
      <PageHeader
        title="Agreements"
        subtitle="Every escrow you're party to, with what's currently locked."
        actions={<Button variant="primary" icon={<IconPlus />}>New agreement</Button>}
      />

      <SegmentedControl<Filter>
        ariaLabel="Filter agreements"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All" },
          { value: "live", label: "Live" },
          { value: "review", label: "In review" },
          { value: "done", label: "Completed" },
        ]}
      />

      <Card flush>
        <TableShell columns={COLUMNS} caption="Your agreements" clickable>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>
                <div className="dl-table__name">{a.title}</div>
                <div className="dl-table__sub">{a.summary}</div>
              </td>
              <td>{counterparty(a).name}</td>
              <td>
                <StatusChip tone={TONE[a.status]}>{STATUS_LABEL[a.status]}</StatusChip>
              </td>
              <td data-align="right" className="dl-table__num">
                {a.locked.amount > 0 ? formatMoney(a.locked) : "—"}
              </td>
            </tr>
          ))}
        </TableShell>
      </Card>
      {rows.length === 0 && (
        <p className="dl-note">No agreements match this filter in the {workspace} workspace.</p>
      )}
    </PageContainer>
  );
}

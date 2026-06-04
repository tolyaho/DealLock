/* Statistics — calm, monochrome analytics derived from the fixtures: headline
 * stats, an escrow/release trend area chart, an agreement-status donut, and a
 * few performance insight cards. Charts are intentionally minimal. */
import { AGREEMENTS } from "../../fixtures/agreements";
import type { AgreementStatus } from "../../fixtures/types";
import { formatMoney } from "../../fixtures/format";
import { PageContent } from "../../components/dashboard/Page";
import PageHeader from "../../components/dashboard/PageHeader";
import { SectionCard, Segmented } from "../../components/dashboard/primitives";
import { IconBolt } from "../../components/dashboard/icons";
import { useState } from "react";

function usdc(sel: (a: (typeof AGREEMENTS)[number]) => number) {
  return AGREEMENTS.reduce((s, a) => s + sel(a), 0);
}

const STATUS_GROUPS: { key: string; label: string; statuses: AgreementStatus[]; color: string }[] = [
  { key: "active", label: "Active", statuses: ["active"], color: "var(--dash-positive)" },
  { key: "review", label: "In review", statuses: ["in_review", "approved"], color: "#8a8b82" },
  { key: "revision", label: "Revision", statuses: ["revision_requested"], color: "#b89b6a" },
  { key: "done", label: "Completed", statuses: ["completed", "released"], color: "#c7c8c1" },
  { key: "draft", label: "Draft", statuses: ["draft"], color: "#dcdcd6" },
];

export default function StatisticsPage() {
  const [range, setRange] = useState<"30d" | "90d" | "ytd">("90d");

  const totalEscrowed = usdc((a) => (a.locked.asset === "USDC" ? a.locked.amount : 0));
  const released = usdc((a) => (a.released.asset === "USDC" ? a.released.amount : 0));
  const activeCount = AGREEMENTS.filter((a) => !["completed", "draft"].includes(a.status)).length;
  const allMs = AGREEMENTS.flatMap((a) => a.milestones);
  const doneMs = allMs.filter((m) => ["released", "approved", "completed"].includes(m.status)).length;
  const completion = Math.round((doneMs / allMs.length) * 100);

  const counts = STATUS_GROUPS.map((g) => ({
    ...g,
    n: AGREEMENTS.filter((a) => g.statuses.includes(a.status)).length,
  }));
  const totalAg = AGREEMENTS.length;
  // build conic-gradient stops for the donut
  let acc = 0;
  const stops = counts
    .map((c) => {
      const start = (acc / totalAg) * 100;
      acc += c.n;
      const end = (acc / totalAg) * 100;
      return `${c.color} ${start}% ${end}%`;
    })
    .join(", ");

  const stats = [
    { label: "Total escrowed", value: formatMoney({ amount: totalEscrowed, asset: "USDC" }), trend: "+8.2%" },
    { label: "Released funds", value: formatMoney({ amount: released, asset: "USDC" }), trend: "+5.1%" },
    { label: "Active agreements", value: String(activeCount), trend: "+3" },
    { label: "Milestone completion", value: `${completion}%`, trend: "+4%" },
  ];

  return (
    <PageContent>
      <PageHeader
        title="Statistics"
        subtitle="Performance, fund flow, and agreement activity."
        actions={
          <Segmented
            options={[{ value: "30d", label: "30D" }, { value: "90d", label: "90D" }, { value: "ytd", label: "YTD" }]}
            value={range}
            onChange={setRange}
            ariaLabel="Date range"
          />
        }
      />

      <div className="dl-grid dl-grid--4">
        {stats.map((s) => (
          <SectionCard key={s.label} label={s.label}>
            <div className="dl-stat__value dl-stat__value-sm">{s.value}</div>
            <p className="dl-stat__meta"><span className="dl-trend dl-trend--up">▲ {s.trend}</span> vs. prior period</p>
          </SectionCard>
        ))}
      </div>

      <div className="dl-grid dl-grid--split">
        <SectionCard label="Escrow & release trend">
          <div className="dl-chart-area" role="img" aria-label="Escrow and release trend, increasing over the period">
            <svg viewBox="0 0 600 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="dl-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(78,125,94,0.22)" />
                  <stop offset="100%" stopColor="rgba(78,125,94,0)" />
                </linearGradient>
              </defs>
              <path d="M0 160 L80 150 L160 132 L240 138 L320 110 L400 96 L480 70 L600 44 L600 200 L0 200 Z" fill="url(#dl-area)" />
              <path d="M0 160 L80 150 L160 132 L240 138 L320 110 L400 96 L480 70 L600 44" fill="none" stroke="var(--dash-positive)" strokeWidth="2" />
            </svg>
          </div>
          <p className="dl-stat__meta">Cumulative value locked and released over the selected range.</p>
        </SectionCard>

        <SectionCard label="Agreement status">
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <div
              aria-hidden="true"
              style={{
                width: 132, height: 132, borderRadius: "999px", flex: "none",
                background: `conic-gradient(${stops})`,
                WebkitMask: "radial-gradient(circle, transparent 56%, #000 57%)",
                mask: "radial-gradient(circle, transparent 56%, #000 57%)",
              }}
            />
            <div style={{ flex: 1 }}>
              {counts.map((c) => (
                <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 13 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, background: c.color }} />
                  <span style={{ flex: 1, color: "var(--dash-ink-soft)" }}>{c.label}</span>
                  <span className="dl-table__num">{c.n}</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="dl-grid dl-grid--3">
        {[
          { t: "Faster approvals", d: "Average review time fell to 2.1 days this period." },
          { t: "Higher completion", d: `${completion}% of milestones reached release.` },
          { t: "Steady fund flow", d: `${formatMoney({ amount: released, asset: "USDC" })} released to providers.` },
        ].map((c) => (
          <SectionCard key={c.t} label="Insight">
            <div className="dl-row" style={{ padding: 0, borderBottom: 0, alignItems: "flex-start" }}>
              <span className="dl-row__icon" style={{ color: "var(--dash-positive)" }}><IconBolt /></span>
              <span className="dl-row__body">
                <span className="dl-row__title">{c.t}</span>
                <span className="dl-row__sub">{c.d}</span>
              </span>
            </div>
          </SectionCard>
        ))}
      </div>
    </PageContent>
  );
}

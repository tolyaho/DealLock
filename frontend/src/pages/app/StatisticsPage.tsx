/*
 * Statistics — escrow performance & fund-flow insights (ship next phase). The
 * date-range control previews how the live charts will be scoped; the stage
 * stays calm until there's data to chart.
 */
import { useState } from "react";
import { EmptyStatePage, PageToolbar, SegmentedControl, SplineObject, useRoleConfig } from "../../components/app";
import { IconPlus } from "../../components/app/icons";
import { SPLINE_SCENES } from "../../splineScenes";

const RANGES = [
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "ytd", label: "YTD" },
];

export default function StatisticsPage() {
  const cfg = useRoleConfig();
  const [range, setRange] = useState("30d");

  return (
    <EmptyStatePage
      title="Statistics"
      subtitle="Understand locked value, released funds, review times, and agreement performance."
      toolbar={
        <PageToolbar
          end={<SegmentedControl ariaLabel="Date range" value={range} onChange={setRange} options={RANGES} />}
        />
      }
      splineType="statistics"
      object={<SplineObject scene={SPLINE_SCENES.statistics} />}
      emptyTitle="No statistics yet"
      emptyDescription="Charts and insights appear once your first agreements start moving — escrowed value, releases, and milestone completion in one calm view."
      primaryAction={{ label: cfg.primaryAction.label, to: "/app/agreements", icon: <IconPlus /> }}
    />
  );
}

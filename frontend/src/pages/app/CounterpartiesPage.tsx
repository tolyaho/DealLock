/*
 * Counterparties — the directory of everyone Jordan has locked agreements with.
 * A single list of Identity rows (metal-token avatar + name + type), each with
 * its value engaged and a way in. Built only from the kit (Card + Identity +
 * Button + the reusable .dl-list module); the Identity cell is the same one the
 * Agreements table uses, at the larger `md` size.
 */
import { useSearchParams } from "react-router-dom";
import { Button, Card, EmptyStatePage, Identity, PageContainer, PageHeader, SkeletonRow, SplineObject, useRoleConfig, usePageLoading } from "../../components/app";
import { IconArrowRight, IconPlus } from "../../components/app/icons";
import { counterparties } from "../../fixtures/agreements";
import { formatMoney } from "../../fixtures/format";
import { SPLINE_SCENES } from "../../splineScenes";

export default function CounterpartiesPage() {
  const [params] = useSearchParams();
  const cfg = useRoleConfig();
  // `?empty=1` previews the onboarding empty state for design review.
  const rows = params.get("empty") === "1" ? [] : counterparties();
  const loading = usePageLoading();

  // No counterparties yet → the same polished Spline empty state as Messages/Activity
  // (the populated list below is left untouched).
  if (rows.length === 0) {
    return (
      <EmptyStatePage
        title="Counterparties"
        subtitle="The people and companies you've locked agreements with."
        splineType="counterparties"
        object={<SplineObject scene={SPLINE_SCENES.counterparties} scale={1.15} zoomOut={0.75} float />}
        emptyTitle="No counterparties yet"
        emptyDescription="People and companies you lock agreements with will appear here once your first agreement is underway."
        primaryAction={{ label: cfg.primaryAction.label, to: "/app/agreements", icon: <IconPlus /> }}
      />
    );
  }

  if (loading) {
    return (
      <PageContainer>
        <PageHeader
          title="Counterparties"
          subtitle="The people and companies you've locked agreements with."
        />
        <Card label="All counterparties">
          <div className="dl-list" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Counterparties"
        subtitle="The people and companies you've locked agreements with."
      />

      <Card label="All counterparties" action={<span className="dl-note">{rows.length} total</span>}>
        <div className="dl-list">
          {rows.map((c) => (
            <div className="dl-list__row" key={c.party.id}>
              <div className="dl-list__main">
                <Identity
                  initials={c.party.initials}
                  name={c.party.name}
                  sub={c.party.kind === "company" ? "Company" : "Individual"}
                  size="md"
                />
              </div>
              <div className="dl-list__end">
                <span className="dl-note">
                  {c.agreements} agreement{c.agreements === 1 ? "" : "s"}
                  {c.active > 0 ? ` · ${c.active} active` : ""}
                  {c.valueUSDC > 0 ? ` · ${formatMoney({ amount: c.valueUSDC, asset: "USDC" })} in escrow` : ""}
                </span>
                <Button size="sm" variant="ghost" icon={<IconArrowRight />}>
                  View
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </PageContainer>
  );
}

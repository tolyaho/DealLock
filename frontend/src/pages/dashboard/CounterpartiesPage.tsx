/* Counterparties — everyone the user has an agreement with, aggregated: number
 * of agreements and total value engaged. Real data derived from fixtures. */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AGREEMENTS, counterparty } from "../../fixtures/agreements";
import type { Party } from "../../fixtures/types";
import { formatMoney } from "../../fixtures/format";
import { PageContent } from "../../components/dashboard/Page";
import PageHeader from "../../components/dashboard/PageHeader";
import { Avatar, SectionCard } from "../../components/dashboard/primitives";
import { IconArrowRight, IconBuilding, IconUser } from "../../components/dashboard/icons";

interface Agg {
  party: Party;
  count: number;
  valueUSDC: number;
  sampleId: string;
}

export default function CounterpartiesPage() {
  const parties = useMemo(() => {
    const map = new Map<string, Agg>();
    for (const a of AGREEMENTS) {
      const p = counterparty(a);
      const prev = map.get(p.id) ?? { party: p, count: 0, valueUSDC: 0, sampleId: a.id };
      prev.count += 1;
      if (a.locked.asset === "USDC") prev.valueUSDC += a.locked.amount;
      map.set(p.id, prev);
    }
    return [...map.values()].sort((x, y) => y.valueUSDC - x.valueUSDC);
  }, []);

  return (
    <PageContent>
      <PageHeader title="Counterparties" subtitle="The clients and providers you have agreements with." />
      <div className="dl-grid dl-grid--3">
        {parties.map(({ party, count, valueUSDC, sampleId }) => (
          <SectionCard key={party.id}>
            <div className="dl-row" style={{ padding: 0, borderBottom: 0 }}>
              <Avatar initials={party.initials} size="lg" />
              <span className="dl-row__body">
                <span className="dl-row__title" style={{ fontSize: 15 }}>{party.name}</span>
                <span className="dl-row__sub" style={{ display: "inline-flex", alignItems: "center", gap: 6, textTransform: "capitalize" }}>
                  {party.kind === "company" ? <IconBuilding /> : <IconUser />} {party.kind}
                </span>
              </span>
            </div>
            <div className="dl-divider" />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div className="dl-label">Agreements</div>
                <div className="dl-stat__value dl-stat__value-sm" style={{ fontSize: 20 }}>{count}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="dl-label">Value engaged</div>
                <div className="dl-stat__value dl-stat__value-sm" style={{ fontSize: 20 }}>{formatMoney({ amount: valueUSDC, asset: "USDC" })}</div>
              </div>
            </div>
            <div className="dl-card__foot">
              <Link to={`/app/agreements/${sampleId}`} className="dl-viewall">View agreements <IconArrowRight /></Link>
            </div>
          </SectionCard>
        ))}
      </div>
    </PageContent>
  );
}

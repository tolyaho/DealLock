/*
 * Counterparties — the directory of everyone Jordan has locked agreements with.
 * A single list of Identity rows (metal-token avatar + name + type), each with
 * its value engaged and a way in. Built only from the kit (Card + Identity +
 * Button + the reusable .dl-list module); the Identity cell is the same one the
 * Agreements table uses, at the larger `md` size.
 */
import { Button, Card, Identity, PageContainer, PageHeader } from "../../components/app";
import { IconArrowRight } from "../../components/app/icons";
import { counterparties } from "../../fixtures/agreements";
import { formatMoney } from "../../fixtures/format";

export default function CounterpartiesPage() {
  const rows = counterparties();

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

/* Counterparties (skeleton placeholder) — relationship view ships next phase. */
import { EmptyState, PageContainer, PageHeader } from "../../components/app";
import { IconCounterparties } from "../../components/app/icons";

export default function CounterpartiesPage() {
  return (
    <PageContainer>
      <PageHeader title="Counterparties" subtitle="The people and companies you've locked agreements with." />
      <EmptyState
        icon={<IconCounterparties />}
        title="Relationships coming next"
        text="A directory of everyone you work with — value engaged, active agreements, and a quick way to start the next one — lands in the next phase."
      />
    </PageContainer>
  );
}

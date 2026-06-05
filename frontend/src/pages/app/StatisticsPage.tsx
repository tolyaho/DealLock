/* Statistics (skeleton placeholder) — premium charts ship next phase. */
import { EmptyState, PageContainer, PageHeader } from "../../components/app";
import { IconStatistics } from "../../components/app/icons";

export default function StatisticsPage() {
  return (
    <PageContainer>
      <PageHeader title="Statistics" subtitle="Performance, fund flow, and agreement activity." />
      <EmptyState
        icon={<IconStatistics />}
        title="Insights coming next"
        text="Monochrome, single-accent charts for escrowed value, releases, and milestone completion will live here — built on the same calm surfaces."
      />
    </PageContainer>
  );
}

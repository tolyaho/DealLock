/* Activity (skeleton placeholder) — the indexed event timeline ships next phase. */
import { EmptyState, PageContainer, PageHeader } from "../../components/app";
import { IconActivity } from "../../components/app/icons";

export default function ActivityPage() {
  return (
    <PageContainer>
      <PageHeader title="Activity" subtitle="A chain-true timeline of every event across your agreements." />
      <EmptyState
        icon={<IconActivity />}
        title="Timeline coming next"
        text="This screen will stream indexed on-chain events — funded, submitted, approved, released — in one calm feed. The foundation it's built on is ready."
      />
    </PageContainer>
  );
}

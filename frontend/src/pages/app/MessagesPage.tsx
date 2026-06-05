/* Messages (skeleton placeholder) — agreement-scoped messaging ships next phase. */
import { EmptyState, PageContainer, PageHeader } from "../../components/app";
import { IconMessages } from "../../components/app/icons";

export default function MessagesPage() {
  return (
    <PageContainer>
      <PageHeader title="Messages" subtitle="Agreement-scoped coordination with your counterparties." />
      <EmptyState
        icon={<IconMessages />}
        title="Secure messaging on the way"
        text="Threaded, agreement-scoped messaging will live here, tied to each contract. For now, coordinate on the agreement timeline."
      />
    </PageContainer>
  );
}

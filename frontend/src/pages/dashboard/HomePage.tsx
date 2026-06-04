/* Home / Overview. Greets the user, then shows the overview for whichever
 * workspace is active — same page, two modes (the toggle in the top bar
 * switches the body without changing nav, type, or component language). */
import { PageContent } from "../../components/dashboard/Page";
import PageHeader from "../../components/dashboard/PageHeader";
import { useWorkspace } from "../../components/dashboard/WorkspaceContext";
import { Assurance } from "../../components/dashboard/primitives";
import { ClientOverview, ProviderOverview } from "./overviews";

export default function HomePage() {
  const { workspace } = useWorkspace();
  const isClient = workspace === "client";

  return (
    <PageContent>
      <PageHeader
        title="Good morning, Jordan."
        subtitle={
          isClient
            ? "Here's what's happening across your agreements."
            : "Here's what's happening across your work."
        }
      />
      {isClient ? <ClientOverview /> : <ProviderOverview />}
      <Assurance>
        Funds are held in non-custodial escrow contracts — released only on milestone approval.
      </Assurance>
    </PageContent>
  );
}

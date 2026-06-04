/* Provider workspace (/app/provider). Defaults the mode to provider on mount,
 * then honors the top-bar toggle like Home — switching to Client in place shows
 * the client overview (one app, two modes; the toggle is never stuck). */
import { useEffect } from "react";
import { PageContent } from "../../components/dashboard/Page";
import PageHeader from "../../components/dashboard/PageHeader";
import { useWorkspace } from "../../components/dashboard/WorkspaceContext";
import { Assurance } from "../../components/dashboard/primitives";
import { ClientOverview, ProviderOverview } from "./overviews";

export default function ProviderPage() {
  const { workspace, setWorkspace } = useWorkspace();

  // Default to provider mode on first mount only (setWorkspace is stable), so a
  // later toggle to Client isn't immediately forced back.
  useEffect(() => {
    setWorkspace("provider");
  }, [setWorkspace]);

  const isProvider = workspace !== "client";

  return (
    <PageContent>
      <PageHeader
        eyebrow={isProvider ? "Provider workspace" : "Client workspace"}
        title="Good morning, Jordan."
        subtitle={
          isProvider
            ? "Track submissions, funded milestones, and earnings across your contracts."
            : "Here's what's happening across your agreements."
        }
      />
      {isProvider ? <ProviderOverview /> : <ClientOverview />}
      <Assurance>
        {isProvider
          ? "Earnings are released from escrow to your linked wallet on client approval."
          : "Funds are held in non-custodial escrow contracts — released only on milestone approval."}
      </Assurance>
    </PageContent>
  );
}

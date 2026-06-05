/*
 * Home (skeleton) — workspace-aware. Demonstrates the foundation working end to
 * end: a metric strip + a quick-action grid that swap with the Client/Provider
 * mode. Intentionally light — the real command-center layout comes in a later
 * phase. No product flows are wired here.
 */
import { useNavigate } from "react-router-dom";
import {
  ActionTile,
  Card,
  MetricCard,
  PageContainer,
  PageHeader,
  useWorkspace,
} from "../../components/app";
import {
  IconAgreements,
  IconBolt,
  IconPlus,
  IconShield,
  IconUpload,
} from "../../components/app/icons";
import { ME, clientMetrics, providerMetrics } from "../../fixtures/agreements";
import { formatMoney } from "../../fixtures/format";

export default function HomePage() {
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const toAgreements = () => navigate("/app/agreements");

  const client = clientMetrics();
  const provider = providerMetrics();

  return (
    <PageContainer>
      <PageHeader
        eyebrow={workspace === "client" ? "Client workspace" : "Provider workspace"}
        title={`Welcome back, ${ME}`}
        subtitle={
          workspace === "client"
            ? "Track funded work and release milestones with confidence."
            : "Submit deliverables and watch escrow release as milestones clear."
        }
      />

      <div className="dl-grid-metrics">
        {workspace === "client" ? (
          <>
            <MetricCard label="In escrow" value={formatMoney({ amount: client.locked, asset: "USDC" })} meta="Across live agreements" />
            <MetricCard label="Active agreements" value={client.activeCount} meta="In progress now" />
            <MetricCard label="Needs your review" value={client.attention.length} meta="Submissions & drafts" trend={client.attention.length ? "up" : undefined} />
          </>
        ) : (
          <>
            <MetricCard label="Released to you" value={formatMoney({ amount: provider.earningsUSDC, asset: "USDC" })} meta="Lifetime" />
            <MetricCard label="Funded milestones" value={provider.fundedMilestones} meta="Currently in play" />
            <MetricCard label="Awaiting review" value={provider.pendingSubmissions} meta="Submitted work" trend={provider.pendingSubmissions ? "up" : undefined} />
          </>
        )}
      </div>

      <Card label="Quick actions">
        <div className="dl-grid-metrics">
          {workspace === "client" ? (
            <>
              <ActionTile icon={<IconPlus />} label="New agreement" sub="Draft escrow terms" onClick={toAgreements} />
              <ActionTile icon={<IconShield />} label="Release milestone" sub="Approve & pay out" onClick={toAgreements} />
              <ActionTile icon={<IconAgreements />} label="Review submissions" sub="See what's pending" onClick={toAgreements} />
            </>
          ) : (
            <>
              <ActionTile icon={<IconUpload />} label="Submit work" sub="Mark a milestone done" onClick={toAgreements} />
              <ActionTile icon={<IconAgreements />} label="My agreements" sub="Open active work" onClick={toAgreements} />
              <ActionTile icon={<IconBolt />} label="Request revision deadline" sub="Propose a new date" onClick={toAgreements} />
            </>
          )}
        </div>
      </Card>
    </PageContainer>
  );
}

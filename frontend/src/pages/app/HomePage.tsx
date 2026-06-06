/*
 * Home — the role-aware command center. Client and Provider share ONE layout
 * system (KPI strip → primary "needs attention" + supporting progress · activity
 * + quick actions) and differ only in content + actions, per the Phase-2 brief.
 *
 * Built entirely from the foundation: PageHeader, MetricCard, Card, StatusChip,
 * Button, ActionTile + the reusable .dl-list / .dl-feed / .dl-progress modules.
 * No product flows are wired; actionable items route to the Agreements list.
 */
import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import {
  ActionTile,
  Button,
  Card,
  MetricCard,
  PageContainer,
  PageHeader,
  StatusChip,
  useWorkspace,
  type ChipTone,
} from "../../components/app";
import {
  IconAgreements,
  IconArrowRight,
  IconCheck,
  IconDollar,
  IconEdit,
  IconFile,
  IconLock,
  IconMessages,
  IconPlus,
  IconRevision,
  IconShield,
  IconUpload,
} from "../../components/app/icons";
import {
  ACTIVITY,
  ME,
  STATUS_LABEL,
  agreementsForRole,
  attentionFor,
  clientMetrics,
  counterparty,
  currentMilestone,
  milestoneProgress,
  providerMetrics,
  rowAction,
  type ActionKind,
} from "../../fixtures/agreements";
import { formatMoney } from "../../fixtures/format";
import type { ActivityEvent, ActivityKind, Agreement, AgreementStatus, Role } from "../../fixtures/types";

const TONE: Record<AgreementStatus, ChipTone> = {
  active: "secure",
  in_review: "review",
  approved: "secure",
  released: "secure",
  revision_requested: "review",
  completed: "neutral",
  draft: "neutral",
};

const ACTION_ICON: Record<ActionKind, ReactNode> = {
  view: <IconArrowRight />,
  review: <IconShield />,
  sign: <IconEdit />,
  release: <IconShield />,
  submit: <IconUpload />,
  resubmit: <IconUpload />,
};

const FEED: Record<ActivityKind, { icon: ReactNode; tone?: "secure" | "review" }> = {
  created: { icon: <IconPlus /> },
  funded: { icon: <IconDollar />, tone: "secure" },
  submitted: { icon: <IconUpload />, tone: "review" },
  approved: { icon: <IconCheck />, tone: "secure" },
  released: { icon: <IconShield />, tone: "secure" },
  revision_requested: { icon: <IconRevision />, tone: "review" },
  message: { icon: <IconMessages /> },
  completed: { icon: <IconCheck />, tone: "secure" },
};

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function AttentionRow({ a, role, onAct }: { a: Agreement; role: Role; onAct: () => void }) {
  const act = rowAction(a, role);
  const ms = currentMilestone(a);
  return (
    <div className="dl-list__row">
      <div className="dl-list__main">
        <span className="dl-list__title">{a.title}</span>
        <span className="dl-list__sub">
          {counterparty(a).name}
          {ms ? ` · Milestone ${ms.order} — ${ms.title}` : ""}
        </span>
      </div>
      <div className="dl-list__end">
        <StatusChip tone={TONE[a.status]}>{STATUS_LABEL[a.status]}</StatusChip>
        <Button size="sm" variant={act.variant} icon={ACTION_ICON[act.kind]} onClick={onAct}>
          {act.label}
        </Button>
      </div>
    </div>
  );
}

function FeedItem({ e }: { e: ActivityEvent }) {
  const f = FEED[e.kind];
  return (
    <div className="dl-feed__item">
      <span className={`dl-feed__icon${f.tone ? ` dl-feed__icon--${f.tone}` : ""}`} aria-hidden="true">
        {f.icon}
      </span>
      <div className="dl-feed__body">
        <span className="dl-feed__text">
          <b>{e.label}</b>
        </span>
        <span className="dl-feed__meta">
          {e.agreementTitle} · {e.actor}
          {e.value ? (
            <>
              {" · "}
              <span className="dl-feed__amount">{formatMoney(e.value)}</span>
            </>
          ) : null}
        </span>
      </div>
      <span className="dl-feed__time">{e.when}</span>
    </div>
  );
}

function ProgressRow({ a }: { a: Agreement }) {
  const p = milestoneProgress(a);
  const pct = Math.round(p.fraction * 100);
  return (
    <div className="dl-progress__row">
      <div className="dl-progress__head">
        <span className="dl-progress__name">{a.title}</span>
        <span className="dl-progress__val">
          {p.doneCount}/{p.total} milestones
        </span>
      </div>
      <div className="dl-progress__track">
        <div className="dl-progress__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="dl-progress__meta">
        {formatMoney({ amount: p.doneValue, asset: p.asset })} of{" "}
        {formatMoney({ amount: p.totalValue, asset: p.asset })} released
      </div>
    </div>
  );
}

export default function HomePage() {
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const go = (status?: string) =>
    navigate(status ? `/app/agreements?status=${status}` : "/app/agreements");

  const isClient = workspace === "client";
  const c = clientMetrics();
  const p = providerMetrics();

  const attentionAll = attentionFor(workspace);
  const attention = attentionAll.slice(0, 4);
  const progress = agreementsForRole(workspace)
    .filter((a) => a.status !== "completed" && a.status !== "draft" && a.milestones.length > 0)
    .slice(0, 3);
  const activity = ACTIVITY.slice(0, 6);

  return (
    <PageContainer>
      <PageHeader
        title={`${greeting()}, ${ME}.`}
        subtitle={
          isClient
            ? "Here's what's happening with your deals."
            : "Track submissions, funded milestones, and earnings across your contracts."
        }
        actions={
          isClient ? (
            <Button variant="primary" icon={<IconPlus />} onClick={() => go()}>
              New agreement
            </Button>
          ) : (
            <Button variant="primary" icon={<IconUpload />} onClick={() => go()}>
              Submit work
            </Button>
          )
        }
      />

      {/* KPI strip */}
      <div className="dl-grid-metrics">
        {isClient ? (
          <>
            <MetricCard label="In escrow" value={formatMoney({ amount: c.locked, asset: "USDC" })} meta="Across live agreements" icon={<IconLock />} tone="secure" />
            <MetricCard label="Needs review" value={c.needsReview} meta="Submitted for approval" icon={<IconShield />} tone="review" onClick={() => go("in_review")} />
            <MetricCard label="Active agreements" value={c.activeCount} meta="In progress" icon={<IconAgreements />} onClick={() => go("active")} />
            <MetricCard label="Pending funding" value={c.pendingFunding} meta="Drafts to sign" icon={<IconEdit />} onClick={() => go("draft")} />
          </>
        ) : (
          <>
            <MetricCard label="Earnings released" value={formatMoney({ amount: p.earningsUSDC, asset: "USDC" })} meta="Lifetime" icon={<IconDollar />} tone="secure" />
            <MetricCard label="Pending submissions" value={p.pendingSubmissions} meta="Awaiting client review" icon={<IconUpload />} tone="review" onClick={() => go("in_review")} />
            <MetricCard label="Funded milestones" value={p.fundedMilestones} meta="Currently in play" icon={<IconLock />} />
            <MetricCard label="Revision requests" value={p.revisionRequests} meta="Needs your changes" icon={<IconRevision />} tone="review" onClick={() => go("active")} />
          </>
        )}
      </div>

      {/* primary column (attention + progress) · supporting column (activity + actions) */}
      <div className="dl-home__grid">
        <div className="dl-home__col">
          <Card
            variant="raised"
            label="Needs your attention"
            action={
              <span className="dl-card__actions">
                {attentionAll.length > 0 && (
                  <StatusChip tone="review">{attentionAll.length} to act</StatusChip>
                )}
                <Button variant="ghost" size="sm" onClick={() => go()}>
                  All agreements
                </Button>
              </span>
            }
          >
            {attention.length ? (
              <div className="dl-list">
                {attention.map((a) => (
                  <AttentionRow key={a.id} a={a} role={workspace} onAct={() => go()} />
                ))}
              </div>
            ) : (
              <div className="dl-mini-empty">
                <span className="dl-mini-empty__icon" aria-hidden="true">
                  <IconCheck />
                </span>
                <div className="dl-mini-empty__title">You're all caught up</div>
                <div className="dl-mini-empty__text">Nothing needs your action right now.</div>
              </div>
            )}
          </Card>

          <Card label="Milestone progress">
            <div className="dl-progress">
              {progress.map((a) => (
                <ProgressRow key={a.id} a={a} />
              ))}
            </div>
          </Card>
        </div>

        <div className="dl-home__col">
          <Card
            label="Recent activity"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate("/app/activity")}>
                View all
              </Button>
            }
          >
            <div className="dl-feed">
              {activity.map((e) => (
                <FeedItem key={e.id} e={e} />
              ))}
            </div>
          </Card>

          <Card label="Quick actions">
            <div className="dl-stack">
              {isClient ? (
                <>
                  <ActionTile icon={<IconPlus />} label="New agreement" sub="Draft escrow terms" onClick={() => go()} />
                  <ActionTile icon={<IconShield />} label="Review milestone" sub="Approve & release" onClick={() => go("in_review")} />
                  <ActionTile icon={<IconMessages />} label="Message counterparty" sub="Open a conversation" onClick={() => navigate("/app/messages")} />
                </>
              ) : (
                <>
                  <ActionTile icon={<IconUpload />} label="Submit work" sub="Mark a milestone done" onClick={() => go()} />
                  <ActionTile icon={<IconFile />} label="Upload proof" sub="Attach deliverables" onClick={() => go()} />
                  <ActionTile icon={<IconMessages />} label="Message client" sub="Open a conversation" onClick={() => navigate("/app/messages")} />
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

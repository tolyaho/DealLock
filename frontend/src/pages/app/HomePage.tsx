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
  MetalCTA,
  MetricCard,
  PageContainer,
  PageHeader,
  SkeletonButton,
  SkeletonCard,
  SkeletonCircle,
  SkeletonText,
  StatusChip,
  usePageLoading,
  useRoleConfig,
  useWorkspace,
  type ChipTone,
} from "../../components/app";
import {
  IconAgreements,
  IconArrowRight,
  IconCheck,
  IconDollar,
  IconEdit,
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
  funded: { icon: <IconDollar /> }, // funding reads neutral silver, not sage — sage is reserved for release/approval

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
  // The signature row actions (Sign / Submit / Resubmit) use a brushed-metal
  // keycap instead of the dark graphite primary — silver, not black. Release
  // stays sage (positive), Review satin (secondary), View chromeless (ghost).
  const variant = act.variant === "primary" ? "metal" : act.variant;
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
        <Button size="sm" variant={variant} icon={ACTION_ICON[act.kind]} onClick={onAct}>
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
        <span className="dl-feed__time">{e.when}</span>
      </div>
    </div>
  );
}

function ProgressRow({ a }: { a: Agreement }) {
  const p = milestoneProgress(a);
  // The fill must match the DISPLAYED fraction exactly: completed milestones over
  // total (by count, matching "{doneCount}/{total} milestones"), clamped 0–100.
  const fillPercent = p.total > 0 ? Math.max(0, Math.min((p.doneCount / p.total) * 100, 100)) : 0;
  return (
    <div className="dl-progress__row">
      <div className="dl-progress__head">
        <span className="dl-progress__name">{a.title}</span>
        <span className="dl-progress__val">
          {p.doneCount}/{p.total} milestones
        </span>
      </div>
      <div className="dl-progress__track">
        <div
          className={`dl-progress__fill${fillPercent >= 100 ? " dl-progress__fill--full" : ""}`}
          style={{ width: `${fillPercent}%` }}
        />
      </div>
      <div className="dl-progress__meta">
        {formatMoney({ amount: p.doneValue, asset: p.asset })} of{" "}
        {formatMoney({ amount: p.totalValue, asset: p.asset })} released
      </div>
    </div>
  );
}

type MetricTone = "secure" | "review" | "technical" | "neutral";

// Home loading skeleton — mirrors the KPI strip + the 2×2 card grid so the swap
// to real content causes no layout shift. Card skeletons reuse the real .dl-card.
function HomeSkeleton() {
  return (
    <div aria-busy="true">
      <div className="dl-grid-metrics">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="dl-skel-metric">
            <SkeletonText width="52%" />
            <span className="dl-skel dl-skel-line" style={{ width: "44%", height: 26 }} />
            <SkeletonText width="68%" className="dl-skel-line--sm" />
          </SkeletonCard>
        ))}
      </div>
      <div className="dl-home__grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i}>
            <div className="dl-skel-cardhead">
              <SkeletonText width="38%" />
              <SkeletonButton width={84} />
            </div>
            {Array.from({ length: 3 }).map((_, r) => (
              <div className="dl-skel-row" key={r}>
                <SkeletonCircle size={34} />
                <span className="dl-skel-row__main">
                  <span className="dl-skel dl-skel-line" style={{ width: "56%" }} />
                  <span className="dl-skel dl-skel-line dl-skel-line--sm" style={{ width: "38%" }} />
                </span>
              </div>
            ))}
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { workspace } = useWorkspace();
  const cfg = useRoleConfig();
  const navigate = useNavigate();
  const loading = usePageLoading();
  const go = (status?: string) =>
    navigate(status ? `/app/agreements?status=${status}` : "/app/agreements");
  // The role's CREATE action opens the guided wizard (client → agreement,
  // provider → proposal), carrying the workspace in the URL for deep links.
  const goCreate = () => navigate(`/app/create?workspace=${workspace}`);

  const isClient = workspace === "client";
  const c = clientMetrics();
  const p = providerMetrics();

  // KPI strip. The copy — label, helper, and ORDER — comes from the role config
  // (the source of truth); the computed value, identity glyph, accent tone, and
  // deep-link stay here (presentational) and bind to each tile by its config
  // `key`. So changing the wording or priorities is a config edit, not a JSX one.
  const kpiView: Record<
    string,
    { value: ReactNode; icon: ReactNode; tone?: MetricTone; status?: string; primary?: boolean }
  > = isClient
    ? {
        inEscrow: { value: formatMoney({ amount: c.locked, asset: "USDC" }), icon: <IconLock />, tone: "secure", primary: true },
        needsReview: { value: c.needsReview, icon: <IconShield />, tone: "review", status: "in_review" },
        activeAgreements: { value: c.activeCount, icon: <IconAgreements />, status: "active" },
        pendingFunding: { value: c.pendingFunding, icon: <IconEdit />, status: "draft" },
      }
    : {
        expectedPayout: { value: formatMoney({ amount: p.expectedPayout, asset: "USDC" }), icon: <IconDollar />, tone: "secure", primary: true },
        awaitingApproval: { value: p.awaitingApproval, icon: <IconUpload />, tone: "review", status: "in_review" },
        activeWork: { value: p.activeWork, icon: <IconLock /> },
        readyToWithdraw: { value: formatMoney({ amount: p.readyToWithdraw, asset: "USDC" }), icon: <IconShield />, tone: "secure" },
      };

  // Quick actions. Labels/helpers come from the role config; the icon + the
  // navigation target stay here, bound by the config `key`.
  const quickView: Record<string, { icon: ReactNode; onClick: () => void }> = isClient
    ? {
        newAgreement: { icon: <IconPlus />, onClick: goCreate },
        reviewMilestone: { icon: <IconShield />, onClick: () => go("in_review") },
        message: { icon: <IconMessages />, onClick: () => navigate("/app/messages") },
      }
    : {
        submitMilestone: { icon: <IconUpload />, onClick: () => go() },
        requestApproval: { icon: <IconShield />, onClick: () => go("in_review") },
        message: { icon: <IconMessages />, onClick: () => navigate("/app/messages") },
      };

  const primaryIcon = cfg.primaryAction.icon === "upload" ? <IconUpload /> : <IconPlus />;

  const attentionAll = attentionFor(workspace);
  const attention = attentionAll.slice(0, 3);
  const progress = agreementsForRole(workspace)
    .filter((a) => a.status !== "completed" && a.status !== "draft" && a.milestones.length > 0)
    .slice(0, 3);
  const activity = ACTIVITY.slice(0, 4);

  return (
    <PageContainer>
      <PageHeader
        title={`${greeting()}, ${ME}.`}
        subtitle={cfg.greetingSubtitle}
        actions={
          <MetalCTA icon={primaryIcon} onClick={goCreate}>
            {cfg.primaryAction.label}
          </MetalCTA>
        }
      />

      {loading ? (
        <HomeSkeleton />
      ) : (
      <>
      {/* KPI strip — copy + order from the role config, values bound by key. */}
      <div className="dl-grid-metrics">
        {cfg.kpis.map((k) => {
          const v = kpiView[k.key];
          return (
            <MetricCard
              key={k.key}
              label={k.label}
              value={v.value}
              meta={k.helper}
              icon={v.icon}
              tone={v.tone}
              primary={v.primary}
              onClick={v.status ? () => go(v.status) : undefined}
            />
          );
        })}
      </div>

      {/* Main grid — one true 2×2: primary (wider) + supporting (narrower) columns.
       * Row 1: Needs attention | Recent activity. Row 2: Milestone progress |
       * Quick actions. Cards are direct grid children (no per-column stacks) so
       * each row's pair aligns on one clean horizontal edge. */}
      <div className="dl-home__grid">
        <Card
          variant="raised"
          className="dl-card--attention"
          label={cfg.attention.title}
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
              <div className="dl-mini-empty__title">{cfg.attention.emptyTitle}</div>
              <div className="dl-mini-empty__text">{cfg.attention.emptyDescription}</div>
            </div>
          )}
        </Card>

        <Card
          className="dl-card--activity"
          label="Recent activity"
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate("/app/activity")}>
              View all
            </Button>
          }
        >
          {activity.length ? (
            <div className="dl-feed">
              {activity.map((e) => (
                <FeedItem key={e.id} e={e} />
              ))}
            </div>
          ) : (
            <div className="dl-mini-empty">
              <span className="dl-mini-empty__icon" aria-hidden="true">
                <IconMessages />
              </span>
              <div className="dl-mini-empty__title">Nothing yet</div>
              <div className="dl-mini-empty__text">
                Milestone updates, submissions, and releases will show up here as your agreements move.
              </div>
            </div>
          )}
        </Card>

        <Card label="Milestone progress" className="dl-card--instrument">
          {progress.length ? (
            <div className="dl-progress">
              {progress.map((a) => (
                <ProgressRow key={a.id} a={a} />
              ))}
            </div>
          ) : (
            <div className="dl-mini-empty">
              <span className="dl-mini-empty__icon" aria-hidden="true">
                <IconLock />
              </span>
              <div className="dl-mini-empty__title">No active milestones</div>
              <div className="dl-mini-empty__text">
                Once an agreement is funded, its milestone progress tracks here.
              </div>
            </div>
          )}
        </Card>

        <Card label="Quick actions">
          <div className="dl-stack">
            {cfg.quickActions.map((q) => {
              const v = quickView[q.key];
              return (
                <ActionTile key={q.key} icon={v.icon} label={q.label} sub={q.helper} onClick={v.onClick} />
              );
            })}
          </div>
        </Card>
      </div>
      </>
      )}
    </PageContainer>
  );
}

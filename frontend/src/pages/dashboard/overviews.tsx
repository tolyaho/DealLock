/*
 * The two workspace overviews. Same component language (cards, rows, steppers,
 * CTAs) — only the emphasis differs:
 *   ClientOverview   — escrowed value, items needing approval, milestone progress
 *   ProviderOverview — submissions, funded milestones, earnings, quick actions
 *
 * Both are mounted by HomePage (per the active workspace) and ProviderOverview
 * is also the dedicated /app/provider screen.
 */
import { Link, useNavigate } from "react-router-dom";
import {
  ACTIVITY,
  clientMetrics,
  counterparty,
  getAgreement,
  providerMetrics,
} from "../../fixtures/agreements";
import type { ActivityEvent } from "../../fixtures/types";
import { formatMoney } from "../../fixtures/format";
import {
  Avatar,
  Button,
  SectionCard,
  StatusPill,
  ViewAll,
} from "../../components/dashboard/primitives";
import MilestoneStepper from "../../components/dashboard/MilestoneStepper";
import {
  IconArrowRight,
  IconCheck,
  IconDownload,
  IconMessages,
  IconRevision,
  IconSend,
  IconUpload,
} from "../../components/dashboard/icons";

function activityIcon(kind: ActivityEvent["kind"]) {
  switch (kind) {
    case "released":
    case "approved":
    case "completed":
      return <IconCheck />;
    case "revision_requested":
      return <IconRevision />;
    case "message":
      return <IconMessages />;
    case "submitted":
      return <IconUpload />;
    default:
      return <IconArrowRight />;
  }
}

function ActivityRows({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="dl-rows">
      {events.map((e) => (
        <Link key={e.id} to={`/app/agreements/${e.agreementId}`} className="dl-row dl-row--link" style={{ padding: "12px 10px" }}>
          <span className="dl-row__icon">{activityIcon(e.kind)}</span>
          <span className="dl-row__body">
            <span className="dl-row__title">{e.label}</span>
            <span className="dl-row__sub">
              {e.agreementTitle} · {e.actor}
            </span>
          </span>
          <span className="dl-row__aside">
            {e.value && <span className="dl-row__amount">{formatMoney(e.value)}</span>}
            <span className="dl-tl__time">{e.when}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ========================================================================== */
export function ClientOverview() {
  const { locked, attention } = clientMetrics();
  const featured = getAgreement("agr-001")!;

  return (
    <>
      <div className="dl-grid dl-grid--hero">
        {/* Escrowed value + metallic vault */}
        <SectionCard label="Total escrowed value">
          <div className="dl-vault">
            <div>
              <div className="dl-vault__amount">{formatMoney({ amount: locked, asset: "USDC" })}</div>
              <p className="dl-stat__meta">Secured across your active agreements.</p>
              <div style={{ marginTop: 18 }}>
                <Link to="/app/agreements" className="dl-viewall">
                  View agreements <IconArrowRight />
                </Link>
              </div>
            </div>
            <div className="dl-vault__disc" aria-hidden="true" />
          </div>
        </SectionCard>

        {/* Actions & attention */}
        <SectionCard
          label="Actions & attention"
          action={<span className="dl-pill dl-pill--review"><span className="dl-pill__dot" />{attention.length}</span>}
        >
          <div className="dl-rows">
            {attention.map((a) => {
              const isReview = a.status === "in_review";
              return (
                <div key={a.id} className="dl-row">
                  <span className="dl-row__icon">{isReview ? <IconUpload /> : <IconArrowRight />}</span>
                  <span className="dl-row__body">
                    <span className="dl-row__title">{a.title}</span>
                    <span className="dl-row__sub">{counterparty(a).name}</span>
                  </span>
                  <Button small variant={isReview ? "primary" : "secondary"} onClick={() => {}}>
                    {isReview ? "Review" : "Sign"}
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="dl-card__foot">
            <ViewAll href="/app/agreements">View all</ViewAll>
          </div>
        </SectionCard>
      </div>

      <div className="dl-grid dl-grid--2">
        <SectionCard label="Recent activity">
          <ActivityRows events={ACTIVITY.slice(0, 4)} />
          <div className="dl-card__foot">
            <ViewAll href="/app/activity">View all activity</ViewAll>
          </div>
        </SectionCard>

        <SectionCard
          label="Milestone progress"
          title={featured.title}
          action={<StatusPill status={featured.status} />}
        >
          <div style={{ marginTop: 8 }}>
            <MilestoneStepper milestones={featured.milestones} currentId={featured.currentMilestoneId} />
          </div>
          <div className="dl-card__foot">
            <Link to={`/app/agreements/${featured.id}`} className="dl-viewall">
              View timeline <IconArrowRight />
            </Link>
          </div>
        </SectionCard>
      </div>
    </>
  );
}

/* ========================================================================== */
export function ProviderOverview() {
  const navigate = useNavigate();
  const { mine, pendingSubmissions, fundedMilestones, earningsUSDC, revisionRequests } =
    providerMetrics();
  const tracker = getAgreement("agr-008")!;

  const stats = [
    { label: "Pending submissions", value: String(pendingSubmissions), meta: "Awaiting client review" },
    { label: "Funded milestones", value: String(fundedMilestones), meta: "In progress or review" },
    { label: "Earnings released", value: formatMoney({ amount: earningsUSDC, asset: "USDC" }), meta: "Across your contracts" },
    { label: "Revision requests", value: String(revisionRequests), meta: "Awaiting your update" },
  ];

  return (
    <>
      <div className="dl-grid dl-grid--4">
        {stats.map((s) => (
          <SectionCard key={s.label} label={s.label}>
            <div className="dl-stat__value dl-stat__value-sm">{s.value}</div>
            <p className="dl-stat__meta">{s.meta}</p>
          </SectionCard>
        ))}
      </div>

      <div className="dl-grid dl-grid--2">
        <SectionCard label="Active contracts">
          <div className="dl-rows">
            {mine.slice(0, 5).map((a) => (
              <Link key={a.id} to={`/app/agreements/${a.id}`} className="dl-row dl-row--link" style={{ padding: "12px 10px" }}>
                <Avatar initials={a.client.initials} size="sm" />
                <span className="dl-row__body">
                  <span className="dl-row__title">{a.title}</span>
                  <span className="dl-row__sub">{a.client.name}</span>
                </span>
                <span className="dl-row__aside">
                  <span className="dl-row__amount">{formatMoney(a.locked)}</span>
                  <StatusPill status={a.status} />
                </span>
              </Link>
            ))}
          </div>
          <div className="dl-card__foot">
            <ViewAll href="/app/agreements">View all contracts</ViewAll>
          </div>
        </SectionCard>

        <div className="dl-stack">
          <SectionCard label="Milestone delivery tracker" title={tracker.title}>
            <div style={{ marginTop: 8 }}>
              <MilestoneStepper milestones={tracker.milestones} currentId={tracker.currentMilestoneId} />
            </div>
          </SectionCard>

          <SectionCard label="Quick actions">
            <div className="dl-grid dl-grid--3" style={{ gap: 12 }}>
              <Button variant="primary" icon={<IconUpload />} onClick={() => navigate(`/app/agreements/${tracker.id}/milestones/${tracker.currentMilestoneId}/review`)}>
                Submit work
              </Button>
              <Button variant="secondary" icon={<IconDownload />} comingSoon>
                Upload proof
              </Button>
              <Button variant="secondary" icon={<IconSend />} onClick={() => navigate("/app/messages")}>
                Message client
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}

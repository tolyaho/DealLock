/*
 * Agreement detail — the master view for one agreement (references 06 + 02):
 *   header (title + party chips + status) · escrowed-value vault card ·
 *   full-width milestone stepper · activity timeline · key terms · files ·
 *   a role-aware fixed bottom action bar.
 *
 * On-chain writes are not wired in this pass, so the bar's actions either
 * navigate within the app (review, messages) or are disabled with a
 * "coming soon" tooltip — never a fake success toast (quality bar §7).
 */
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  counterparty,
  getAgreement,
  myRole,
} from "../../fixtures/agreements";
import type { Agreement } from "../../fixtures/types";
import { formatMoney } from "../../fixtures/format";
import { PageContent } from "../../components/dashboard/Page";
import {
  Avatar,
  Button,
  EmptyState,
  SectionCard,
  StatusPill,
} from "../../components/dashboard/primitives";
import MilestoneStepper from "../../components/dashboard/MilestoneStepper";
import {
  IconAgreements,
  IconArrowLeft,
  IconCheck,
  IconDownload,
  IconFile,
  IconLock,
  IconRevision,
  IconSend,
  IconShield,
  IconUpload,
} from "../../components/dashboard/icons";

interface TLItem {
  id: string;
  title: string;
  meta: string;
  when: string;
  positive?: boolean;
}

// Derive a clean activity timeline from the agreement's milestones.
function buildTimeline(a: Agreement): TLItem[] {
  const items: TLItem[] = [
    { id: "created", title: "Agreement created", meta: `${a.client.name} · ${a.provider.name}`, when: a.createdAt },
  ];
  for (const m of a.milestones) {
    if (m.status === "released" || m.status === "approved" || m.status === "completed") {
      items.push({ id: `${m.id}-rel`, title: `${m.title} approved & released`, meta: formatMoney(m.value), when: m.dueDate, positive: true });
    } else if (m.status === "in_review") {
      items.push({ id: `${m.id}-sub`, title: `${m.title} submitted for review`, meta: "Awaiting client approval", when: m.dueDate });
    } else if (m.status === "revision_requested") {
      items.push({ id: `${m.id}-rev`, title: `Revision requested on ${m.title}`, meta: "Returned to provider", when: m.dueDate });
    } else if (m.status === "in_progress") {
      items.push({ id: `${m.id}-fund`, title: `${m.title} funded`, meta: `${formatMoney(m.value)} locked in escrow`, when: m.dueDate });
    }
  }
  return items.reverse();
}

const DEFAULT_TERMS = [
  "Funds release per milestone on client approval",
  "Review window applies to each submission",
  "Revision rounds included per milestone",
];

export default function AgreementDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const a = getAgreement(id);

  if (!a) {
    return (
      <PageContent>
        <EmptyState
          icon={<IconAgreements />}
          title="Agreement not found"
          text="This agreement may have been removed or the link is incorrect."
          action={<Button variant="secondary" onClick={() => navigate("/app/agreements")}>Back to agreements</Button>}
        />
      </PageContent>
    );
  }

  const role = myRole(a);
  const other = counterparty(a);
  const timeline = buildTimeline(a);
  const terms = a.terms ?? DEFAULT_TERMS;
  const files = a.files ?? [];
  const current = a.milestones.find((m) => m.id === a.currentMilestoneId);
  const reviewPath = current ? `/app/agreements/${a.id}/milestones/${current.id}/review` : undefined;
  const canApprove = role === "client" && current?.status === "in_review";

  return (
    <>
      <PageContent actionBar>
        <Link to="/app/agreements" className="dl-viewall" style={{ marginBottom: 18 }}>
          <IconArrowLeft /> Back to agreements
        </Link>

        {/* Header: title + parties on the left, escrow vault on the right */}
        <div className="dl-grid dl-grid--hero" style={{ marginBottom: 24 }}>
          <div>
            <div className="dl-pagehead__eyebrow">{role === "client" ? "Client agreement" : "Provider contract"}</div>
            <h1 className="dl-pagehead__title">{a.title}</h1>
            <p className="dl-pagehead__sub">{a.summary}</p>
            <div className="dl-chiprow" style={{ marginTop: 16 }}>
              <span className="dl-metachip"><Avatar initials={a.client.initials} size="sm" /> {a.client.name}</span>
              <span className="dl-metachip"><Avatar initials={a.provider.initials} size="sm" /> {a.provider.name}</span>
              <StatusPill status={a.status} />
            </div>
          </div>

          <SectionCard label="Total escrowed value">
            <div className="dl-vault">
              <div>
                <div className="dl-vault__amount">{formatMoney(a.locked)}</div>
                <p className="dl-stat__meta">{formatMoney(a.released)} released so far.</p>
              </div>
              <div className="dl-vault__disc" aria-hidden="true" />
            </div>
          </SectionCard>
        </div>

        {/* Milestone progress */}
        <SectionCard label="Milestone progress">
          <div className="dl-steps__meta">
            <span className="dl-muted" style={{ fontSize: 13 }}>
              {a.milestones.filter((m) => ["released", "approved", "completed"].includes(m.status)).length} of {a.milestones.length} completed
            </span>
          </div>
          <MilestoneStepper milestones={a.milestones} currentId={a.currentMilestoneId} />
        </SectionCard>

        <div className="dl-grid dl-grid--3" style={{ marginTop: 20 }}>
          {/* Activity timeline */}
          <SectionCard label="Activity timeline">
            <div className="dl-timeline">
              {timeline.map((t) => (
                <div className="dl-tl" key={t.id}>
                  <div className="dl-tl__rail">
                    <span className={`dl-tl__node${t.positive ? " dl-tl__node--positive" : ""}`}>
                      {t.positive ? <IconCheck /> : <IconUpload />}
                    </span>
                  </div>
                  <div className="dl-tl__body">
                    <div className="dl-tl__title">{t.title}</div>
                    <div className="dl-tl__meta">{t.meta} · {t.when}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Key terms */}
          <SectionCard label="Key terms">
            <div className="dl-rows">
              {terms.map((term, i) => (
                <div className="dl-row" key={i} style={{ padding: "11px 0" }}>
                  <span className="dl-row__icon" style={{ width: 30, height: 30, color: "var(--dash-positive)" }}>
                    <IconCheck />
                  </span>
                  <span className="dl-row__title" style={{ fontWeight: 400 }}>{term}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Files */}
          <SectionCard label="Files & documents">
            {files.length ? (
              <div className="dl-rows">
                {files.map((f) => (
                  <div className="dl-row" key={f.id}>
                    <span className="dl-row__icon"><IconFile /></span>
                    <span className="dl-row__body">
                      <span className="dl-row__title">{f.name}</span>
                      <span className="dl-row__sub">{f.size}</span>
                    </span>
                    <button className="dl-iconbtn" aria-label={`Download ${f.name}`} title="Download">
                      <IconDownload />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dl-muted" style={{ fontSize: 13.5 }}>No files attached to this agreement yet.</p>
            )}
          </SectionCard>
        </div>
      </PageContent>

      {/* Role-aware bottom action bar */}
      <div className="dl-actionbar">
        <span className="dl-actionbar__note">
          <IconShield /> Non-custodial escrow — funds release only on milestone approval.
        </span>
        <div className="dl-actionbar__actions">
          {role === "client" ? (
            <>
              <Button variant="secondary" icon={<IconRevision />} comingSoon>Request revision</Button>
              <Button variant="secondary" icon={<IconSend />} onClick={() => navigate("/app/messages")}>Message counterparty</Button>
              {canApprove && reviewPath ? (
                <Button variant="positive" icon={<IconCheck />} onClick={() => navigate(reviewPath)}>Review &amp; approve</Button>
              ) : (
                <Button variant="primary" icon={<IconLock />} comingSoon>Approve milestone</Button>
              )}
            </>
          ) : (
            <>
              <Button variant="secondary" icon={<IconSend />} onClick={() => navigate("/app/messages")}>Message {other.kind === "company" ? "client" : "client"}</Button>
              {reviewPath ? (
                <Button variant="primary" icon={<IconUpload />} onClick={() => navigate(reviewPath)}>Submit work</Button>
              ) : (
                <Button variant="primary" icon={<IconUpload />} comingSoon>Submit work</Button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

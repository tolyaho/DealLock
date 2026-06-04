/*
 * Milestone review (priority reference 04). The screen where a client reviews a
 * submission and approves or requests a revision:
 *   left   — deliverables & attachments + proof-of-work checklist
 *   middle — submission notes + comments thread (local, mock)
 *   right  — project summary, funds at stake, milestone progress
 *   bottom — fixed action bar (role-aware)
 *
 * Comments append to local state only (no network); on-chain approve/revision
 * are disabled with a tooltip until wired — never a fake success.
 */
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  counterparty,
  getAgreement,
  getMilestone,
  myRole,
} from "../../fixtures/agreements";
import type { Comment, Deliverable } from "../../fixtures/types";
import { formatMoney } from "../../fixtures/format";
import { PageContent } from "../../components/dashboard/Page";
import {
  Avatar,
  Button,
  ChecklistItem,
  EmptyState,
  MilestonePill,
  SectionCard,
} from "../../components/dashboard/primitives";
import {
  IconArrowLeft,
  IconCheck,
  IconExternal,
  IconFile,
  IconImage,
  IconLink,
  IconRevision,
  IconSend,
  IconShield,
  IconUpload,
} from "../../components/dashboard/icons";

function deliverableIcon(kind: Deliverable["kind"]) {
  switch (kind) {
    case "image":
      return <IconImage />;
    case "link":
      return <IconLink />;
    case "archive":
      return <IconUpload />;
    default:
      return <IconFile />;
  }
}

export default function MilestoneReviewPage() {
  const { id = "", milestoneId = "" } = useParams();
  const navigate = useNavigate();
  const agreement = getAgreement(id);
  const milestone = getMilestone(id, milestoneId);

  const [draft, setDraft] = useState("");
  const [comments, setComments] = useState<Comment[]>(milestone?.comments ?? []);

  if (!agreement || !milestone) {
    return (
      <PageContent>
        <EmptyState
          icon={<IconFile />}
          title="Milestone not found"
          text="This milestone may have been removed or the link is incorrect."
          action={<Button variant="secondary" onClick={() => navigate("/app/agreements")}>Back to agreements</Button>}
        />
      </PageContent>
    );
  }

  const role = myRole(agreement);
  const other = counterparty(agreement);

  function postComment() {
    const text = draft.trim();
    if (!text) return;
    setComments((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, author: "Jordan Lee", role, text, when: "Just now" },
    ]);
    setDraft("");
  }

  return (
    <>
      <PageContent actionBar>
        <Link to={`/app/agreements/${agreement.id}`} className="dl-viewall" style={{ marginBottom: 16 }}>
          <IconArrowLeft /> Back to {agreement.title}
        </Link>

        <div className="dl-pagehead" style={{ marginBottom: 22 }}>
          <div>
            <div className="dl-pagehead__eyebrow">Milestone {milestone.order} · {agreement.title}</div>
            <h1 className="dl-pagehead__title">{milestone.title}</h1>
            <p className="dl-pagehead__sub">{milestone.description}</p>
          </div>
          <div className="dl-pagehead__actions">
            <MilestonePill status={milestone.status} />
          </div>
        </div>

        <div className="dl-grid dl-grid--review">
          {/* LEFT — deliverables + checklist */}
          <div className="dl-stack">
            <SectionCard label="Deliverables & attachments">
              <div className="dl-rows">
                {(milestone.deliverables ?? []).map((d) => (
                  <div className="dl-row" key={d.id}>
                    <span className="dl-row__icon">{deliverableIcon(d.kind)}</span>
                    <span className="dl-row__body">
                      <span className="dl-row__title">{d.name}</span>
                      <span className="dl-row__sub">{d.size}</span>
                    </span>
                    <button className="dl-iconbtn" aria-label={`Open ${d.name}`} title="Open">
                      <IconExternal />
                    </button>
                  </div>
                ))}
                {!milestone.deliverables?.length && (
                  <p className="dl-muted" style={{ fontSize: 13.5 }}>No deliverables submitted yet.</p>
                )}
              </div>
            </SectionCard>

            {milestone.checklist?.length ? (
              <SectionCard label="Proof of work checklist">
                {milestone.checklist.map((c) => (
                  <ChecklistItem key={c.id} label={c.label} done={c.done} />
                ))}
              </SectionCard>
            ) : null}
          </div>

          {/* MIDDLE — submission notes + comments */}
          <div className="dl-stack">
            <SectionCard label="Submission notes">
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--dash-ink-soft)" }}>
                {milestone.submissionNotes ?? "No submission notes were provided for this milestone."}
              </p>
            </SectionCard>

            <SectionCard label="Comments" title={`${comments.length} messages`}>
              <div className="dl-rows">
                {comments.map((c) => (
                  <div className="dl-row" key={c.id} style={{ alignItems: "flex-start" }}>
                    <Avatar initials={c.author.split(" ").map((s) => s[0]).join("").slice(0, 2)} size="sm" />
                    <span className="dl-row__body">
                      <span style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                        <span className="dl-row__title">{c.author}</span>
                        <span className="dl-tl__time" style={{ textTransform: "capitalize" }}>{c.role} · {c.when}</span>
                      </span>
                      <span className="dl-row__sub" style={{ color: "var(--dash-ink-soft)", fontSize: 13.5, marginTop: 4 }}>{c.text}</span>
                    </span>
                  </div>
                ))}
                {!comments.length && <p className="dl-muted" style={{ fontSize: 13.5 }}>No comments yet.</p>}
              </div>
              <div className="dl-divider" />
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  className="dl-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") postComment(); }}
                  placeholder="Write a comment…"
                  aria-label="Write a comment"
                />
                <Button variant="secondary" icon={<IconSend />} onClick={postComment}>Send</Button>
              </div>
            </SectionCard>
          </div>

          {/* RIGHT — summary */}
          <div className="dl-stack">
            <SectionCard label="Project summary">
              <div className="dl-rows">
                <div className="dl-row" style={{ padding: "10px 0" }}>
                  <Avatar initials={agreement.client.initials} size="sm" />
                  <span className="dl-row__body">
                    <span className="dl-row__sub">Client</span>
                    <span className="dl-row__title">{agreement.client.name}</span>
                  </span>
                </div>
                <div className="dl-row" style={{ padding: "10px 0" }}>
                  <Avatar initials={agreement.provider.initials} size="sm" />
                  <span className="dl-row__body">
                    <span className="dl-row__sub">Provider</span>
                    <span className="dl-row__title">{agreement.provider.name}</span>
                  </span>
                </div>
              </div>
            </SectionCard>

            <SectionCard label="Funds at stake">
              <div className="dl-stat__value">{formatMoney(milestone.value)}</div>
              <p className="dl-stat__meta">Locked in escrow for this milestone.</p>
            </SectionCard>

            <SectionCard label="Milestone progress">
              <div className="dl-rows">
                {agreement.milestones.map((m) => {
                  const done = ["released", "approved", "completed"].includes(m.status);
                  const current = m.id === milestone.id;
                  return (
                    <div className="dl-row" key={m.id} style={{ padding: "10px 0" }}>
                      <span
                        className="dl-step__node"
                        style={{
                          width: 24, height: 24,
                          background: done ? "var(--dash-positive)" : current ? "var(--dash-ink)" : "var(--dash-surface)",
                          borderColor: done ? "var(--dash-positive)" : current ? "var(--dash-ink)" : "var(--dash-line-strong)",
                          color: done || current ? "#f6faf6" : "var(--dash-faint)",
                        }}
                      >
                        {done ? <IconCheck /> : m.order}
                      </span>
                      <span className="dl-row__body">
                        <span className="dl-row__title" style={{ fontWeight: current ? 600 : 400 }}>{m.title}</span>
                      </span>
                      <span className="dl-row__amount" style={{ fontSize: 13 }}>{formatMoney(m.value)}</span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </div>
        </div>
      </PageContent>

      {/* Action bar */}
      <div className="dl-actionbar">
        <span className="dl-actionbar__note">
          <IconShield /> Approving releases {formatMoney(milestone.value)} from escrow.
        </span>
        <div className="dl-actionbar__actions">
          <Button variant="ghost" icon={<IconExternal />} comingSoon>View on-chain</Button>
          {role === "client" ? (
            <>
              <Button variant="secondary" icon={<IconRevision />} comingSoon>Request revision</Button>
              <Button variant="positive" icon={<IconCheck />} comingSoon>Approve milestone</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" icon={<IconSend />} onClick={() => navigate("/app/messages")}>Message {other.name.split(" ")[0]}</Button>
              <Button variant="primary" icon={<IconUpload />} comingSoon>Upload proof</Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

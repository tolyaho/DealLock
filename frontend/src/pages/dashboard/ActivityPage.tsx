/* Activity / timeline — a chronological feed of agreement events (mirrors the
 * indexer's ChainEvent concept: created, funded, submitted, approved, released,
 * revision, completed). One clean vertical timeline. */
import { Link } from "react-router-dom";
import { ACTIVITY } from "../../fixtures/agreements";
import type { ActivityEvent } from "../../fixtures/types";
import { formatMoney } from "../../fixtures/format";
import { PageContent } from "../../components/dashboard/Page";
import PageHeader from "../../components/dashboard/PageHeader";
import { SectionCard } from "../../components/dashboard/primitives";
import {
  IconCheck,
  IconMessages,
  IconRevision,
  IconUpload,
  IconLock,
} from "../../components/dashboard/icons";

function node(kind: ActivityEvent["kind"]) {
  const positive = kind === "released" || kind === "approved" || kind === "completed";
  let icon = <IconUpload />;
  if (positive) icon = <IconCheck />;
  else if (kind === "revision_requested") icon = <IconRevision />;
  else if (kind === "message") icon = <IconMessages />;
  else if (kind === "funded") icon = <IconLock />;
  return { positive, icon };
}

export default function ActivityPage() {
  return (
    <PageContent>
      <PageHeader title="Activity" subtitle="A timeline of everything happening across your agreements." />
      <SectionCard label="Recent timeline">
        <div className="dl-timeline">
          {ACTIVITY.map((e) => {
            const { positive, icon } = node(e.kind);
            return (
              <div className="dl-tl" key={e.id}>
                <div className="dl-tl__rail">
                  <span className={`dl-tl__node${positive ? " dl-tl__node--positive" : ""}`}>{icon}</span>
                </div>
                <div className="dl-tl__body" style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div className="dl-tl__title">{e.label}</div>
                    <div className="dl-tl__meta">
                      <Link to={`/app/agreements/${e.agreementId}`} style={{ color: "var(--dash-ink-soft)" }}>{e.agreementTitle}</Link>
                      {" · "}{e.actor}{e.value ? ` · ${formatMoney(e.value)}` : ""}
                    </div>
                  </div>
                  <span className="dl-tl__time">{e.when}</span>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </PageContent>
  );
}

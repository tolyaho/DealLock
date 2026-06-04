/* Messages — placeholder on the same shell. A conversation list (derived from
 * real counterparties) beside an honest "coming soon" pane. No fake send. */
import { useState } from "react";
import { AGREEMENTS, counterparty } from "../../fixtures/agreements";
import { PageContent } from "../../components/dashboard/Page";
import PageHeader from "../../components/dashboard/PageHeader";
import { Avatar, EmptyState, SectionCard } from "../../components/dashboard/primitives";
import { IconMessages } from "../../components/dashboard/icons";

export default function MessagesPage() {
  const conversations = AGREEMENTS.slice(0, 6).map((a) => ({
    id: a.id,
    party: counterparty(a),
    preview: a.title,
  }));
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <PageContent>
      <PageHeader title="Messages" subtitle="Coordinate with counterparties on your agreements." />
      <div className="dl-grid dl-grid--threads">
        <SectionCard flush>
          <div className="dl-rows" style={{ padding: "8px 12px" }}>
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`dl-row dl-row--link${selected === c.id ? " is-active" : ""}`}
                style={{ padding: "12px 10px", textAlign: "left", border: 0, background: selected === c.id ? "var(--dash-surface-2)" : "none", width: "100%" }}
                onClick={() => setSelected(c.id)}
              >
                <Avatar initials={c.party.initials} size="md" />
                <span className="dl-row__body">
                  <span className="dl-row__title">{c.party.name}</span>
                  <span className="dl-row__sub">{c.preview}</span>
                </span>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard>
          <EmptyState
            icon={<IconMessages />}
            title="Messaging is coming soon"
            text="Threaded, agreement-scoped messaging with your counterparties will live here. For now, coordination happens off-platform."
          />
        </SectionCard>
      </div>
    </PageContent>
  );
}

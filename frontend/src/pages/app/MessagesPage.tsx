/*
 * Messages — agreement-scoped conversations (ships next phase). Copy adapts to
 * the active workspace: a client talks to providers, a provider talks to clients.
 */
import { useState } from "react";
import { EmptyStatePage, PageToolbar, SearchInput, SegmentedControl, useWorkspace } from "../../components/app";
import { IconArrowRight } from "../../components/app/icons";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
];

export default function MessagesPage() {
  const { workspace } = useWorkspace();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const counterparties = workspace === "client" ? "providers" : "clients";

  return (
    <EmptyStatePage
      title="Messages"
      subtitle="Keep agreement conversations tied to the right counterparty and milestone."
      toolbar={
        <PageToolbar
          filters={
            <SegmentedControl ariaLabel="Message filter" value={filter} onChange={setFilter} options={FILTERS} />
          }
          end={
            <div className="dl-toolbar__search">
              <SearchInput value={search} onChange={setSearch} placeholder="Search messages…" block />
            </div>
          }
        />
      }
      splineType="messages"
      emptyTitle="No conversations yet"
      emptyDescription={`Messages with ${counterparties} will appear here when an agreement starts — every thread scoped to its contract and milestone.`}
      primaryAction={{ label: "Open agreement", to: "/app/agreements", icon: <IconArrowRight /> }}
      secondaryAction={{ label: "Create agreement", to: "/app/agreements" }}
    />
  );
}

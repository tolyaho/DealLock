/*
 * Activity — the indexed event timeline (ships next phase). Until events stream
 * in, it presents a polished empty stage with the controls the live feed will
 * use (type filter + search) so the page reads as finished, not unbuilt.
 */
import { useState } from "react";
import { EmptyStatePage, PageToolbar, SearchInput, SegmentedControl } from "../../components/app";
import { IconPlus } from "../../components/app/icons";

const TYPES = [
  { value: "all", label: "All" },
  { value: "submissions", label: "Submissions" },
  { value: "releases", label: "Releases" },
  { value: "disputes", label: "Disputes" },
];

export default function ActivityPage() {
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");

  return (
    <EmptyStatePage
      title="Activity"
      subtitle="Track agreement events — submissions, approvals, releases, and disputes."
      toolbar={
        <PageToolbar
          filters={
            <SegmentedControl ariaLabel="Event type" value={type} onChange={setType} options={TYPES} />
          }
          end={
            <div className="dl-toolbar__search">
              <SearchInput value={search} onChange={setSearch} placeholder="Search activity…" block />
            </div>
          }
        />
      }
      splineType="activity"
      emptyTitle="No activity yet"
      emptyDescription="Once agreements move forward, every submission, review, release, and message will appear here in one calm feed."
      primaryAction={{ label: "Create agreement", to: "/app/agreements", icon: <IconPlus /> }}
    />
  );
}

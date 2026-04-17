import { getServiceTemplate, templateLabel, type ServiceTemplateId } from "../templates.ts";
import { type AgreementMetadata } from "../storage.ts";

const COVERS_ITEMS = [
  "Provider explicitly accepts the agreement before funding",
  "Client funds escrow for the exact on-chain total",
  "Milestones unlock in strict sequence",
  "Provider submits a non-empty delivery reference (link, hash, CID, etc.) per milestone",
  "Submission time is recorded on-chain",
  "Client approval releases that milestone’s amount to the provider",
  "If a milestone stays pending past its deadline, the client may refund that tranche in order",
];

const MANUAL_ITEMS = [
  "Subjective design or UX quality (“I don’t like it”) without a written acceptance checklist",
  "Disagreements about code quality, hidden bugs, or performance after approval",
  "Revision count or scope creep beyond the milestone text you deployed",
  "Informal Slack changes that never made it into the on-chain descriptions",
  "Aesthetic or brand “feel” conflicts not encoded in the milestone wording",
];

interface Props {
  metadata: AgreementMetadata | null;
}

function safeTemplate(id: string | undefined): ServiceTemplateId {
  if (id === "website" || id === "uiux" || id === "branding" || id === "custom") return id;
  return "custom";
}

function Panel({
  icon,
  title,
  open,
  children,
}: {
  icon: string;
  title: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="context-panel" open={open}>
      <summary>
        <span className="context-panel-icon" aria-hidden>
          {icon}
        </span>
        <h2 className="context-panel-title">{title}</h2>
        <span className="context-panel-toggle" aria-hidden />
      </summary>
      <div className="context-panel-body">{children}</div>
    </details>
  );
}

export default function AgreementContextSections({ metadata }: Props) {
  const tmplId = metadata ? safeTemplate(metadata.serviceTemplate) : "custom";
  const tmpl = getServiceTemplate(tmplId);

  return (
    <div className="context-group anim-fade-rise">
      <div className="section-header">
        <h2 className="section-header-title">Context & scope</h2>
        <span className="section-header-desc">Service brief, evidence guidance, and boundary notes</span>
      </div>

      <Panel icon="◇" title="Service context" open>
        {metadata ? (
          <>
            <p className="context-lead">
              <strong>{metadata.projectTitle}</strong>
              <span className="context-meta">
                {" "}
                · {templateLabel(tmplId)} · {metadata.serviceCategory}
              </span>
            </p>
            <p className="context-body">{tmpl.relationshipBlurb}</p>
            <p className="context-fine">
              The smart contract enforces <strong>escrow workflow and timing</strong>, not
              subjective quality judgment. Milestone text and your off-chain notes describe what
              “done” means to humans.
            </p>
            {metadata.acceptanceGuidance.trim() && (
              <div className="context-subblock">
                <h3>Acceptance guidance (off-chain)</h3>
                <p className="context-body">{metadata.acceptanceGuidance}</p>
              </div>
            )}
            <p className="context-tiny">
              Saved locally when this agreement was created ·{" "}
              {new Date(metadata.createdAt).toLocaleString()}
            </p>
          </>
        ) : (
          <>
            <p className="context-body">
              No saved project context for this contract in this browser. DealLock is framed for{" "}
              <strong>structured digital freelance deliverables</strong> with staged handoffs. Load
              from the same device where you created the agreement to see titles and notes, or rely
              on on-chain milestone text.
            </p>
            <p className="context-body">{tmpl.relationshipBlurb}</p>
          </>
        )}
      </Panel>

      <Panel icon="◎" title="Delivery evidence">
        <p className="context-body">
          On-chain storage is a <strong>submission evidence</strong> string — typically a link,
          commit hash, content hash, or IPFS CID.
        </p>
        {metadata?.evidenceGuidance.trim() && (
          <div className="context-subblock">
            <h3>For this agreement</h3>
            <p className="context-body">{metadata.evidenceGuidance}</p>
          </div>
        )}
        <div>
          <h3 style={{ margin: "0 0 var(--space-xs)", fontSize: "var(--type-small)" }}>
            Examples for {tmpl.label}
          </h3>
          <ul className="context-list">
            {tmpl.suitableEvidenceExamples.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </Panel>

      <Panel icon="✓" title="What DealLock covers">
        <ul className="context-list context-list--columns">
          {COVERS_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Panel>

      <Panel icon="!" title="What still needs manual resolution">
        <p className="context-body">
          The contract does not run arbitration, reputation, or automated QA. Plan clear milestone
          wording and off-chain checklists for anything beyond the workflow.
        </p>
        <ul className="context-list context-list--columns">
          {MANUAL_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {metadata?.disputeBoundaryNote.trim() && (
          <div className="context-subblock">
            <h3>Note for this agreement</h3>
            <p className="context-body">{metadata.disputeBoundaryNote}</p>
          </div>
        )}
      </Panel>
    </div>
  );
}

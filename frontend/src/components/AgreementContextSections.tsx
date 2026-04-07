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

export default function AgreementContextSections({ metadata }: Props) {
  const tmplId = metadata ? safeTemplate(metadata.serviceTemplate) : "custom";
  const tmpl = getServiceTemplate(tmplId);

  return (
    <>
      <section className="card context-card">
        <div className="card-header">
          <span className="card-title">Service context</span>
        </div>
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
              The smart contract enforces <strong>escrow workflow and timing</strong>, not subjective
              quality judgment. Milestone text and your off-chain notes describe what “done” should
              mean for humans.
            </p>
            {metadata.acceptanceGuidance.trim() && (
              <div className="context-subblock">
                <h3>Acceptance guidance (off-chain)</h3>
                <p className="context-body">{metadata.acceptanceGuidance}</p>
              </div>
            )}
            <p className="context-tiny dim">
              Saved locally when this agreement was created ·{" "}
              {new Date(metadata.createdAt).toLocaleString()}
            </p>
          </>
        ) : (
          <>
            <p className="context-body">
              No saved project context for this contract address in this browser. DealLock is
              framed for <strong>structured digital freelance deliverables</strong> with staged
              handoffs (sites, UI/UX, branding, small MVPs). Load from the same device/browser
              where you created the agreement to see titles and notes, or use the milestone text on
              chain as the source of truth.
            </p>
            <p className="context-body">{tmpl.relationshipBlurb}</p>
          </>
        )}
      </section>

      <section className="card context-card">
        <div className="card-header">
          <span className="card-title">Suitable delivery evidence</span>
        </div>
        <p className="context-body">
          On-chain storage is only a <strong>submission evidence</strong> string—typically a link,
          commit hash, content hash, or IPFS CID pointing at what you delivered for that milestone.
        </p>
        {metadata?.evidenceGuidance.trim() && (
          <div className="context-subblock">
            <h3>Guidance for this agreement (off-chain)</h3>
            <p className="context-body">{metadata.evidenceGuidance}</p>
          </div>
        )}
        <h3 className="context-list-title">Examples for {tmpl.label}</h3>
        <ul className="context-list">
          {tmpl.suitableEvidenceExamples.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="card context-card">
        <div className="card-header">
          <span className="card-title">What DealLock covers</span>
        </div>
        <ul className="context-list">
          {COVERS_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="card context-card">
        <div className="card-header">
          <span className="card-title">What still requires manual resolution</span>
        </div>
        <p className="context-body">
          The contract does not run arbitration, reputation, or automated QA. Plan clear milestone
          wording and off-chain checklists for anything you care about beyond the workflow below.
        </p>
        <ul className="context-list">
          {MANUAL_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {metadata?.disputeBoundaryNote.trim() && (
          <div className="context-subblock">
            <h3>Note for this agreement (off-chain)</h3>
            <p className="context-body">{metadata.disputeBoundaryNote}</p>
          </div>
        )}
      </section>
    </>
  );
}

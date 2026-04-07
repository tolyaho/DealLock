/** Service templates for milestone-based digital freelance agreements (UI + off-chain context only). */

export const SERVICE_TEMPLATE_IDS = ["website", "uiux", "branding", "custom"] as const;
export type ServiceTemplateId = (typeof SERVICE_TEMPLATE_IDS)[number];

export interface MilestoneTemplateRow {
  description: string;
  /** Shown as optional off-chain milestone note after deployment. */
  note?: string;
}

export interface ServiceTemplateDef {
  id: ServiceTemplateId;
  label: string;
  serviceCategory: string;
  /** Short description of the freelance relationship this template targets. */
  relationshipBlurb: string;
  defaultProjectTitle: string;
  milestones: MilestoneTemplateRow[];
  evidenceGuidance: string;
  acceptanceGuidance: string;
  disputeBoundaryNote: string;
  suitableEvidenceExamples: string[];
}

export const SERVICE_TEMPLATES: Record<ServiceTemplateId, ServiceTemplateDef> = {
  website: {
    id: "website",
    label: "Website Development",
    serviceCategory: "Web / landing page build",
    relationshipBlurb:
      "Structured handoffs for site or landing work: structure first, then implementation, then go-live. The contract enforces funding, sequencing, and recorded delivery references—not subjective “looks good” judgments.",
    defaultProjectTitle: "Landing page / small site build",
    milestones: [
      {
        description: "Wireframe / landing page structure",
        note: "Evidence often: Figma link, static HTML preview, or repo branch with layout-only pages.",
      },
      {
        description: "Functional frontend build",
        note: "Evidence often: GitHub repo URL, release tag, or commit range the client can review.",
      },
      {
        description: "Final deployment handoff",
        note: "Evidence often: live URL, deployment log, DNS/hosting handoff doc link, or IPFS CID.",
      },
    ],
    evidenceGuidance:
      "Use stable links: GitHub repo, release/tag, specific commit SHA, preview URL, or IPFS CID. Prefer references the client can verify without you being online.",
    acceptanceGuidance:
      "Client approves on-chain after checking the linked deliverable matches the milestone text. Agree off-chain what “done” means before funding.",
    disputeBoundaryNote:
      "Design taste, copywriting quality, SEO results, and post-launch bugs are not decided by the smart contract—only whether a non-empty delivery reference was submitted before the deadline and approved per workflow.",
    suitableEvidenceExamples: [
      "GitHub repository or release link",
      "Commit hash or compare URL",
      "Preview / staging URL",
      "Deployed site URL",
      "ZIP or build artifact hash (SHA-256)",
      "IPFS CID for static export",
    ],
  },
  uiux: {
    id: "uiux",
    label: "UI/UX Design",
    serviceCategory: "Product & interface design",
    relationshipBlurb:
      "Phased design delivery: flows and wires, then high-fidelity screens, then exportable assets. DealLock records what was submitted and when; it does not arbitrate aesthetic disputes.",
    defaultProjectTitle: "App / site UI & UX package",
    milestones: [
      {
        description: "User flow / low-fidelity wireframes",
        note: "Evidence often: Figma file link + page name, or exported PDF hash.",
      },
      {
        description: "High-fidelity Figma screens",
        note: "Evidence often: Figma link with version history or named milestone frame.",
      },
      {
        description: "Final design system + export package",
        note: "Evidence often: Figma dev handoff link, tokens ZIP hash, or asset bundle CID.",
      },
    ],
    evidenceGuidance:
      "Figma links (with version or file key), export ZIP checksums, Loom walkthrough links, or PDF hashes work well. Put the canonical reference in the on-chain submission string.",
    acceptanceGuidance:
      "Spell out in the milestone text what files or frames must exist. Approval releases funds; it is not an automated design critique.",
    disputeBoundaryNote:
      "Subjective visual preferences, illustration style, microcopy tone, and “doesn’t feel on-brand” disagreements need human conversation—the contract only enforces the escrow workflow.",
    suitableEvidenceExamples: [
      "Figma file / prototype link",
      "Named Figma version or branch",
      "Exported PDF or PNG package + SHA-256",
      "Loom or screen recording link",
      "ZIP hash for icon/font bundle",
      "IPFS CID for packaged exports",
    ],
  },
  branding: {
    id: "branding",
    label: "Branding Package",
    serviceCategory: "Logo & brand kit",
    relationshipBlurb:
      "Concepts, refinement, then final files and brand guidelines. Use each milestone’s delivery reference to point at the agreed artifact set.",
    defaultProjectTitle: "Logo & brand identity package",
    milestones: [
      {
        description: "Initial concepts",
        note: "Evidence often: PDF with concepts, Drive folder link, or Figma board link.",
      },
      {
        description: "Refined selected direction",
        note: "Evidence often: revised PDF hash or folder link after feedback round.",
      },
      {
        description: "Final logo files + brand kit",
        note: "Evidence often: ZIP of .svg/.eps/.png + guidelines PDF; include file hash.",
      },
    ],
    evidenceGuidance:
      "Prefer hashes for static bundles (ZIP/PDF) plus a link (Drive, Dropbox, or IPFS). The on-chain field should uniquely identify what the client should download.",
    acceptanceGuidance:
      "Define deliverable formats (vector, raster sizes, color modes) in milestone descriptions so approval maps to concrete files.",
    disputeBoundaryNote:
      "Trademark registrability, market research, or endless revision loops outside the written scope are out of scope for on-chain enforcement.",
    suitableEvidenceExamples: [
      "Google Drive / shared folder link",
      "ZIP archive SHA-256",
      "PDF export hash",
      "Figma brand board link",
      "IPFS CID for final kit",
    ],
  },
  custom: {
    id: "custom",
    label: "Custom Digital Deliverable",
    serviceCategory: "Other structured digital work",
    relationshipBlurb:
      "For MVPs, frontends, design systems, or hybrid deliverables. You define milestones and references; DealLock still only enforces sequential escrow and recorded submissions.",
    defaultProjectTitle: "Custom digital deliverable project",
    milestones: [
      {
        description: "Milestone 1 — describe deliverable",
        note: "Optional: what evidence you will attach (repo, Figma, hash, etc.).",
      },
      {
        description: "Milestone 2 — describe deliverable",
        note: "",
      },
      {
        description: "Milestone 3 — describe deliverable",
        note: "",
      },
    ],
    evidenceGuidance:
      "Use any stable pointer: repo URL, commit, Figma link, file hash, Loom demo, Drive folder, or IPFS CID. Avoid broken or private-only links unless the client already has access.",
    acceptanceGuidance:
      "Align each milestone description with a verifiable artifact. The client’s on-chain approval is the release trigger.",
    disputeBoundaryNote:
      "Scope creep, quality arguments, and bugs discovered after approval are social/legal topics, not enforced by this MVP contract.",
    suitableEvidenceExamples: [
      "GitHub repo / release / commit link",
      "Figma or design tool link",
      "ZIP or PDF hash",
      "Loom demo link",
      "Drive folder link",
      "IPFS CID",
    ],
  },
};

export function getServiceTemplate(id: ServiceTemplateId): ServiceTemplateDef {
  return SERVICE_TEMPLATES[id];
}

export function templateLabel(id: ServiceTemplateId): string {
  return SERVICE_TEMPLATES[id].label;
}

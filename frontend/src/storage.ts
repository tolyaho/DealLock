import { type Address } from "viem";
import { SERVICE_TEMPLATE_IDS, type ServiceTemplateId } from "./templates.ts";

function parseTemplateId(raw: unknown): ServiceTemplateId {
  if (typeof raw === "string" && (SERVICE_TEMPLATE_IDS as readonly string[]).includes(raw)) {
    return raw as ServiceTemplateId;
  }
  return "custom";
}

const META_PREFIX = "deallock_agreement_meta_";

export interface AgreementMetadata {
  contractAddress: string;
  projectTitle: string;
  serviceTemplate: ServiceTemplateId;
  serviceCategory: string;
  evidenceGuidance: string;
  acceptanceGuidance: string;
  disputeBoundaryNote: string;
  createdAt: string;
  /** Parallel to on-chain milestone indices; may be shorter if counts mismatch. */
  milestoneNotes: string[];
}

/** Fields collected in the create form before deployment (no address / timestamp yet). */
export type AgreementMetadataDraft = Omit<AgreementMetadata, "contractAddress" | "createdAt">;

function keyForAddress(addr: string): string {
  return META_PREFIX + addr.toLowerCase();
}

export function saveAgreementMetadata(meta: AgreementMetadata): void {
  try {
    localStorage.setItem(keyForAddress(meta.contractAddress), JSON.stringify(meta));
  } catch {
    /* quota or private mode — ignore */
  }
}

export function loadAgreementMetadata(address: Address | string): AgreementMetadata | null {
  try {
    const raw = localStorage.getItem(keyForAddress(String(address)));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AgreementMetadata;
    if (!parsed || typeof parsed.contractAddress !== "string") return null;
    if (!Array.isArray(parsed.milestoneNotes)) parsed.milestoneNotes = [];
    parsed.serviceTemplate = parseTemplateId(parsed.serviceTemplate);
    return parsed;
  } catch {
    return null;
  }
}

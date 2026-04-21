import { type Address } from "viem";
import { SERVICE_TEMPLATE_IDS, type ServiceTemplateId } from "./templates.ts";
import { type AgreementSidebarFilter, type Role, deriveRole } from "./types.ts";

function parseTemplateId(raw: unknown): ServiceTemplateId {
  if (typeof raw === "string" && (SERVICE_TEMPLATE_IDS as readonly string[]).includes(raw)) {
    return raw as ServiceTemplateId;
  }
  return "custom";
}

const META_PREFIX = "deallock_agreement_meta_";

const REGISTRY_KEY = "deallock_agreement_registry_v1";

export interface AgreementMetadata {
  contractAddress: string;
  projectTitle: string;
  serviceTemplate: ServiceTemplateId;
  serviceCategory: string;
  evidenceGuidance: string;
  acceptanceGuidance: string;
  disputeBoundaryNote: string;
  createdAt: string;
  milestoneNotes: string[];
}

export type AgreementMetadataDraft = Omit<AgreementMetadata, "contractAddress" | "createdAt">;

export interface AgreementRegistryEntry {
  contractAddress: string;
  projectTitle: string | null;
  serviceTemplate: ServiceTemplateId | null;
  createdAt: string | null;
  firstSeenAt: string;
  lastAccessedAt: string;
  clientAddress: string | null;
  providerAddress: string | null;
  agreementState: number | null;
}

const SIDEBAR_FILTER_KEY = "deallock_sidebar_role_filter_v1";

function keyForAddress(addr: string): string {
  return META_PREFIX + addr.toLowerCase();
}

export function normalizeContractAddress(addr: string): string {
  return addr.trim().toLowerCase();
}

export function saveAgreementMetadata(meta: AgreementMetadata): void {
  try {
    localStorage.setItem(keyForAddress(meta.contractAddress), JSON.stringify(meta));
  } catch {
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

function nowIso(): string {
  return new Date().toISOString();
}

export function loadAgreementRegistry(): AgreementRegistryEntry[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row): AgreementRegistryEntry | null => {
        if (!row || typeof row !== "object") return null;
        const r = row as Record<string, unknown>;
        const addr = typeof r.contractAddress === "string" ? normalizeContractAddress(r.contractAddress) : "";
        if (!/^0x[0-9a-f]{40}$/.test(addr)) return null;
        return {
          contractAddress: addr,
          projectTitle: typeof r.projectTitle === "string" ? r.projectTitle : null,
          serviceTemplate: r.serviceTemplate != null ? parseTemplateId(r.serviceTemplate) : null,
          createdAt: typeof r.createdAt === "string" ? r.createdAt : null,
          firstSeenAt: typeof r.firstSeenAt === "string" ? r.firstSeenAt : nowIso(),
          lastAccessedAt: typeof r.lastAccessedAt === "string" ? r.lastAccessedAt : nowIso(),
          clientAddress: typeof r.clientAddress === "string" ? r.clientAddress.toLowerCase() : null,
          providerAddress: typeof r.providerAddress === "string" ? r.providerAddress.toLowerCase() : null,
          agreementState: typeof r.agreementState === "number" ? r.agreementState : null,
        };
      })
      .filter((x): x is AgreementRegistryEntry => x !== null);
  } catch {
    return [];
  }
}

function saveAgreementRegistry(entries: AgreementRegistryEntry[]): void {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(entries));
  } catch {
  }
}

export function upsertAgreementRegistry(
  partial: Omit<AgreementRegistryEntry, "firstSeenAt" | "lastAccessedAt"> &
    Partial<Pick<AgreementRegistryEntry, "firstSeenAt" | "lastAccessedAt">>,
): AgreementRegistryEntry[] {
  const addr = normalizeContractAddress(partial.contractAddress);
  const list = loadAgreementRegistry();
  const idx = list.findIndex((e) => e.contractAddress === addr);
  const t = nowIso();
  const merged: AgreementRegistryEntry = {
    contractAddress: addr,
    projectTitle: partial.projectTitle ?? null,
    serviceTemplate: partial.serviceTemplate ?? null,
    createdAt: partial.createdAt ?? null,
    firstSeenAt: partial.firstSeenAt ?? (idx >= 0 ? list[idx]!.firstSeenAt : t),
    lastAccessedAt: partial.lastAccessedAt ?? t,
    clientAddress: partial.clientAddress ?? (idx >= 0 ? list[idx]!.clientAddress : null),
    providerAddress: partial.providerAddress ?? (idx >= 0 ? list[idx]!.providerAddress : null),
    agreementState: partial.agreementState ?? (idx >= 0 ? list[idx]!.agreementState : null),
  };
  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...list[idx]!, ...merged };
    saveAgreementRegistry(next);
    return next;
  }
  const next = [merged, ...list];
  saveAgreementRegistry(next);
  return next;
}

export function touchAgreementAccess(contractAddress: string): AgreementRegistryEntry[] {
  const addr = normalizeContractAddress(contractAddress);
  const list = loadAgreementRegistry();
  const idx = list.findIndex((e) => e.contractAddress === addr);
  if (idx < 0) return list;
  const t = nowIso();
  const next = [...list];
  next[idx] = { ...next[idx]!, lastAccessedAt: t };
  saveAgreementRegistry(next);
  return next;
}

export function removeAgreementFromRegistry(contractAddress: string): AgreementRegistryEntry[] {
  const addr = normalizeContractAddress(contractAddress);
  const next = loadAgreementRegistry().filter((e) => e.contractAddress !== addr);
  saveAgreementRegistry(next);
  return next;
}

export function syncRegistryFromChain(args: {
  contractAddress: string;
  clientAddress?: string | null;
  providerAddress?: string | null;
  agreementState?: number | null;
  projectTitle?: string | null;
  serviceTemplate?: ServiceTemplateId | null;
  createdAt?: string | null;
}): AgreementRegistryEntry[] {
  const addr = normalizeContractAddress(args.contractAddress);
  const list = loadAgreementRegistry();
  const existing = list.find((e) => e.contractAddress === addr);
  return upsertAgreementRegistry({
    contractAddress: addr,
    projectTitle: args.projectTitle ?? existing?.projectTitle ?? null,
    serviceTemplate: args.serviceTemplate ?? existing?.serviceTemplate ?? null,
    createdAt: args.createdAt ?? existing?.createdAt ?? null,
    firstSeenAt: existing?.firstSeenAt,
    lastAccessedAt: existing?.lastAccessedAt ?? nowIso(),
    clientAddress: args.clientAddress !== undefined ? args.clientAddress : existing?.clientAddress ?? null,
    providerAddress:
      args.providerAddress !== undefined ? args.providerAddress : existing?.providerAddress ?? null,
    agreementState: args.agreementState !== undefined ? args.agreementState : existing?.agreementState ?? null,
  });
}

export function loadSidebarFilter(): AgreementSidebarFilter {
  try {
    const v = localStorage.getItem(SIDEBAR_FILTER_KEY);
    if (v === "client" || v === "provider" || v === "other" || v === "all") return v;
  } catch {
  }
  return "all";
}

export function saveSidebarFilter(f: AgreementSidebarFilter): void {
  try {
    localStorage.setItem(SIDEBAR_FILTER_KEY, f);
  } catch {
  }
}

export function registryRoleForWallet(entry: AgreementRegistryEntry, wallet: Address | undefined): Role {
  return deriveRole(wallet, entry.clientAddress ?? undefined, entry.providerAddress ?? undefined);
}

export function sortRegistryEntries(
  entries: AgreementRegistryEntry[],
): AgreementRegistryEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime(),
  );
}

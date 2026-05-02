import { apiFetch } from "./client.ts";

export interface BackendAgreement {
  id: string;
  contractAddress: string;
  chainId: number;
  clientAddress: string;
  providerAddress: string;
  projectTitle: string;
  serviceTemplate: string;
  metadataJson: string;
  contractVersion: number;
  paymentAssetKind: "native" | "erc20";
  paymentTokenAddress: string | null;
  paymentSymbol: string;
  paymentDecimals: number;
  deploymentTxHash: string | null;
  deploymentBlockNumber: string | null;
  indexingStartBlock: string | null;
  lastIndexedBlock: string | null;
  lastIndexedAt: string | null;
  indexerStatus: string;
  indexerError: string | null;
  clientEmail: string | null;
  providerEmail: string | null;
  creationSource: string;
  factoryVersion: number | null;
  factoryAddress: string | null;
  factoryTxHash: string | null;
  factoryLogIndex: number | null;
  metadataHash: string | null;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
}

export async function getAgreements(filters?: {
  chainId?: number;
  role?: "client" | "provider" | "all";
}): Promise<{ agreements: BackendAgreement[] }> {
  const params = new URLSearchParams();
  if (filters?.chainId != null) params.set("chainId", String(filters.chainId));
  if (filters?.role) params.set("role", filters.role);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/agreements${qs}`);
}

export async function saveAgreementToBackend(data: {
  contractAddress: string;
  chainId: number;
  clientAddress: string;
  providerAddress: string;
  projectTitle?: string;
  serviceTemplate?: string;
  metadataJson?: Record<string, unknown>;
  contractVersion?: number;
  paymentAssetKind?: "native" | "erc20";
  paymentTokenAddress?: string | null;
  paymentSymbol?: string;
  paymentDecimals?: number;
  deploymentTxHash?: string;
  deploymentBlockNumber?: string;
  indexingStartBlock?: string;
  clientEmail?: string | null;
  providerEmail?: string | null;
  creationSource?: "factory" | "direct";
  factoryVersion?: number;
  factoryAddress?: string;
  factoryTxHash?: string;
  factoryLogIndex?: number;
  metadataHash?: string;
}): Promise<{ agreement: BackendAgreement }> {
  return apiFetch("/agreements", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function patchAgreement(
  contractAddress: string,
  updates: {
    projectTitle?: string;
    serviceTemplate?: string;
    metadataJson?: Record<string, unknown>;
    lastAccessedAt?: string;
    contractVersion?: number;
    paymentAssetKind?: "native" | "erc20";
    paymentTokenAddress?: string | null;
    paymentSymbol?: string;
    paymentDecimals?: number;
    clientEmail?: string | null;
    providerEmail?: string | null;
  },
): Promise<{ agreement: BackendAgreement }> {
  return apiFetch(`/agreements/${contractAddress}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function patchAgreementContacts(
  contractAddress: string,
  updates: {
    chainId: number;
    clientEmail?: string | null;
    providerEmail?: string | null;
  },
): Promise<{ agreement: BackendAgreement }> {
  return apiFetch(`/agreements/${contractAddress}/contacts`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

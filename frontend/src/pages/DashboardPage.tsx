import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAccount, useChainId, useReadContract, useReadContracts } from "wagmi";
import { type Address, zeroAddress } from "viem";
import { DEALLOCK_ABI } from "../contract.ts";
import { DEALLOCK_V2_ABI } from "../contractV2.ts";
import { DEALLOCK_V3_ABI } from "../contractV3.ts";
import { DEALLOCK_V4_ABI } from "../contractV4.ts";
import { DEALLOCK_V6_ABI } from "../contractV6.ts";
import {
  type AgreementSidebarFilter,
  type MilestoneData,
  type AdjustmentData,
  type DisputeData,
  type SettlementProposalData,
  type DeadlineExtensionRequestData,
  type RevisionInfo,
  type Role,
  deriveRole,
} from "../types.ts";
import { detectContractVersion, type ContractVersion } from "../contractVersion.ts";
import {
  loadAgreementMetadata,
  saveAgreementMetadata,
  upsertAgreementRegistry,
  syncRegistryFromChain,
  touchAgreementAccess,
  loadSidebarFilter,
  saveSidebarFilter,
  normalizeContractAddress,
  loadAgreementRegistry,
  type AgreementMetadata,
  type AgreementMetadataDraft,
  type AgreementRegistryEntry,
} from "../storage.ts";
import {
  isSupportedChain,
  switchToSepolia,
  chainName,
  explorerAddressUrl,
  isSepoliaChain,
  HARDHAT_CHAIN_ID,
} from "../network.ts";
import { type ServiceTemplateId, SERVICE_TEMPLATE_IDS } from "../templates.ts";
import { isFactoryConfigured, isFactoryV2Configured, isFactoryV3Configured } from "../contractFactory.ts";
import { getAgreements, saveAgreementToBackend, type BackendAgreement } from "../api/agreements.ts";
import { getAgreementActivity, type ActivityEvent } from "../api/activity.ts";
import { formatAssetAmount, nativePaymentAsset, paymentAssetsForChain, type PaymentAsset } from "../tokens.ts";
import { useAccountSession } from "../account/useAccountSession.ts";
import AppShell from "../components/layout/AppShell.tsx";
import AgreementOverview from "../components/AgreementOverview.tsx";
import AgreementContextSections from "../components/AgreementContextSections.tsx";
import AgreementContactsPanel from "../components/AgreementContactsPanel.tsx";
import AgreementActivityFeed from "../components/AgreementActivityFeed.tsx";
import MilestoneList from "../components/MilestoneList.tsx";
import AdjustmentList from "../components/AdjustmentList.tsx";
import ActionPanel from "../components/ActionPanel.tsx";
import CreateAgreementForm from "../components/CreateAgreementForm.tsx";
import WalletPanel from "../components/WalletPanel.tsx";
import AgreementSidebar from "../components/dashboard/AgreementSidebar.tsx";
import WelcomeHero from "../components/dashboard/DashboardHeader.tsx";
import WorkspaceHeader from "../components/dashboard/WorkspaceHeader.tsx";

const STORAGE_KEY = "deallock_contract_address";

type Mode = "create" | "load";

function contractAddressFromUrl(): Address | null {
  const addr = new URLSearchParams(window.location.search).get("contractAddress");
  if (addr && /^0x[0-9a-fA-F]{40}$/.test(addr)) return addr as Address;
  return null;
}

function parseServiceTemplateId(raw: string): ServiceTemplateId {
  if ((SERVICE_TEMPLATE_IDS as readonly string[]).includes(raw)) return raw as ServiceTemplateId;
  return "custom";
}

function backendAgreementToRegistryEntry(a: BackendAgreement): AgreementRegistryEntry {
  return {
    contractAddress: a.contractAddress,
    projectTitle: a.projectTitle || null,
    serviceTemplate: parseServiceTemplateId(a.serviceTemplate),
    createdAt: a.createdAt,
    firstSeenAt: a.createdAt,
    lastAccessedAt: a.lastAccessedAt,
    clientAddress: a.clientAddress,
    providerAddress: a.providerAddress,
    agreementState: null,
  };
}

export default function DashboardPage() {
  const { address: account, isConnected } = useAccount();
  const chainId = useChainId();
  const { sessionStatus, wallets } = useAccountSession();

  const [contractAddress, setContractAddress] = useState<Address | null>(() => {
    const linked = contractAddressFromUrl();
    if (linked) return linked;
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (saved as Address) : null;
  });
  const [inputAddr, setInputAddr] = useState(() => contractAddressFromUrl() ?? localStorage.getItem(STORAGE_KEY) ?? "");
  const [mode, setMode] = useState<Mode>(() =>
    contractAddressFromUrl() || localStorage.getItem(STORAGE_KEY) ? "load" : "create",
  );
  const [agreementMetadata, setAgreementMetadata] = useState<AgreementMetadata | null>(null);
  const [switching, setSwitching] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState<AgreementSidebarFilter>(() => loadSidebarFilter());
  const [registryVersion, setRegistryVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [backendEntries, setBackendEntries] = useState<AgreementRegistryEntry[] | null>(null);
  const [backendAgreements, setBackendAgreements] = useState<BackendAgreement[] | null>(null);
  const [contractVersion, setContractVersion] = useState<ContractVersion>(1);
  const [deploymentReceipts, setDeploymentReceipts] = useState<
    Record<string, {
      deploymentTxHash: string;
      deploymentBlockNumber: string;
      creationSource?: "factory" | "direct";
      factoryVersion?: number;
      factoryAddress?: string;
      factoryTxHash?: string;
      factoryLogIndex?: number;
      metadataHash?: string;
      paymentAssetKind?: "native" | "erc20";
      paymentTokenAddress?: string | null;
      paymentSymbol?: string;
      paymentDecimals?: number;
    }>
  >({});
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [backendUnavailable, setBackendUnavailable] = useState(false);

  // Tracks which agreements have already been synced to the backend this session
  const syncedToBackendRef = useRef(new Set<string>());
  // Tracks whether the localStorage migration has run for this session
  const migratedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 960px)");
    const apply = () => setSidebarCollapsed(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (contractAddress) {
      localStorage.setItem(STORAGE_KEY, contractAddress);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [contractAddress]);

  useEffect(() => {
    if (!contractAddress) {
      setAgreementMetadata(null);
      return;
    }
    setAgreementMetadata(loadAgreementMetadata(contractAddress));
  }, [contractAddress]);

  useEffect(() => {
    saveSidebarFilter(sidebarFilter);
  }, [sidebarFilter]);

  // Fetch agreements from backend and merge with localStorage entries
  const fetchBackendAgreements = useCallback(async () => {
    if (sessionStatus !== "signed-in") return;
    try {
      const { agreements } = await getAgreements();
      setBackendUnavailable(false);
      setBackendAgreements(agreements);
      const backendRegistryEntries = agreements.map(backendAgreementToRegistryEntry);
      // Merge: backend entries are authoritative; keep localStorage-only entries too
      const localEntries = loadAgreementRegistry();
      const backendAddresses = new Set(backendRegistryEntries.map((e) => e.contractAddress));
      const localOnlyEntries = localEntries.filter((e) => !backendAddresses.has(e.contractAddress));
      setBackendEntries([...backendRegistryEntries, ...localOnlyEntries]);
    } catch {
      setBackendUnavailable(true);
      setBackendEntries(null);
      setBackendAgreements(null);
    }
  }, [sessionStatus]);

  // Fetch backend agreements on sign-in
  useEffect(() => {
    if (sessionStatus === "signed-in") {
      fetchBackendAgreements();
    } else {
      setBackendEntries(null);
      setBackendAgreements(null);
    }
  }, [sessionStatus, fetchBackendAgreements]);

  const fetchActivity = useCallback(async () => {
    if (sessionStatus !== "signed-in" || !contractAddress) {
      setActivityEvents([]);
      setActivityError(null);
      setActivityLoading(false);
      return;
    }
    setActivityLoading(true);
    setActivityError(null);
    try {
      const { events } = await getAgreementActivity(contractAddress, chainId);
      setActivityEvents(events);
    } catch (err) {
      setActivityEvents([]);
      setActivityError(err instanceof Error ? err.message : "Unable to load activity");
    } finally {
      setActivityLoading(false);
    }
  }, [chainId, contractAddress, sessionStatus]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Migrate existing localStorage agreements to backend on first sign-in
  useEffect(() => {
    if (sessionStatus !== "signed-in" || migratedRef.current || !wallets.length) return;
    migratedRef.current = true;

    const walletAddresses = wallets.map((w) => w.address.toLowerCase());
    const localEntries = loadAgreementRegistry();

    for (const entry of localEntries) {
      const involves =
        (entry.clientAddress && walletAddresses.includes(entry.clientAddress)) ||
        (entry.providerAddress && walletAddresses.includes(entry.providerAddress));

      if (involves && entry.clientAddress && entry.providerAddress) {
        const meta = loadAgreementMetadata(entry.contractAddress);
        saveAgreementToBackend({
          contractAddress: entry.contractAddress,
          chainId,
          clientAddress: entry.clientAddress,
          providerAddress: entry.providerAddress,
          projectTitle: entry.projectTitle ?? "",
          serviceTemplate: entry.serviceTemplate ?? "custom",
          metadataJson: meta ? (meta as unknown as Record<string, unknown>) : {},
          clientEmail: meta?.clientEmail ?? undefined,
          providerEmail: meta?.providerEmail ?? undefined,
          paymentAssetKind: meta?.paymentAssetKind ?? "native",
          paymentTokenAddress: meta?.paymentTokenAddress ?? null,
          paymentSymbol: meta?.paymentSymbol ?? "ETH",
          paymentDecimals: meta?.paymentDecimals ?? 18,
        }).catch(() => {});
      }
    }
  }, [sessionStatus, wallets, chainId]);

  const chainOk = isSupportedChain(chainId);
  const readsEnabled = !!contractAddress && isConnected && chainOk;

  // Detect V1 vs V2 whenever the active contract changes
  useEffect(() => {
    if (!contractAddress || !chainOk) return;
    detectContractVersion(contractAddress, chainId).then(setContractVersion);
  }, [contractAddress, chainId, chainOk]);

  const isV2 = contractVersion === 2;
  const isV3 = contractVersion === 3;
  const isV4 = contractVersion === 4;
  const isV5 = contractVersion === 5;
  const isV6 = contractVersion === 6;
  const isV4Like = isV4 || isV5 || isV6;
  const isV2orV3orV4 = isV2 || isV3 || isV4Like;
  const isV3orV4 = isV3 || isV4Like;
  const activeAbi = isV6 ? DEALLOCK_V6_ABI : isV4Like ? DEALLOCK_V4_ABI : isV3 ? DEALLOCK_V3_ABI : isV2 ? DEALLOCK_V2_ABI : DEALLOCK_ABI;

  const contractArgs = {
    address: contractAddress!,
    abi: activeAbi,
    chainId,
  } as const;

  const { data: clientAddr, refetch: rClient, error: readClientError, isPending: readPending } =
    useReadContract({
      ...contractArgs,
      functionName: "client",
      query: { enabled: readsEnabled },
    });
  const { data: providerAddr, refetch: rProvider } = useReadContract({
    ...contractArgs,
    functionName: "provider",
    query: { enabled: readsEnabled },
  });
  const { data: totalAmount, refetch: rTotal } = useReadContract({
    ...contractArgs,
    functionName: "totalAmount",
    query: { enabled: readsEnabled },
  });
  const { data: fundedAmount, refetch: rFunded } = useReadContract({
    ...contractArgs,
    functionName: "fundedAmount",
    query: { enabled: readsEnabled },
  });
  const { data: releasedAmount, refetch: rReleased } = useReadContract({
    ...contractArgs,
    functionName: "releasedAmount",
    query: { enabled: readsEnabled },
  });
  const { data: refundedAmount, refetch: rRefunded } = useReadContract({
    ...contractArgs,
    functionName: "refundedAmount",
    query: { enabled: readsEnabled },
  });
  const { data: agreementState, refetch: rState } = useReadContract({
    ...contractArgs,
    functionName: "agreementState",
    query: { enabled: readsEnabled },
  });
  const { data: balance, refetch: rBalance } = useReadContract({
    ...contractArgs,
    functionName: "getContractBalance",
    query: { enabled: readsEnabled },
  });
  const { data: milestoneCount, refetch: rCount } = useReadContract({
    ...contractArgs,
    functionName: "getMilestoneCount",
    query: { enabled: readsEnabled },
  });
  const { data: paymentTokenRaw, refetch: rPaymentToken } = useReadContract({
    address: contractAddress!,
    abi: [
      {
        type: "function",
        name: "paymentToken",
        stateMutability: "view",
        inputs: [],
        outputs: [{ type: "address" }],
      },
    ] as const,
    chainId,
    functionName: "paymentToken",
    query: { enabled: readsEnabled && (isV5 || isV6) },
  });

  const count = milestoneCount ? Number(milestoneCount) : 0;

  const milestoneContracts = Array.from({ length: count }, (_, i) => ({
    ...contractArgs,
    functionName: "getMilestone" as const,
    args: [BigInt(i)] as const,
  }));

  const { data: rawMilestones, refetch: rMilestones } = useReadContracts({
    contracts: milestoneContracts,
    query: { enabled: readsEnabled && count > 0 },
  });

  // ── V2+ adjustment reads ─────────────────────────────────────────────────

  // V2+ adjustment reads — pick ABI by version (same function shapes)
  const adjAbi = isV6 ? DEALLOCK_V6_ABI : isV4Like ? DEALLOCK_V4_ABI : isV3 ? DEALLOCK_V3_ABI : DEALLOCK_V2_ABI;
  const v2ContractArgs = {
    address: contractAddress!,
    abi: adjAbi,
    chainId,
  } as const;

  const { data: gracePeriodRaw, refetch: rGrace } = useReadContract({
    address: contractAddress!,
    abi: DEALLOCK_V3_ABI,
    chainId,
    functionName: "REFUND_GRACE_PERIOD",
    query: { enabled: readsEnabled && isV3orV4 },
  });
  const gracePeriodSeconds: bigint = isV3orV4 ? (gracePeriodRaw as bigint | undefined) ?? 24n : 0n;

  // V4/V5-compatible: review period
  const { data: reviewPeriodRaw, refetch: rReviewPeriod } = useReadContract({
    address: contractAddress!,
    abi: DEALLOCK_V4_ABI,
    chainId,
    functionName: "reviewPeriod",
    query: { enabled: readsEnabled && isV4Like },
  });
  const reviewPeriodSeconds: bigint = isV4Like ? (reviewPeriodRaw as bigint | undefined) ?? 0n : 0n;

  const { data: adjustmentFundedAmount, refetch: rAdjFunded } = useReadContract({
    ...v2ContractArgs,
    functionName: "adjustmentFundedAmount",
    query: { enabled: readsEnabled && isV2orV3orV4 },
  });
  const { data: adjustmentReleasedAmount, refetch: rAdjReleased } = useReadContract({
    ...v2ContractArgs,
    functionName: "adjustmentReleasedAmount",
    query: { enabled: readsEnabled && isV2orV3orV4 },
  });
  const { data: adjustmentRefundedAmount, refetch: rAdjRefunded } = useReadContract({
    ...v2ContractArgs,
    functionName: "adjustmentRefundedAmount",
    query: { enabled: readsEnabled && isV2orV3orV4 },
  });
  const { data: adjustmentCount, refetch: rAdjCount } = useReadContract({
    ...v2ContractArgs,
    functionName: "getAdjustmentCount",
    query: { enabled: readsEnabled && isV2orV3orV4 },
  });

  const adjCount = adjustmentCount ? Number(adjustmentCount) : 0;
  const adjustmentContracts = Array.from({ length: adjCount }, (_, i) => ({
    ...v2ContractArgs,
    functionName: "getAdjustment" as const,
    args: [BigInt(i)] as const,
  }));

  const { data: rawAdjustments, refetch: rAdjustments } = useReadContracts({
    contracts: adjustmentContracts,
    query: { enabled: readsEnabled && isV2orV3orV4 && adjCount > 0 },
  });

  // ── V4/V5-compatible reads: per-milestone review deadline, dispute, settlement ─────

  const milestoneReviewDeadlineContracts = Array.from({ length: count }, (_, i) => ({
    address: contractAddress!,
    abi: DEALLOCK_V4_ABI,
    chainId,
    functionName: "getMilestoneReviewDeadline" as const,
    args: [BigInt(i)] as const,
  }));
  const { data: rawMilestoneReviewDeadlines, refetch: rMilestoneReviewDeadlines } = useReadContracts({
    contracts: milestoneReviewDeadlineContracts,
    query: { enabled: readsEnabled && isV4Like && count > 0 },
  });

  const milestoneDisputeContracts = Array.from({ length: count }, (_, i) => ({
    address: contractAddress!,
    abi: DEALLOCK_V4_ABI,
    chainId,
    functionName: "getMilestoneDispute" as const,
    args: [BigInt(i)] as const,
  }));
  const { data: rawMilestoneDisputes, refetch: rMilestoneDisputes } = useReadContracts({
    contracts: milestoneDisputeContracts,
    query: { enabled: readsEnabled && isV4Like && count > 0 },
  });

  const milestoneSettlementContracts = Array.from({ length: count }, (_, i) => ({
    address: contractAddress!,
    abi: DEALLOCK_V4_ABI,
    chainId,
    functionName: "getMilestoneSettlementProposal" as const,
    args: [BigInt(i)] as const,
  }));
  const { data: rawMilestoneSettlements, refetch: rMilestoneSettlements } = useReadContracts({
    contracts: milestoneSettlementContracts,
    query: { enabled: readsEnabled && isV4Like && count > 0 },
  });

  const milestoneExtensionContracts = Array.from({ length: count }, (_, i) => ({
    address: contractAddress!,
    abi: DEALLOCK_V6_ABI,
    chainId,
    functionName: "getMilestoneDeadlineExtensionRequest" as const,
    args: [BigInt(i)] as const,
  }));
  const { data: rawMilestoneExtensions, refetch: rMilestoneExtensions } = useReadContracts({
    contracts: milestoneExtensionContracts,
    query: { enabled: readsEnabled && isV6 && count > 0 },
  });

  const milestoneRevisionContracts = Array.from({ length: count }, (_, i) => ({
    address: contractAddress!,
    abi: DEALLOCK_V6_ABI,
    chainId,
    functionName: "getMilestoneRevision" as const,
    args: [BigInt(i)] as const,
  }));
  const { data: rawMilestoneRevisions, refetch: rMilestoneRevisions } = useReadContracts({
    contracts: milestoneRevisionContracts,
    query: { enabled: readsEnabled && isV6 && count > 0 },
  });

  const milestoneRevisionResponseDeadlineContracts = Array.from({ length: count }, (_, i) => ({
    address: contractAddress!,
    abi: DEALLOCK_V6_ABI,
    chainId,
    functionName: "getMilestoneRevisionResponseDeadline" as const,
    args: [BigInt(i)] as const,
  }));
  const { data: rawMilestoneRevisionResponseDeadlines, refetch: rMilestoneRevisionResponseDeadlines } = useReadContracts({
    contracts: milestoneRevisionResponseDeadlineContracts,
    query: { enabled: readsEnabled && isV6 && count > 0 },
  });

  const adjReviewDeadlineContracts = Array.from({ length: adjCount }, (_, i) => ({
    address: contractAddress!,
    abi: DEALLOCK_V4_ABI,
    chainId,
    functionName: "getAdjustmentReviewDeadline" as const,
    args: [BigInt(i)] as const,
  }));
  const { data: rawAdjReviewDeadlines, refetch: rAdjReviewDeadlines } = useReadContracts({
    contracts: adjReviewDeadlineContracts,
    query: { enabled: readsEnabled && isV4Like && adjCount > 0 },
  });

  const adjDisputeContracts = Array.from({ length: adjCount }, (_, i) => ({
    address: contractAddress!,
    abi: DEALLOCK_V4_ABI,
    chainId,
    functionName: "getAdjustmentDispute" as const,
    args: [BigInt(i)] as const,
  }));
  const { data: rawAdjDisputes, refetch: rAdjDisputes } = useReadContracts({
    contracts: adjDisputeContracts,
    query: { enabled: readsEnabled && isV4Like && adjCount > 0 },
  });

  const adjSettlementContracts = Array.from({ length: adjCount }, (_, i) => ({
    address: contractAddress!,
    abi: DEALLOCK_V4_ABI,
    chainId,
    functionName: "getAdjustmentSettlementProposal" as const,
    args: [BigInt(i)] as const,
  }));
  const { data: rawAdjSettlements, refetch: rAdjSettlements } = useReadContracts({
    contracts: adjSettlementContracts,
    query: { enabled: readsEnabled && isV4Like && adjCount > 0 },
  });

  const adjExtensionContracts = Array.from({ length: adjCount }, (_, i) => ({
    address: contractAddress!,
    abi: DEALLOCK_V6_ABI,
    chainId,
    functionName: "getAdjustmentDeadlineExtensionRequest" as const,
    args: [BigInt(i)] as const,
  }));
  const { data: rawAdjExtensions, refetch: rAdjExtensions } = useReadContracts({
    contracts: adjExtensionContracts,
    query: { enabled: readsEnabled && isV6 && adjCount > 0 },
  });

  const adjustments: AdjustmentData[] = (rawAdjustments ?? [])
    .map((r, i) => {
      if (r.status !== "success") return null;
      const [targetMilestoneId, description, amount, deadline, proof, submittedAt, state] =
        r.result as [bigint, string, bigint, bigint, string, bigint, number];
      return { id: i, targetMilestoneId: Number(targetMilestoneId), description, amount, deadline, proof, submittedAt, state };
    })
    .filter((a): a is AdjustmentData => a !== null);

  const milestones: MilestoneData[] = (rawMilestones ?? [])
    .map((r, i) => {
      if (r.status !== "success") return null;
      const [description, amount, deadline, proof, submittedAt, state] =
        r.result as [string, bigint, bigint, string, bigint, number];
      return { id: i, description, amount, deadline, proof, submittedAt, state };
    })
    .filter((m): m is MilestoneData => m !== null);

  // V4: parsed per-milestone dispute / settlement / review deadline data
  const milestoneReviewDeadlines: bigint[] = (rawMilestoneReviewDeadlines ?? []).map((r) =>
    r.status === "success" ? (r.result as bigint) : 0n,
  );
  const milestoneDisputes: DisputeData[] = (rawMilestoneDisputes ?? []).map((r) => {
    if (r.status !== "success") return { exists: false, openedBy: "", reason: "", openedAt: 0n };
    const d = r.result as { exists: boolean; openedBy: string; reason: string; openedAt: bigint };
    return { exists: d.exists, openedBy: d.openedBy, reason: d.reason, openedAt: d.openedAt };
  });
  const milestoneSettlements: SettlementProposalData[] = (rawMilestoneSettlements ?? []).map((r) => {
    if (r.status !== "success") return { exists: false, proposer: "", providerAmount: 0n, note: "", proposedAt: 0n };
    const s = r.result as { exists: boolean; proposer: string; providerAmount: bigint; note: string; proposedAt: bigint };
    return { exists: s.exists, proposer: s.proposer, providerAmount: s.providerAmount, note: s.note, proposedAt: s.proposedAt };
  });
  const adjReviewDeadlines: bigint[] = (rawAdjReviewDeadlines ?? []).map((r) =>
    r.status === "success" ? (r.result as bigint) : 0n,
  );
  const adjDisputes: DisputeData[] = (rawAdjDisputes ?? []).map((r) => {
    if (r.status !== "success") return { exists: false, openedBy: "", reason: "", openedAt: 0n };
    const d = r.result as { exists: boolean; openedBy: string; reason: string; openedAt: bigint };
    return { exists: d.exists, openedBy: d.openedBy, reason: d.reason, openedAt: d.openedAt };
  });
  const adjSettlements: SettlementProposalData[] = (rawAdjSettlements ?? []).map((r) => {
    if (r.status !== "success") return { exists: false, proposer: "", providerAmount: 0n, note: "", proposedAt: 0n };
    const s = r.result as { exists: boolean; proposer: string; providerAmount: bigint; note: string; proposedAt: bigint };
    return { exists: s.exists, proposer: s.proposer, providerAmount: s.providerAmount, note: s.note, proposedAt: s.proposedAt };
  });
  const emptyExtension: DeadlineExtensionRequestData = {
    active: false,
    requester: "",
    requestedAt: 0n,
    proposedDeadline: 0n,
    reason: "",
  };
  const milestoneExtensions: DeadlineExtensionRequestData[] = (rawMilestoneExtensions ?? []).map((r) => {
    if (r.status !== "success") return emptyExtension;
    const e = r.result as { active: boolean; requester: string; requestedAt: bigint; proposedDeadline: bigint; reason: string };
    return {
      active: e.active,
      requester: e.requester,
      requestedAt: e.requestedAt,
      proposedDeadline: e.proposedDeadline,
      reason: e.reason,
    };
  });
  const adjExtensions: DeadlineExtensionRequestData[] = (rawAdjExtensions ?? []).map((r) => {
    if (r.status !== "success") return emptyExtension;
    const e = r.result as { active: boolean; requester: string; requestedAt: bigint; proposedDeadline: bigint; reason: string };
    return {
      active: e.active,
      requester: e.requester,
      requestedAt: e.requestedAt,
      proposedDeadline: e.proposedDeadline,
      reason: e.reason,
    };
  });

  const emptyRevision: RevisionInfo = {
    exists: false,
    requestedBy: "",
    reason: "",
    requestedAt: 0n,
    revisionDeadline: 0n,
    revisionRound: 0n,
    providerDeadlineRequestExists: false,
    providerRequestedDeadline: 0n,
    providerDeadlineReason: "",
    providerDeadlineRequestedAt: 0n,
  };
  const milestoneRevisions: RevisionInfo[] = (rawMilestoneRevisions ?? []).map((r) => {
    if (r.status !== "success") return emptyRevision;
    const v = r.result as {
      exists: boolean;
      requestedBy: string;
      reason: string;
      requestedAt: bigint;
      revisionDeadline: bigint;
      revisionRound: bigint;
      providerDeadlineRequestExists: boolean;
      providerRequestedDeadline: bigint;
      providerDeadlineReason: string;
      providerDeadlineRequestedAt: bigint;
    };
    return {
      exists: v.exists,
      requestedBy: v.requestedBy,
      reason: v.reason,
      requestedAt: v.requestedAt,
      revisionDeadline: v.revisionDeadline,
      revisionRound: v.revisionRound,
      providerDeadlineRequestExists: v.providerDeadlineRequestExists,
      providerRequestedDeadline: v.providerRequestedDeadline,
      providerDeadlineReason: v.providerDeadlineReason,
      providerDeadlineRequestedAt: v.providerDeadlineRequestedAt,
    };
  });
  const milestoneRevisionResponseDeadlines: bigint[] = (rawMilestoneRevisionResponseDeadlines ?? []).map((r) =>
    r.status === "success" ? (r.result as bigint) : 0n,
  );

  // Connected wallet role
  const role: Role = useMemo(
    () =>
      deriveRole(account, clientAddr as Address | undefined, providerAddr as Address | undefined),
    [account, clientAddr, providerAddr],
  );

  // Account-level role: checks all linked wallets, not just the connected one
  const accountRole: Role = useMemo(() => {
    if (role !== "other") return role;
    for (const wallet of wallets) {
      const r = deriveRole(wallet.address, clientAddr as Address | undefined, providerAddr as Address | undefined);
      if (r !== "other") return r;
    }
    return "other";
  }, [role, wallets, clientAddr, providerAddr]);

  // The specific linked wallet needed to take action when connected wallet is "other"
  const requiredWallet = useMemo(() => {
    if (role !== "other" || accountRole === "other") return null;
    return (
      wallets.find((w) => {
        const r = deriveRole(w.address, clientAddr as Address | undefined, providerAddr as Address | undefined);
        return r !== "other";
      }) ?? null
    );
  }, [role, accountRole, wallets, clientAddr, providerAddr]);

  const refetchAll = useCallback(async () => {
    const base = [
      rClient(), rProvider(), rTotal(), rFunded(), rReleased(),
      rRefunded(), rState(), rBalance(), rCount(), rMilestones(), rPaymentToken(),
    ];
    const v2v3v4Extra = isV2orV3orV4
      ? [rAdjFunded(), rAdjReleased(), rAdjRefunded(), rAdjCount(), rAdjustments(),
         ...(isV3orV4 ? [rGrace()] : []),
         ...(isV4Like ? [
           rReviewPeriod(), rMilestoneReviewDeadlines(), rMilestoneDisputes(),
           rMilestoneSettlements(), rAdjReviewDeadlines(), rAdjDisputes(), rAdjSettlements(),
           ...(isV6 ? [rMilestoneExtensions(), rAdjExtensions(), rMilestoneRevisions(), rMilestoneRevisionResponseDeadlines()] : []),
         ] : [])]
      : [];
    await Promise.all([...base, ...v2v3v4Extra]);
  }, [
    rClient, rProvider, rTotal, rFunded, rReleased, rRefunded, rState, rBalance, rCount, rMilestones,
    isV2orV3orV4, isV3orV4, isV4Like,
    rAdjFunded, rAdjReleased, rAdjRefunded, rAdjCount, rAdjustments,
    rGrace, rReviewPeriod, rPaymentToken,
    rMilestoneReviewDeadlines, rMilestoneDisputes, rMilestoneSettlements,
    rAdjReviewDeadlines, rAdjDisputes, rAdjSettlements, isV6, rMilestoneExtensions, rAdjExtensions, rMilestoneRevisions,
    rMilestoneRevisionResponseDeadlines,
  ]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchAll(), fetchBackendAgreements(), fetchActivity()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchAll, fetchBackendAgreements, fetchActivity]);

  const handleActionSuccess = useCallback(async () => {
    await Promise.all([refetchAll(), fetchActivity()]);
  }, [refetchAll, fetchActivity]);

  const activeBackendAgreement = useMemo(() => {
    if (!contractAddress || !backendAgreements) return null;
    const norm = normalizeContractAddress(contractAddress);
    return backendAgreements.find((a) => normalizeContractAddress(a.contractAddress) === norm) ?? null;
  }, [backendAgreements, contractAddress]);

  // Sync local registry + push to backend after chain reads succeed
  useEffect(() => {
    if (!contractAddress || !readsEnabled || readClientError || !clientAddr) return;

    syncRegistryFromChain({
      contractAddress,
      clientAddress: String(clientAddr).toLowerCase(),
      providerAddress: providerAddr ? String(providerAddr).toLowerCase() : null,
      agreementState: agreementState !== undefined ? Number(agreementState) : null,
      projectTitle: agreementMetadata?.projectTitle ?? null,
      serviceTemplate: agreementMetadata?.serviceTemplate ?? null,
      createdAt: agreementMetadata?.createdAt ?? null,
    });
    setRegistryVersion((v) => v + 1);

    // Best-effort sync to backend (once per agreement+version per session).
    // The key includes contractVersion so that when detectContractVersion resolves
    // (1→4), the effect re-fires and the backend gets the correct version.
    if (sessionStatus === "signed-in" && providerAddr) {
      const key = `${chainId}:${contractAddress.toLowerCase()}:v${contractVersion}`;
      if (!syncedToBackendRef.current.has(key)) {
        syncedToBackendRef.current.add(key);
        const meta = agreementMetadata;
        saveAgreementToBackend({
          contractAddress,
          chainId,
          clientAddress: String(clientAddr).toLowerCase(),
          providerAddress: String(providerAddr).toLowerCase(),
          projectTitle: meta?.projectTitle ?? "",
          serviceTemplate: meta?.serviceTemplate ?? "custom",
          metadataJson: meta ? (meta as unknown as Record<string, unknown>) : {},
          contractVersion,
          ...(deploymentReceipts[normalizeContractAddress(contractAddress)] ?? {}),
          clientEmail: meta?.clientEmail ?? undefined,
          providerEmail: meta?.providerEmail ?? undefined,
          paymentAssetKind: meta?.paymentAssetKind ?? activeBackendAgreement?.paymentAssetKind ?? "native",
          paymentTokenAddress: meta?.paymentTokenAddress ?? activeBackendAgreement?.paymentTokenAddress ?? null,
          paymentSymbol: meta?.paymentSymbol ?? activeBackendAgreement?.paymentSymbol ?? "ETH",
          paymentDecimals: meta?.paymentDecimals ?? activeBackendAgreement?.paymentDecimals ?? 18,
        })
          .then(() => fetchBackendAgreements())
          .catch(() => {});
      }
    }
  }, [
    contractAddress,
    readsEnabled,
    readClientError,
    clientAddr,
    providerAddr,
    agreementState,
    agreementMetadata,
    sessionStatus,
    chainId,
    contractVersion,
    activeBackendAgreement,
    deploymentReceipts,
    fetchBackendAgreements,
  ]);

  function handleSetAddress() {
    const trimmed = inputAddr.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return;
    const addr = trimmed as Address;
    setContractAddress(addr);
    upsertAgreementRegistry({
      contractAddress: addr,
      projectTitle: loadAgreementMetadata(addr)?.projectTitle ?? null,
      serviceTemplate: loadAgreementMetadata(addr)?.serviceTemplate ?? null,
      createdAt: loadAgreementMetadata(addr)?.createdAt ?? null,
      clientAddress: null,
      providerAddress: null,
      agreementState: null,
    });
    touchAgreementAccess(addr);
    setRegistryVersion((v) => v + 1);
    setMode("load");
  }

  function handleDeployed(
    addr: Address,
    draft: AgreementMetadataDraft,
    receipt: {
      deploymentTxHash: string;
      deploymentBlockNumber: string;
      creationSource: "factory" | "direct";
      factoryVersion?: number;
      factoryAddress?: string;
      factoryTxHash?: string;
      factoryLogIndex?: number;
      metadataHash?: string;
      paymentAssetKind?: "native" | "erc20";
      paymentTokenAddress?: string | null;
      paymentSymbol?: string;
      paymentDecimals?: number;
    },
  ) {
    const full: AgreementMetadata = {
      ...draft,
      contractAddress: addr,
      createdAt: new Date().toISOString(),
    };
    saveAgreementMetadata(full);
    setAgreementMetadata(full);
    setContractVersion(receipt.factoryVersion === 3 ? 6 : receipt.factoryVersion === 2 ? 5 : 4);
    setContractAddress(addr);
    setDeploymentReceipts((prev) => ({ ...prev, [normalizeContractAddress(addr)]: receipt }));
    setInputAddr(addr);
    setMode("load");
    upsertAgreementRegistry({
      contractAddress: addr,
      projectTitle: full.projectTitle,
      serviceTemplate: full.serviceTemplate,
      createdAt: full.createdAt,
      clientAddress: null,
      providerAddress: null,
      agreementState: 0,
    });
    touchAgreementAccess(addr);
    setRegistryVersion((v) => v + 1);
  }

  function handleContactEmailsSaved(clientEmail: string | null, providerEmail: string | null) {
    if (!contractAddress) return;
    const next: AgreementMetadata = {
      ...(agreementMetadata ?? {
        contractAddress,
        projectTitle: activeBackendAgreement?.projectTitle ?? "Loaded agreement",
        serviceTemplate: parseServiceTemplateId(activeBackendAgreement?.serviceTemplate ?? "custom"),
        serviceCategory: "custom",
        evidenceGuidance: "",
        acceptanceGuidance: "",
        disputeBoundaryNote: "",
        createdAt: activeBackendAgreement?.createdAt ?? new Date().toISOString(),
        milestoneNotes: [],
      }),
      contractAddress,
      clientEmail,
      providerEmail,
    };
    saveAgreementMetadata(next);
    setAgreementMetadata(next);
    setBackendAgreements((prev) =>
      prev?.map((a) =>
        normalizeContractAddress(a.contractAddress) === normalizeContractAddress(contractAddress)
          ? { ...a, clientEmail, providerEmail }
          : a,
      ) ?? null,
    );
    if (sessionStatus === "signed-in") fetchBackendAgreements();
  }

  async function handleSwitchSepolia() {
    setSwitching(true);
    await switchToSepolia();
    setSwitching(false);
  }

  const handleClearSavedContract = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setContractAddress(null);
    setInputAddr("");
    setMode("create");
  }, []);

  function handleSelectAgreement(addr: Address) {
    setContractAddress(addr);
    setInputAddr(addr);
    setMode("load");
    touchAgreementAccess(addr);
    setRegistryVersion((v) => v + 1);
  }

  function handleNewAgreement() {
    setMode("create");
    setContractAddress(null);
    setInputAddr("");
    localStorage.removeItem(STORAGE_KEY);
  }

  function handleLoadByAddress() {
    setMode("load");
    if (contractAddress) {
      setContractAddress(null);
      setInputAddr("");
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function handleRemovedFromRegistry(addr: string) {
    setRegistryVersion((v) => v + 1);
    const norm = normalizeContractAddress(addr);
    if (contractAddress && normalizeContractAddress(contractAddress) === norm) {
      handleClearSavedContract();
    }
    // Re-fetch so backend entries are refreshed
    fetchBackendAgreements();
  }

  const zeroDataContractRead =
    !!readClientError && /returned no data|\b0x\b/i.test(readClientError.message);

  const showWorkspace = !!contractAddress;

  // Sidebar entries: backend (merged) when signed in, otherwise localStorage (via sidebar default)
  const sidebarEntries = backendEntries ?? undefined;

  const clientContactEmail = agreementMetadata?.clientEmail ?? activeBackendAgreement?.clientEmail ?? null;
  const providerContactEmail = agreementMetadata?.providerEmail ?? activeBackendAgreement?.providerEmail ?? null;
  const canEditContacts = accountRole !== "other";
  const paymentAsset: PaymentAsset = useMemo(() => {
    const configured = paymentAssetsForChain(chainId);
    const native = nativePaymentAsset(chainId);
    const metaToken = agreementMetadata?.paymentTokenAddress ?? activeBackendAgreement?.paymentTokenAddress ?? null;
    const onchainToken = typeof paymentTokenRaw === "string" ? paymentTokenRaw.toLowerCase() : null;
    const token = metaToken ?? ((isV5 || isV6) && onchainToken && onchainToken !== zeroAddress ? onchainToken : null);
    if (!token) return native;
    const matched = token
      ? configured.find((asset) => asset.address?.toLowerCase() === token.toLowerCase())
      : undefined;
    if (matched) return matched;
    return {
      kind: "erc20",
      chainId,
      address: token as Address,
      symbol: agreementMetadata?.paymentSymbol ?? activeBackendAgreement?.paymentSymbol ?? "ERC-20",
      name: agreementMetadata?.paymentSymbol ?? activeBackendAgreement?.paymentSymbol ?? "ERC-20 token",
      decimals: agreementMetadata?.paymentDecimals ?? activeBackendAgreement?.paymentDecimals ?? 18,
    };
  }, [activeBackendAgreement, agreementMetadata, chainId, isV5, isV6, paymentTokenRaw]);

  return (
    <AppShell>
      <div className="dashboard-layout">
        <AgreementSidebar
          key={registryVersion}
          wallet={account}
          activeAddress={contractAddress}
          filter={sidebarFilter}
          onFilterChange={setSidebarFilter}
          onSelect={handleSelectAgreement}
          onNewAgreement={handleNewAgreement}
          onLoadByAddress={handleLoadByAddress}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          onRemovedFromRegistry={handleRemovedFromRegistry}
          entries={sidebarEntries}
          sessionStatus={sessionStatus}
        />

        <div className="dashboard-main">
          <div className="dashboard-body">
            {showWorkspace ? (
              <WorkspaceHeader
                contractAddress={contractAddress!}
                role={role}
                projectTitle={agreementMetadata?.projectTitle}
                serviceTemplate={agreementMetadata?.serviceTemplate as ServiceTemplateId | undefined}
                agreementState={agreementState as number | undefined}
                totalAmount={totalAmount as bigint | undefined}
                releasedAmount={releasedAmount as bigint | undefined}
                refundedAmount={refundedAmount as bigint | undefined}
                onRefresh={readsEnabled ? handleRefresh : undefined}
                refreshing={refreshing}
                paymentAsset={paymentAsset}
              />
            ) : (
              <WelcomeHero chainOk={chainOk} isConnected={isConnected} />
            )}
            {isConnected && !chainOk && (
              <div className="banner banner-warn">
                <div className="banner-content">
                  <strong>Wrong network.</strong> You are on {chainName(chainId)}. This demo targets{" "}
                  <strong>Sepolia</strong> (11155111).
                </div>
                <div className="banner-actions">
                  <button
                    type="button"
                    className="btn btn-warning btn-sm"
                    onClick={handleSwitchSepolia}
                    disabled={switching}
                  >
                    {switching ? "Switching…" : "Switch to Sepolia"}
                  </button>
                </div>
              </div>
            )}

            {contractAddress && isConnected && chainOk && readClientError && (
              <div className="banner banner-error">
                <strong>Cannot read this agreement.</strong>{" "}
                {zeroDataContractRead
                  ? "No DealLock contract data at this address on the current network."
                  : "An error occurred reading contract data."}
                <ul className="banner-list">
                  <li>
                    <strong>Wrong chain:</strong> MetaMask is on <strong>{chainName(chainId)}</strong>.
                    Use the same chain where the contract was deployed.
                  </li>
                  <li>
                    <strong>Wrong address:</strong> use the contract address from the deployment
                    transaction, not a wallet address.
                    {isSepoliaChain(chainId) && contractAddress && (
                      <>
                        {" "}
                        <a
                          href={explorerAddressUrl(chainId, contractAddress) ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Sepolia Etherscan
                        </a>
                      </>
                    )}
                  </li>
                  {chainId === HARDHAT_CHAIN_ID && (
                    <li>
                      <strong>Local Hardhat:</strong> run <code>npx hardhat node</code> in the
                      project root.
                    </li>
                  )}
                </ul>
                <div className="banner-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={handleClearSavedContract}
                  >
                    Clear saved contract
                  </button>
                </div>
                <details className="banner-details">
                  <summary>Technical detail</summary>
                  <pre className="banner-pre">{readClientError.message}</pre>
                </details>
              </div>
            )}

            {contractAddress && isConnected && chainOk && readPending && !readClientError && (
              <div className="banner banner-info">Loading agreement data…</div>
            )}

            {backendUnavailable && sessionStatus === "signed-in" && (
              <div className="banner banner-warn">
                <strong>Backend unavailable.</strong> Agreements are stored in this browser only.
                Sign-in syncing and indexed activity are temporarily unavailable. Contract
                interactions still work.
              </div>
            )}

            {!contractAddress && isConnected && chainOk && mode === "create" && !isFactoryV3Configured(chainId) && !isFactoryV2Configured(chainId) && (
              <div className="banner banner-info">
                {isFactoryConfigured(chainId) ? (
                  <>
                    <strong>Legacy factory mode.</strong> Factory V3/V2 is not configured for{" "}
                    <strong>{chainName(chainId)}</strong>. Native ETH agreements can use legacy
                    Factory V1, but ERC-20 agreements require <code>VITE_DEALLOCK_FACTORY_V3_*</code> or{" "}
                    <code>VITE_DEALLOCK_FACTORY_V2_*</code>.
                  </>
                ) : (
                  <>
                    <strong>Direct ETH deployment mode.</strong> Factory V3/V2 is not configured for{" "}
                    <strong>{chainName(chainId)}</strong>. Native ETH agreements can use the direct
                    V4 fallback; ERC-20 agreements require <code>VITE_DEALLOCK_FACTORY_V3_*</code> or{" "}
                    <code>VITE_DEALLOCK_FACTORY_V2_*</code>.
                  </>
                )}
              </div>
            )}

            {contractAddress && !isConnected && (
              <div className="banner banner-warn">
                <strong>Connect your wallet</strong> to interact with this agreement on Sepolia.
              </div>
            )}

            {!isConnected && <WalletPanel />}

            {!contractAddress && isConnected && (
              <>
                <div className="welcome-tiles">
                  <button
                    type="button"
                    className={`welcome-tile ${mode === "create" ? "welcome-tile--active" : ""}`}
                    onClick={() => setMode("create")}
                  >
                    <span className="welcome-tile-icon" aria-hidden>◈</span>
                    <h3>Create agreement</h3>
                    <p>Deploy a new milestone escrow; your wallet becomes the client.</p>
                  </button>
                  <button
                    type="button"
                    className={`welcome-tile ${mode === "load" ? "welcome-tile--active" : ""}`}
                    onClick={() => setMode("load")}
                  >
                    <span className="welcome-tile-icon" aria-hidden>↗</span>
                    <h3>Load by address</h3>
                    <p>Paste any DealLock contract — it will be saved to this browser.</p>
                  </button>
                </div>

                {mode === "create" && <CreateAgreementForm onDeployed={handleDeployed} />}

                {mode === "load" && (
                  <section className="surface-card surface-card--pad anim-fade-rise">
                    <div className="surface-card-head">
                      <h2 className="surface-card-title">Load agreement</h2>
                      <p className="surface-card-desc">
                        Paste a DealLock contract address. It will appear under{" "}
                        <strong>My agreements</strong> in the sidebar.
                      </p>
                    </div>
                    <div className="load-contract-row">
                      <input
                        type="text"
                        className="input input-mono"
                        placeholder="0x…"
                        value={inputAddr}
                        onChange={(e) => setInputAddr(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSetAddress()}
                      />
                      <button type="button" className="btn btn-primary" onClick={handleSetAddress}>
                        Load
                      </button>
                    </div>
                  </section>
                )}
              </>
            )}

            {contractAddress && isConnected && (
              <>
                {activeBackendAgreement && (
                  <p className="hint" style={{ paddingLeft: "0.25rem", marginBottom: 0 }}>
                    {activeBackendAgreement.creationSource === "factory"
                      ? "Created via DealLock Factory"
                      : "Direct legacy deployment"}
                  </p>
                )}

                <AgreementOverview
                  viewerRole={role}
                  clientAddr={clientAddr as Address | undefined}
                  providerAddr={providerAddr as Address | undefined}
                  totalAmount={totalAmount as bigint | undefined}
                  fundedAmount={fundedAmount as bigint | undefined}
                  releasedAmount={releasedAmount as bigint | undefined}
                  refundedAmount={refundedAmount as bigint | undefined}
                  balance={balance as bigint | undefined}
                  paymentAsset={paymentAsset}
                />

                <ActionPanel
                  contractAddress={contractAddress}
                  role={role}
                  agreementState={agreementState as number | undefined}
                  totalAmount={totalAmount as bigint | undefined}
                  milestones={milestones}
                  onSuccess={handleActionSuccess}
                  requiredWallet={requiredWallet}
                  accountRole={accountRole}
                  contractVersion={contractVersion}
                  adjustments={adjustments}
                  gracePeriodSeconds={gracePeriodSeconds}
                  reviewPeriodSeconds={reviewPeriodSeconds}
                  milestoneReviewDeadlines={milestoneReviewDeadlines}
                  milestoneDisputes={milestoneDisputes}
                  milestoneSettlements={milestoneSettlements}
                  milestoneExtensions={milestoneExtensions}
                  milestoneRevisions={milestoneRevisions}
                  milestoneRevisionResponseDeadlines={milestoneRevisionResponseDeadlines}
                  adjReviewDeadlines={adjReviewDeadlines}
                  adjDisputes={adjDisputes}
                  adjSettlements={adjSettlements}
                  adjExtensions={adjExtensions}
                  clientAddr={clientAddr as Address | undefined}
                  actorAddress={sessionStatus === "signed-in" ? account : undefined}
                  paymentAsset={paymentAsset}
                />

                <MilestoneList
                  milestones={milestones}
                  milestoneNotes={agreementMetadata?.milestoneNotes}
                  agreementState={agreementState as number | undefined}
                  gracePeriodSeconds={gracePeriodSeconds}
                  reviewPeriodSeconds={reviewPeriodSeconds}
                  milestoneReviewDeadlines={milestoneReviewDeadlines}
                  milestoneDisputes={milestoneDisputes}
                  milestoneSettlements={milestoneSettlements}
                  milestoneExtensions={milestoneExtensions}
                  paymentAsset={paymentAsset}
                />

                {isV2orV3orV4 && adjustments.length > 0 && (
                  <section className="surface-card surface-card--pad anim-fade-rise">
                    <div className="section-header">
                      <h2 className="section-header-title">Paid Adjustments</h2>
                      <span className="section-header-desc">
                        Change orders — extra paid work attached to milestones
                      </span>
                    </div>
                    <div className="adjustment-accounting">
                      {adjustmentFundedAmount !== undefined && (
                        <span>Funded: {formatAssetAmount(adjustmentFundedAmount as bigint, paymentAsset)}</span>
                      )}
                      {adjustmentReleasedAmount !== undefined && (
                        <span>Released: {formatAssetAmount(adjustmentReleasedAmount as bigint, paymentAsset)}</span>
                      )}
                      {adjustmentRefundedAmount !== undefined && (
                        <span>Refunded: {formatAssetAmount(adjustmentRefundedAmount as bigint, paymentAsset)}</span>
                      )}
                    </div>
                    <AdjustmentList
                      adjustments={adjustments}
                      gracePeriodSeconds={gracePeriodSeconds}
                      reviewPeriodSeconds={reviewPeriodSeconds}
                      adjReviewDeadlines={adjReviewDeadlines}
                      adjDisputes={adjDisputes}
                      adjSettlements={adjSettlements}
                      adjExtensions={adjExtensions}
                      paymentAsset={paymentAsset}
                    />
                  </section>
                )}

                <AgreementContactsPanel
                  contractAddress={contractAddress}
                  chainId={chainId}
                  clientEmail={clientContactEmail}
                  providerEmail={providerContactEmail}
                  canEdit={canEditContacts}
                  onSaved={handleContactEmailsSaved}
                />

                <AgreementActivityFeed
                  events={activityEvents}
                  loading={activityLoading}
                  error={activityError}
                  chainId={chainId}
                  signedIn={sessionStatus === "signed-in"}
                  paymentAsset={paymentAsset}
                />

                <AgreementContextSections metadata={agreementMetadata} />
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { type Address } from "viem";
import { DEALLOCK_ABI } from "../contract.ts";
import { DEALLOCK_V2_ABI } from "../contractV2.ts";
import { DEALLOCK_V3_ABI } from "../contractV3.ts";
import { DEALLOCK_V4_ABI } from "../contractV4.ts";
import { DEALLOCK_V6_ABI } from "../contractV6.ts";
import {
  type MilestoneData,
  type AdjustmentData,
  type DisputeData,
  type SettlementProposalData,
  type DeadlineExtensionRequestData,
  type RevisionInfo,
  type Role,
  shortAddress,
  adjustmentLabel,
  formatTimestamp,
} from "../types.ts";
import { formatAssetAmount, nativePaymentAsset, parseAssetAmount, type PaymentAsset } from "../tokens.ts";
import { explorerTxUrl, humanizeContractError, isSupportedChain } from "../network.ts";
import {
  notifyContractAction,
  type ContractActionType,
} from "../api/notifications.ts";

interface Props {
  contractAddress: Address;
  role: Role;
  agreementState?: number;
  totalAmount?: bigint;
  milestones: MilestoneData[];
  onSuccess: () => Promise<void>;
  /** Set when role=other but a linked wallet has the required role. */
  requiredWallet?: { address: string; label: string } | null;
  /** Role of the linked wallet (used in switch-wallet message). */
  accountRole?: Role;
  /** 1 = V1, 2 = V2, 3 = V3, 4 = V4, 5 = MultiAsset, 6 = MultiAssetV2. Default 1. */
  contractVersion?: 1 | 2 | 3 | 4 | 5 | 6;
  paymentAsset?: PaymentAsset;
  /** V2+: all adjustments read from chain. */
  adjustments?: AdjustmentData[];
  /** V3+ only: grace period in seconds (24n). 0n or undefined for V1/V2. */
  gracePeriodSeconds?: bigint;
  /** V4/V5-compatible: review period in seconds. 0n or undefined for V1/V2/V3. */
  reviewPeriodSeconds?: bigint;
  /** V4/V5-compatible: per-milestone review deadline (submittedAt + reviewPeriod). 0n if not submitted. */
  milestoneReviewDeadlines?: bigint[];
  /** V4/V5-compatible: per-milestone dispute info. */
  milestoneDisputes?: DisputeData[];
  /** V4/V5-compatible: per-milestone settlement proposals. */
  milestoneSettlements?: SettlementProposalData[];
  /** V6: per-milestone deadline extension requests. */
  milestoneExtensions?: DeadlineExtensionRequestData[];
  /** V4/V5-compatible: per-adjustment review deadline. */
  adjReviewDeadlines?: bigint[];
  /** V4/V5-compatible: per-adjustment dispute info. */
  adjDisputes?: DisputeData[];
  /** V4/V5-compatible: per-adjustment settlement proposals. */
  adjSettlements?: SettlementProposalData[];
  /** V6: per-adjustment deadline extension requests. */
  adjExtensions?: DeadlineExtensionRequestData[];
  /** V6: per-milestone revision request data. */
  milestoneRevisions?: RevisionInfo[];
  /** V6: per-milestone revision provider response deadline. */
  milestoneRevisionResponseDeadlines?: bigint[];
  /** Client address on-chain (for settlement proposal display). */
  clientAddr?: Address;
  /** Connected wallet address used as the actor for app-triggered notifications. */
  actorAddress?: Address;
}

const ERC20_ABI = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "account", type: "address" },
    ],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

type TxState =
  | { status: "idle" }
  | { status: "pending"; label: string }
  | { status: "confirming"; hash: `0x${string}`; label: string }
  | { status: "success"; hash: `0x${string}` }
  | { status: "error"; message: string };

type NotificationRequest = {
  actionType: ContractActionType;
  itemType?: "milestone" | "adjustment";
  itemId?: number;
};

type NotificationState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "attempted" }
  | { status: "failed" };

function TxLink({ hash, chainId }: { hash: string; chainId: number }) {
  const url = explorerTxUrl(chainId, hash);
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="tx-link">
        View on Etherscan ↗
      </a>
    );
  }
  return <code className="mono-sm">{hash}</code>;
}

function sameAddress(a?: string, b?: string): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

function parseSettlementAmount(raw: string, maxAmount: bigint, asset: PaymentAsset): { amount?: bigint; error?: string } {
  if (!raw.trim()) return { error: "Provider share is required." };

  try {
    const amount = parseAssetAmount(raw.trim(), asset);
    if (amount < 0n) return { error: "Provider share cannot be negative." };
    if (amount > maxAmount) return { error: "Provider share cannot exceed the locked item amount." };
    return { amount };
  } catch {
    return { error: `Provider share must be a valid ${asset.symbol} amount.` };
  }
}

function formatDuration(seconds: bigint): string {
  if (seconds % 86400n === 0n) return `${seconds / 86400n} day${seconds === 86400n ? "" : "s"}`;
  if (seconds % 3600n === 0n) return `${seconds / 3600n} hour${seconds === 3600n ? "" : "s"}`;
  return `${seconds} seconds`;
}

function inputMax(rawAmount: bigint, asset: PaymentAsset): number {
  return Number(rawAmount) / 10 ** asset.decimals;
}

function inputStep(asset: PaymentAsset): string {
  return asset.decimals <= 6 ? "0.01" : "0.000001";
}

const PUBLIC_ONCHAIN_WARNING =
  "This text is stored on-chain and will be public. Do not include private credentials, confidential files, personal data, or private client information.";
const REVISION_RESPONSE_PERIOD_SECONDS = 3n * 24n * 60n * 60n;

export default function ActionPanel({
  contractAddress,
  role,
  agreementState,
  totalAmount,
  milestones,
  onSuccess,
  requiredWallet,
  accountRole,
  contractVersion = 1,
  paymentAsset,
  adjustments = [],
  gracePeriodSeconds,
  reviewPeriodSeconds,
  milestoneReviewDeadlines = [],
  milestoneDisputes = [],
  milestoneSettlements = [],
  milestoneExtensions = [],
  adjReviewDeadlines = [],
  adjDisputes = [],
  adjSettlements = [],
  adjExtensions = [],
  milestoneRevisions = [],
  milestoneRevisionResponseDeadlines = [],
  clientAddr,
  actorAddress,
}: Props) {
  const { address: connectedAddress } = useAccount();
  const chainId = useChainId();
  const grace = gracePeriodSeconds ?? 0n;
  const asset = paymentAsset ?? nativePaymentAsset(chainId);
  const isErc20Payment = asset.kind === "erc20" && !!asset.address;
  const formatAmount = (amount: bigint) => formatAssetAmount(amount, asset);
  const reviewPeriod = reviewPeriodSeconds ?? 0n;
  const reviewPeriodLabel = reviewPeriod > 0n ? formatDuration(reviewPeriod) : "configured";
  const [txState, setTxState] = useState<TxState>({ status: "idle" });
  const [notificationState, setNotificationState] = useState<NotificationState>({ status: "idle" });
  const [proofInput, setProofInput] = useState("");
  const [milestoneIdInput, setMilestoneIdInput] = useState("0");

  // V2 request-adjustment form state
  const [showAdjForm, setShowAdjForm] = useState(false);
  const [adjMilestoneId, setAdjMilestoneId] = useState("0");
  const [adjDescription, setAdjDescription] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjDeadline, setAdjDeadline] = useState("");
  const [adjFormErrors, setAdjFormErrors] = useState<string[]>([]);

  // V2 adjustment submit form state
  const [adjProofInput, setAdjProofInput] = useState("");
  const [adjSubmitIdInput, setAdjSubmitIdInput] = useState("0");

  // V4 dispute form state
  const [disputeMilestoneId, setDisputeMilestoneId] = useState(0);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeAdjId, setDisputeAdjId] = useState(0);
  const [disputeAdjReason, setDisputeAdjReason] = useState("");
  const [showAdjDisputeForm, setShowAdjDisputeForm] = useState(false);

  // V4 settlement proposal form state (milestones)
  const [settleMilestoneId, setSettleMilestoneId] = useState(0);
  const [settleProviderAmount, setSettleProviderAmount] = useState("");
  const [settleNote, setSettleNote] = useState("");
  const [showSettleForm, setShowSettleForm] = useState(false);

  // V4 settlement proposal form state (adjustments)
  const [settleAdjId, setSettleAdjId] = useState(0);
  const [settleAdjProviderAmount, setSettleAdjProviderAmount] = useState("");
  const [settleAdjNote, setSettleAdjNote] = useState("");
  const [showAdjSettleForm, setShowAdjSettleForm] = useState(false);

  // V6 deadline extension form state
  const [showMilestoneExtensionForm, setShowMilestoneExtensionForm] = useState(false);
  const [extensionMilestoneId, setExtensionMilestoneId] = useState("0");
  const [extensionMilestoneDeadline, setExtensionMilestoneDeadline] = useState("");
  const [extensionMilestoneReason, setExtensionMilestoneReason] = useState("");
  const [showAdjExtensionForm, setShowAdjExtensionForm] = useState(false);
  const [extensionAdjId, setExtensionAdjId] = useState("0");
  const [extensionAdjDeadline, setExtensionAdjDeadline] = useState("");
  const [extensionAdjReason, setExtensionAdjReason] = useState("");

  // V6 revision request form state (client)
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionMilestoneId, setRevisionMilestoneId] = useState("0");
  const [revisionReason, setRevisionReason] = useState("");
  const [revisionDeadlineInput, setRevisionDeadlineInput] = useState("");

  // V6 provider deadline request form state
  const [showProviderRevDeadlineForm, setShowProviderRevDeadlineForm] = useState<number | null>(null);
  const [providerRevDeadlineInput, setProviderRevDeadlineInput] = useState("");
  const [providerRevDeadlineReason, setProviderRevDeadlineReason] = useState("");

  // V6 reject revision form state
  const [showRejectRevisionForm, setShowRejectRevisionForm] = useState<number | null>(null);
  const [rejectRevisionReason, setRejectRevisionReason] = useState("");

  // V6 client revision timeout escalation form state
  const [showEscalateRevisionForm, setShowEscalateRevisionForm] = useState<number | null>(null);
  const [escalateRevisionReason, setEscalateRevisionReason] = useState("");

  // V6 client set revision deadline form state
  const [showClientRevDeadlineForm, setShowClientRevDeadlineForm] = useState<number | null>(null);
  const [clientRevDeadlineInput, setClientRevDeadlineInput] = useState("");

  const { writeContractAsync } = useWriteContract();
  const { data: tokenAllowance, refetch: refetchAllowance } = useReadContract({
    address: asset.address ?? undefined,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: connectedAddress && asset.address ? [connectedAddress, contractAddress] : undefined,
    query: { enabled: isErc20Payment && !!connectedAddress },
  });
  const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({
    address: asset.address ?? undefined,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: connectedAddress && asset.address ? [connectedAddress] : undefined,
    query: { enabled: isErc20Payment && !!connectedAddress },
  });

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txState.status === "confirming" ? txState.hash : undefined,
    query: { enabled: txState.status === "confirming" },
  });

  const chainOk = isSupportedChain(chainId);
  const isClient = role === "client";
  const isProvider = role === "provider";
  const disabled = isConfirming || !chainOk;
  const isV2 = contractVersion === 2;
  const isV3 = contractVersion === 3;
  const isV6 = contractVersion === 6;
  const isV4 = contractVersion === 4 || contractVersion === 5 || isV6;
  const abi = isV6 ? DEALLOCK_V6_ABI : isV4 ? DEALLOCK_V4_ABI : isV3 ? DEALLOCK_V3_ABI : isV2 ? DEALLOCK_V2_ABI : DEALLOCK_ABI;
  const adjAbi = isV6 ? DEALLOCK_V6_ABI : isV4 ? DEALLOCK_V4_ABI : isV3 ? DEALLOCK_V3_ABI : DEALLOCK_V2_ABI;

  const nextPendingIdx = useMemo(
    () => milestones.findIndex((m) => m.state === 0),
    [milestones],
  );
  useEffect(() => {
    if (nextPendingIdx >= 0) setMilestoneIdInput(String(nextPendingIdx));
  }, [nextPendingIdx]);

  const firstFundedAdjIdx = useMemo(
    () => adjustments.findIndex((a) => a.state === 2),
    [adjustments],
  );
  useEffect(() => {
    if (firstFundedAdjIdx >= 0) setAdjSubmitIdInput(String(firstFundedAdjIdx));
  }, [firstFundedAdjIdx]);

  async function sendActionNotification(
    hash: `0x${string}`,
    notification: NotificationRequest,
  ): Promise<void> {
    if (!actorAddress) return;
    setNotificationState({ status: "pending" });
    try {
      const result = await notifyContractAction({
        contractAddress,
        chainId,
        txHash: hash,
        actorAddress,
        contractVersion,
        ...notification,
      });
      setNotificationState(result.status === "failed" ? { status: "failed" } : { status: "attempted" });
    } catch {
      setNotificationState({ status: "failed" });
    }
  }

  async function exec(
    label: string,
    fn: () => Promise<`0x${string}`>,
    notification?: NotificationRequest,
  ): Promise<boolean> {
    setTxState({ status: "pending", label });
    setNotificationState({ status: "idle" });
    try {
      const hash = await fn();
      setTxState({ status: "confirming", hash, label });
      await waitForHash(hash);
      setTxState({ status: "success", hash });
      await onSuccess();
      if (notification) void sendActionNotification(hash, notification);
      return true;
    } catch (err: unknown) {
      setTxState({ status: "error", message: humanizeContractError(err) });
      return false;
    }
  }

  async function waitForHash(hash: `0x${string}`) {
    const { getPublicClient } = await import("wagmi/actions");
    const { config } = await import("../wagmi.ts");
    const client = getPublicClient(config);
    if (!client) return;
    await client.waitForTransactionReceipt({ hash, timeout: 120_000 });
  }

  async function approveToken(amount: bigint): Promise<boolean> {
    if (!asset.address) return false;
    return exec(`Approve ${asset.symbol}`, async () => {
      const hash = await writeContractAsync({
        address: asset.address!,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [contractAddress, amount],
      });
      await refetchAllowance();
      await refetchTokenBalance();
      return hash;
    }).then((ok) => {
      if (ok) void Promise.all([refetchAllowance(), refetchTokenBalance()]);
      return ok;
    });
  }

  const allowance = isErc20Payment ? (tokenAllowance as bigint | undefined) ?? 0n : 0n;
  const balance = isErc20Payment ? (tokenBalance as bigint | undefined) ?? 0n : 0n;

  // ── V1 action groups ─────────────────────────────────────────────────────

  const mid = Number(milestoneIdInput) || 0;
  const now = BigInt(Math.floor(Date.now() / 1000));

  const submittedToApprove = milestones.filter((m) => m.state === 1);

  // Milestones past deadline but inside grace window (V3+)
  const inGracePeriodMilestones = (isV3 || isV4)
    ? milestones.filter((m) => m.state === 0 && now >= m.deadline && now < m.deadline + grace)
    : [];

  // Milestones whose refund window has opened
  const expiredToRefund = milestones.filter(
    (m) => m.state === 0 && now >= m.deadline + grace,
  );
  const milestoneExtensionEligible = isV6
    ? milestones.filter((m) => m.state === 0 && now <= m.deadline + grace)
    : [];
  const activeMilestoneExtensions = isV6
    ? milestones.filter((m) => milestoneExtensions[m.id]?.active && m.state === 0)
    : [];

  const showProviderAccept = isProvider && agreementState === 0;
  const showClientFund = isClient && agreementState === 1 && totalAmount !== undefined;
  const showProviderSubmit = isProvider && agreementState === 2;
  const showClientApprove = isClient && agreementState === 2 && submittedToApprove.length > 0;
  const showClientRefund = isClient && agreementState === 2 &&
    (expiredToRefund.length > 0 || inGracePeriodMilestones.length > 0);
  const showProviderMilestoneExtension = isProvider && agreementState === 2 &&
    (milestoneExtensionEligible.length > 0 || activeMilestoneExtensions.length > 0);
  const showClientMilestoneExtension = isClient && agreementState === 2 && activeMilestoneExtensions.length > 0;

  // ── V2+ adjustment groups ─────────────────────────────────────────────────

  const proposedAdjs = adjustments.filter((a) => a.state === 0);
  const acceptedAdjs = adjustments.filter((a) => a.state === 1);
  const fundedAdjs = adjustments.filter((a) => a.state === 2);
  const submittedAdjs = adjustments.filter((a) => a.state === 3);
  const disputedAdjs = adjustments.filter((a) => a.state === 7); // V4

  // Adjustments past deadline but inside grace window (V3+)
  const inGracePeriodAdjs = (isV3 || isV4)
    ? adjustments.filter((a) => a.state === 2 && now >= a.deadline && now < a.deadline + grace)
    : [];

  // Adjustments whose refund window has opened
  const expiredFundedAdjs = adjustments.filter(
    (a) => a.state === 2 && now >= a.deadline + grace,
  );
  const adjExtensionEligible = isV6
    ? adjustments.filter((a) => a.state === 2 && now <= a.deadline + grace)
    : [];
  const activeAdjExtensions = isV6
    ? adjustments.filter((a) => adjExtensions[a.id]?.active && a.state === 2)
    : [];
  const cancellableAdjs = adjustments.filter((a) => a.state === 0 || a.state === 1);

  const showRequestAdj = isClient && (isV2 || isV3 || isV4) && agreementState === 2;
  const showClientFundAdj = isClient && (isV2 || isV3 || isV4) && agreementState === 2 && acceptedAdjs.length > 0;
  const showClientApproveAdj = isClient && (isV2 || isV3 || isV4) && agreementState === 2 && submittedAdjs.length > 0;
  const showClientRefundAdj = isClient && (isV2 || isV3 || isV4) && agreementState === 2 &&
    (expiredFundedAdjs.length > 0 || inGracePeriodAdjs.length > 0);
  const showClientCancelAdj = isClient && (isV2 || isV3 || isV4) && agreementState === 2 && cancellableAdjs.length > 0;
  const showProviderAcceptAdj = isProvider && (isV2 || isV3 || isV4) && agreementState === 2 && proposedAdjs.length > 0;
  const showProviderSubmitAdj = isProvider && (isV2 || isV3 || isV4) && agreementState === 2 && fundedAdjs.length > 0;
  const showProviderCancelAdj = isProvider && (isV2 || isV3 || isV4) && agreementState === 2 && cancellableAdjs.length > 0;
  const showProviderAdjExtension = isProvider && agreementState === 2 &&
    (adjExtensionEligible.length > 0 || activeAdjExtensions.length > 0);
  const showClientAdjExtension = isClient && agreementState === 2 && activeAdjExtensions.length > 0;

  // V4 milestone dispute/review/settlement groups
  const submittedMilestonesInReview = isV4
    ? milestones.filter((m) => {
        if (m.state !== 1) return false; // not Submitted
        const rd = milestoneReviewDeadlines[m.id] ?? 0n;
        return rd > 0n && now <= rd;
      })
    : [];
  const submittedMilestonesReviewExpired = isV4
    ? milestones.filter((m) => {
        if (m.state !== 1) return false;
        const rd = milestoneReviewDeadlines[m.id] ?? 0n;
        return rd > 0n && now > rd;
      })
    : [];
  const disputedMilestones = isV4 ? milestones.filter((m) => m.state === 4) : [];
  const revisionRequestedMilestones = isV6 ? milestones.filter((m) => m.state === 6) : [];
  const revisionResponseDeadline = (milestoneId: number, revision?: RevisionInfo) => {
    const fromChain = milestoneRevisionResponseDeadlines[milestoneId] ?? 0n;
    if (fromChain > 0n) return fromChain;
    return revision?.exists ? revision.requestedAt + REVISION_RESPONSE_PERIOD_SECONDS : 0n;
  };

  // V6 revision-eligible: submitted milestones still within review window
  const revisionEligibleMilestones = isV6
    ? milestones.filter((m) => {
        if (m.state !== 1) return false;
        const rd = milestoneReviewDeadlines[m.id] ?? 0n;
        return rd > 0n && now <= rd;
      })
    : [];

  // V4 adjustment dispute/review/settlement groups
  const submittedAdjsInReview = isV4
    ? adjustments.filter((a) => {
        if (a.state !== 3) return false;
        const rd = adjReviewDeadlines[a.id] ?? 0n;
        return rd > 0n && now <= rd;
      })
    : [];
  const submittedAdjsReviewExpired = isV4
    ? adjustments.filter((a) => {
        if (a.state !== 3) return false;
        const rd = adjReviewDeadlines[a.id] ?? 0n;
        return rd > 0n && now > rd;
      })
    : [];

  const showV4ClientDisputeMilestone = isClient && isV4 && agreementState === 2 && submittedMilestonesInReview.length > 0;
  const showV6ClientRequestRevision = isClient && isV6 && agreementState === 2 && revisionEligibleMilestones.length > 0;
  const showV6ProviderRevisionActions = isProvider && isV6 && agreementState === 2 && revisionRequestedMilestones.length > 0;
  const showV6ClientRevisionActions = isClient && isV6 && agreementState === 2 && revisionRequestedMilestones.length > 0;
  const showV4ProviderClaimMilestone = isProvider && isV4 && agreementState === 2 && submittedMilestonesReviewExpired.length > 0;
  const showV4DisputedMilestonesActions = (isClient || isProvider) && isV4 && agreementState === 2 && disputedMilestones.length > 0;
  const showV4ClientDisputeAdj = isClient && isV4 && agreementState === 2 && submittedAdjsInReview.length > 0;
  const showV4ProviderClaimAdj = isProvider && isV4 && agreementState === 2 && submittedAdjsReviewExpired.length > 0;
  const showV4DisputedAdjsActions = (isClient || isProvider) && isV4 && agreementState === 2 && disputedAdjs.length > 0;

  const selectedDisputeMilestone =
    submittedMilestonesInReview.find((m) => m.id === disputeMilestoneId) ?? submittedMilestonesInReview[0];
  const selectedDisputeAdj =
    submittedAdjsInReview.find((a) => a.id === disputeAdjId) ?? submittedAdjsInReview[0];
  const selectedSettleMilestone =
    disputedMilestones.find((m) => m.id === settleMilestoneId) ?? disputedMilestones[0];
  const selectedSettleAdj =
    disputedAdjs.find((a) => a.id === settleAdjId) ?? disputedAdjs[0];

  const milestoneProviderSharePreview = selectedSettleMilestone
    ? parseSettlementAmount(settleProviderAmount || "0", selectedSettleMilestone.amount, asset).amount ?? 0n
    : 0n;
  const milestoneClientSharePreview = selectedSettleMilestone
    ? selectedSettleMilestone.amount - milestoneProviderSharePreview
    : 0n;
  const adjProviderSharePreview = selectedSettleAdj
    ? parseSettlementAmount(settleAdjProviderAmount || "0", selectedSettleAdj.amount, asset).amount ?? 0n
    : 0n;
  const adjClientSharePreview = selectedSettleAdj
    ? selectedSettleAdj.amount - adjProviderSharePreview
    : 0n;

  function proposalByCurrentRole(proposal?: SettlementProposalData): boolean {
    if (!proposal?.exists || !clientAddr) return false;
    if (role === "client") return sameAddress(proposal.proposer, clientAddr);
    if (role === "provider") return !sameAddress(proposal.proposer, clientAddr);
    return false;
  }

  function proposerLabel(proposal?: SettlementProposalData): string {
    if (!proposal?.exists) return "Unknown";
    return sameAddress(proposal.proposer, clientAddr) ? "Client" : "Provider";
  }

  const anyV1Action =
    showProviderAccept || showClientFund || showProviderSubmit || showClientApprove || showClientRefund;
  const anyV2AdjAction =
    showRequestAdj || showClientFundAdj || showClientApproveAdj || showClientRefundAdj ||
    showClientCancelAdj || showProviderAcceptAdj || showProviderSubmitAdj || showProviderCancelAdj;
  const anyV4Action =
    showV4ClientDisputeMilestone || showV4ProviderClaimMilestone || showV4DisputedMilestonesActions ||
    showV4ClientDisputeAdj || showV4ProviderClaimAdj || showV4DisputedAdjsActions;
  const anyV6Action = showProviderMilestoneExtension || showClientMilestoneExtension ||
    showProviderAdjExtension || showClientAdjExtension;
  const anyV6RevisionAction = showV6ClientRequestRevision || showV6ProviderRevisionActions || showV6ClientRevisionActions;
  const anyAction = anyV1Action || anyV2AdjAction || anyV4Action || anyV6Action || anyV6RevisionAction;

  const waitingMessage = (() => {
    if (!chainOk) return null;
    if (role === "other") return null;
    if (agreementState === 0 && isClient)
      return "Waiting for the provider to accept. You can fund once they do.";
    if (agreementState === 1 && isProvider)
      return "Waiting for the client to fund. Submissions open when escrow is funded.";
    if (agreementState === 2 && isClient && submittedToApprove.length === 0 && !anyV2AdjAction)
      return "Waiting for the provider to submit the next milestone.";
    if (agreementState === 3) return "All milestones released — this agreement is complete.";
    if (agreementState === 4) return "Agreement cancelled.";
    return null;
  })();

  // ── Request-adjustment form validation ───────────────────────────────────

  function validateAdjForm(): string[] {
    const errs: string[] = [];
    if (!adjDescription.trim()) errs.push("Description is required.");
    try {
      const amount = parseAssetAmount(adjAmount, asset);
      if (amount <= 0n) errs.push(`Amount must be > 0 ${asset.symbol}.`);
    } catch {
      errs.push(`Amount must be a valid ${asset.symbol} amount.`);
    }
    if (!adjDeadline) {
      errs.push("Deadline is required.");
    } else {
      const ts = Math.floor(new Date(adjDeadline).getTime() / 1000);
      if (ts <= Math.floor(Date.now() / 1000)) errs.push("Deadline must be in the future.");
    }
    const mid2 = parseInt(adjMilestoneId);
    if (isNaN(mid2) || mid2 < 0 || mid2 >= milestones.length)
      errs.push("Invalid milestone ID.");
    return errs;
  }

  async function handleRequestAdj() {
    const errs = validateAdjForm();
    setAdjFormErrors(errs);
    if (errs.length) return;

    const ts = BigInt(Math.floor(new Date(adjDeadline).getTime() / 1000));
    const amt = parseAssetAmount(adjAmount, asset);

    const ok = await exec("Request Adjustment", () =>
      writeContractAsync({
        address: contractAddress,
        abi: adjAbi,
        functionName: "requestAdjustment",
        args: [BigInt(adjMilestoneId), adjDescription.trim(), amt, ts],
      }),
      { actionType: "adjustment_requested" },
    );

    if (ok) {
      setShowAdjForm(false);
      setAdjDescription("");
      setAdjAmount("");
      setAdjDeadline("");
      setAdjFormErrors([]);
    }
  }

  function parseExtensionDeadline(raw: string, currentDeadline: bigint): { deadline?: bigint; error?: string } {
    if (!raw) return { error: "Proposed deadline is required." };
    const ts = BigInt(Math.floor(new Date(raw).getTime() / 1000));
    if (ts <= currentDeadline) return { error: "Proposed deadline must be later than the current deadline." };
    return { deadline: ts };
  }

  async function handleRequestMilestoneExtension() {
    const selectedId = Number(extensionMilestoneId) || 0;
    const milestone = milestones.find((m) => m.id === selectedId);
    if (!milestone) {
      setTxState({ status: "error", message: "Invalid milestone ID." });
      return;
    }
    const parsed = parseExtensionDeadline(extensionMilestoneDeadline, milestone.deadline);
    const reason = extensionMilestoneReason.trim();
    if (parsed.error || parsed.deadline === undefined) {
      setTxState({ status: "error", message: parsed.error ?? "Invalid proposed deadline." });
      return;
    }
    if (!reason) {
      setTxState({ status: "error", message: "Extension reason is required." });
      return;
    }

    const ok = await exec(`Request extension #${selectedId}`, () =>
      writeContractAsync({
        address: contractAddress,
        abi: DEALLOCK_V6_ABI,
        functionName: "requestMilestoneDeadlineExtension",
        args: [BigInt(selectedId), parsed.deadline!, reason],
      }),
      { actionType: "deadline_extension_requested", itemType: "milestone", itemId: selectedId },
    );
    if (ok) {
      setShowMilestoneExtensionForm(false);
      setExtensionMilestoneReason("");
      setExtensionMilestoneDeadline("");
    }
  }

  async function handleRequestAdjustmentExtension() {
    const selectedId = Number(extensionAdjId) || 0;
    const adjustment = adjustments.find((a) => a.id === selectedId);
    if (!adjustment) {
      setTxState({ status: "error", message: "Invalid adjustment ID." });
      return;
    }
    const parsed = parseExtensionDeadline(extensionAdjDeadline, adjustment.deadline);
    const reason = extensionAdjReason.trim();
    if (parsed.error || parsed.deadline === undefined) {
      setTxState({ status: "error", message: parsed.error ?? "Invalid proposed deadline." });
      return;
    }
    if (!reason) {
      setTxState({ status: "error", message: "Extension reason is required." });
      return;
    }

    const ok = await exec(`Request Adj extension #${selectedId}`, () =>
      writeContractAsync({
        address: contractAddress,
        abi: DEALLOCK_V6_ABI,
        functionName: "requestAdjustmentDeadlineExtension",
        args: [BigInt(selectedId), parsed.deadline!, reason],
      }),
      { actionType: "deadline_extension_requested", itemType: "adjustment", itemId: selectedId },
    );
    if (ok) {
      setShowAdjExtensionForm(false);
      setExtensionAdjReason("");
      setExtensionAdjDeadline("");
    }
  }

  async function handleDisputeMilestone() {
    if (!selectedDisputeMilestone) return;
    const reason = disputeReason.trim();
    if (!reason) {
      setTxState({ status: "error", message: "Dispute reason is required." });
      return;
    }

    const ok = await exec(`Dispute #${selectedDisputeMilestone.id}`, () =>
      writeContractAsync({
        address: contractAddress,
        abi: DEALLOCK_V4_ABI,
        functionName: "disputeMilestone",
        args: [BigInt(selectedDisputeMilestone.id), reason],
      }),
      { actionType: "dispute_opened", itemType: "milestone", itemId: selectedDisputeMilestone.id },
    );

    if (ok) {
      setShowDisputeForm(false);
      setDisputeReason("");
    }
  }

  async function handleDisputeAdjustment() {
    if (!selectedDisputeAdj) return;
    const reason = disputeAdjReason.trim();
    if (!reason) {
      setTxState({ status: "error", message: "Adjustment dispute reason is required." });
      return;
    }

    const ok = await exec(`Dispute Adj #${selectedDisputeAdj.id}`, () =>
      writeContractAsync({
        address: contractAddress,
        abi: DEALLOCK_V4_ABI,
        functionName: "disputeAdjustment",
        args: [BigInt(selectedDisputeAdj.id), reason],
      }),
      { actionType: "dispute_opened", itemType: "adjustment", itemId: selectedDisputeAdj.id },
    );

    if (ok) {
      setShowAdjDisputeForm(false);
      setDisputeAdjReason("");
    }
  }

  async function handleProposeMilestoneSettlement() {
    if (!selectedSettleMilestone) return;
    const parsed = parseSettlementAmount(settleProviderAmount, selectedSettleMilestone.amount, asset);
    if (parsed.error || parsed.amount === undefined) {
      setTxState({ status: "error", message: parsed.error ?? "Invalid settlement amount." });
      return;
    }

    const ok = await exec(`Propose settlement #${selectedSettleMilestone.id}`, () =>
      writeContractAsync({
        address: contractAddress,
        abi: DEALLOCK_V4_ABI,
        functionName: "proposeMilestoneSettlement",
        args: [BigInt(selectedSettleMilestone.id), parsed.amount!, settleNote.trim()],
      }),
      { actionType: "settlement_proposed", itemType: "milestone", itemId: selectedSettleMilestone.id },
    );

    if (ok) {
      setShowSettleForm(false);
      setSettleProviderAmount("");
      setSettleNote("");
    }
  }

  async function handleProposeAdjustmentSettlement() {
    if (!selectedSettleAdj) return;
    const parsed = parseSettlementAmount(settleAdjProviderAmount, selectedSettleAdj.amount, asset);
    if (parsed.error || parsed.amount === undefined) {
      setTxState({ status: "error", message: parsed.error ?? "Invalid settlement amount." });
      return;
    }

    const ok = await exec(`Propose Adj settlement #${selectedSettleAdj.id}`, () =>
      writeContractAsync({
        address: contractAddress,
        abi: DEALLOCK_V4_ABI,
        functionName: "proposeAdjustmentSettlement",
        args: [BigInt(selectedSettleAdj.id), parsed.amount!, settleAdjNote.trim()],
      }),
      { actionType: "settlement_proposed", itemType: "adjustment", itemId: selectedSettleAdj.id },
    );

    if (ok) {
      setShowAdjSettleForm(false);
      setSettleAdjProviderAmount("");
      setSettleAdjNote("");
    }
  }

  async function handleRequestRevision() {
    const selectedId = Number(revisionMilestoneId) || 0;
    const milestone = milestones.find((m) => m.id === selectedId);
    if (!milestone) {
      setTxState({ status: "error", message: "Invalid milestone ID." });
      return;
    }
    const reason = revisionReason.trim();
    if (!reason) {
      setTxState({ status: "error", message: "Reason is required." });
      return;
    }
    if (!revisionDeadlineInput) {
      setTxState({ status: "error", message: "Revision deadline is required." });
      return;
    }
    const ts = BigInt(Math.floor(new Date(revisionDeadlineInput).getTime() / 1000));
    if (ts <= now) {
      setTxState({ status: "error", message: "Revision deadline must be in the future." });
      return;
    }
    const ok = await exec(`Request fixes #${selectedId}`, () =>
      writeContractAsync({
        address: contractAddress,
        abi: DEALLOCK_V6_ABI,
        functionName: "requestMilestoneRevision",
        args: [BigInt(selectedId), reason, ts],
      }),
      { actionType: "revision_requested", itemType: "milestone", itemId: selectedId },
    );
    if (ok) {
      setShowRevisionForm(false);
      setRevisionReason("");
      setRevisionDeadlineInput("");
    }
  }

  async function handleProviderRequestRevisionDeadline(milestoneId: number) {
    if (!providerRevDeadlineInput) {
      setTxState({ status: "error", message: "Proposed deadline is required." });
      return;
    }
    const ts = BigInt(Math.floor(new Date(providerRevDeadlineInput).getTime() / 1000));
    if (ts <= now) {
      setTxState({ status: "error", message: "Proposed deadline must be in the future." });
      return;
    }
    const reason = providerRevDeadlineReason.trim();
    if (!reason) {
      setTxState({ status: "error", message: "Reason is required." });
      return;
    }
    const ok = await exec(`Request revision deadline #${milestoneId}`, () =>
      writeContractAsync({
        address: contractAddress,
        abi: DEALLOCK_V6_ABI,
        functionName: "requestRevisionDeadline",
        args: [BigInt(milestoneId), ts, reason],
      }),
      { actionType: "revision_deadline_requested", itemType: "milestone", itemId: milestoneId },
    );
    if (ok) {
      setShowProviderRevDeadlineForm(null);
      setProviderRevDeadlineInput("");
      setProviderRevDeadlineReason("");
    }
  }

  async function handleRejectRevision(milestoneId: number) {
    const reason = rejectRevisionReason.trim();
    if (!reason) {
      setTxState({ status: "error", message: "Rejection reason is required." });
      return;
    }
    const ok = await exec(`Reject revision #${milestoneId}`, () =>
      writeContractAsync({
        address: contractAddress,
        abi: DEALLOCK_V6_ABI,
        functionName: "rejectMilestoneRevision",
        args: [BigInt(milestoneId), reason],
      }),
      { actionType: "revision_rejected", itemType: "milestone", itemId: milestoneId },
    );
    if (ok) {
      setShowRejectRevisionForm(null);
      setRejectRevisionReason("");
    }
  }

  async function handleClientSetRevisionDeadline(milestoneId: number) {
    if (!clientRevDeadlineInput) {
      setTxState({ status: "error", message: "New deadline is required." });
      return;
    }
    const ts = BigInt(Math.floor(new Date(clientRevDeadlineInput).getTime() / 1000));
    if (ts <= now) {
      setTxState({ status: "error", message: "New deadline must be in the future." });
      return;
    }
    const ok = await exec(`Update revision deadline #${milestoneId}`, () =>
      writeContractAsync({
        address: contractAddress,
        abi: DEALLOCK_V6_ABI,
        functionName: "setRevisionDeadline",
        args: [BigInt(milestoneId), ts],
      }),
      { actionType: "revision_deadline_updated", itemType: "milestone", itemId: milestoneId },
    );
    if (ok) {
      setShowClientRevDeadlineForm(null);
      setClientRevDeadlineInput("");
    }
  }

  async function handleEscalateRevision(milestoneId: number) {
    const reason = escalateRevisionReason.trim();
    if (!reason) {
      setTxState({ status: "error", message: "Escalation reason is required." });
      return;
    }
    const ok = await exec(`Escalate revision #${milestoneId}`, () =>
      writeContractAsync({
        address: contractAddress,
        abi: DEALLOCK_V6_ABI,
        functionName: "escalateMilestoneRevisionToDispute",
        args: [BigInt(milestoneId), reason],
      }),
      { actionType: "revision_escalated", itemType: "milestone", itemId: milestoneId },
    );
    if (ok) {
      setShowEscalateRevisionForm(null);
      setEscalateRevisionReason("");
    }
  }

  const adjSubmitId = Number(adjSubmitIdInput) || 0;

  return (
    <section className="surface-card surface-card--pad anim-fade-rise" id="dealock-actions">
      <div className="section-header">
        <h2 className="section-header-title">Actions</h2>
        <span className="section-header-desc">What you can do next</span>
      </div>

      {!chainOk && (
        <div className="action-empty">
          <h3 className="action-empty-title">Switch to Sepolia</h3>
          <p className="action-empty-text">
            Contract calls are disabled on unsupported networks. Use the topbar button to switch.
          </p>
        </div>
      )}

      {chainOk && role === "other" && (
        <div
          className={`action-empty ${requiredWallet ? "action-empty--wallet-switch" : "action-empty--viewer"}`}
        >
          <h3 className="action-empty-title">
            {requiredWallet ? "Switch wallet to take action" : "Read-only for this wallet"}
          </h3>
          <p className="action-empty-text">
            {requiredWallet
              ? `This agreement belongs to your linked ${accountRole ?? ""} wallet ${shortAddress(requiredWallet.address)}${requiredWallet.label ? ` (${requiredWallet.label})` : ""}. Switch to that wallet in MetaMask to ${accountRole === "client" ? "approve or refund milestones" : "submit milestone evidence"}.`
              : "This wallet is not the client or provider on this agreement. Connect the party wallet to sign accept, fund, submit, approve, or refund."}
          </p>
        </div>
      )}

      {chainOk && role !== "other" && !anyAction && waitingMessage && (
        <div className="action-waiting">
          <span className="action-waiting-icon" aria-hidden>⏳</span>
          <span>{waitingMessage}</span>
        </div>
      )}

      {/* V1/V2 legacy note */}
      {chainOk && role !== "other" && !isV2 && !isV3 && !isV4 && agreementState === 2 && (
        <div className="banner banner-info" style={{ marginBottom: "1rem" }}>
          Paid adjustments are available only for V2 and newer agreements. This agreement was
          deployed with the original V1 contract.
        </div>
      )}

      {chainOk && anyAction && (
        <div className="action-stack">
          {/* ── V1 original actions ─────────────────────────────────────── */}

          {showProviderAccept && (
            <div className="action-group action-group--provider">
              <div className="action-group-head">
                <span className="action-group-step">Step 1 · Provider</span>
                <h3>Accept agreement</h3>
                <p>Confirm you accept the milestone terms before the client can fund.</p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={disabled}
                onClick={() =>
                  exec("Accept Agreement", () =>
                    writeContractAsync({ address: contractAddress, abi, functionName: "acceptAgreement" }),
                    { actionType: "agreement_accepted" },
                  )
                }
              >
                Accept agreement
              </button>
            </div>
          )}

          {showClientFund && (
            <div className="action-group action-group--client">
              <div className="action-group-head">
                <span className="action-group-step">Step 2 · Client</span>
                <h3>Fund escrow</h3>
                <p>Send the exact on-chain total so milestones can begin.</p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={disabled || (isErc20Payment && (allowance < totalAmount! || balance < totalAmount!))}
                onClick={() =>
                  exec("Fund Agreement", () =>
                    writeContractAsync({
                      address: contractAddress,
                      abi,
                      functionName: "fundAgreement",
                      ...(isErc20Payment ? {} : { value: totalAmount! }),
                    }),
                    { actionType: "agreement_funded" },
                  )
                }
              >
                Fund escrow ({formatAmount(totalAmount!)})
              </button>
              {isErc20Payment && (
                <div className="action-chip-row">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={disabled || allowance >= totalAmount!}
                    onClick={() => approveToken(totalAmount!)}
                  >
                    Approve {asset.symbol}
                  </button>
                  <span className="hint">
                    Approval does not transfer funds. Funding pulls {formatAmount(totalAmount!)} into escrow. ETH is still needed for gas.
                  </span>
                  {balance < totalAmount! && <span className="validation-errors">Insufficient {asset.symbol} balance.</span>}
                </div>
              )}
            </div>
          )}

          {showProviderSubmit && (
            <div className="action-group action-group--provider">
              <div className="action-group-head">
                <span className="action-group-step">Active · Provider</span>
                <h3>Submit milestone evidence</h3>
                <p>Drop in a repo URL, commit SHA, IPFS CID, or any stable pointer. It will be
                   stored on-chain as the delivery reference.</p>
              </div>
              <div className="action-input-row">
                <label className="input-label">
                  Milestone
                  <input
                    type="number" min={0} max={Math.max(0, milestones.length - 1)}
                    value={milestoneIdInput}
                    onChange={(e) => setMilestoneIdInput(e.target.value)}
                    className="input input-narrow"
                  />
                </label>
                <label className="input-label input-label--grow">
                  Evidence
                  <input
                    type="text" value={proofInput}
                    onChange={(e) => setProofInput(e.target.value)}
                    placeholder="https://… · commit SHA · IPFS CID…"
                    className="input"
                  />
                </label>
                <button
                  type="button" className="btn btn-primary action-submit-btn"
                  disabled={disabled || !proofInput.trim()}
                  onClick={() =>
                    exec(`Submit #${mid}`, () =>
                      writeContractAsync({
                        address: contractAddress, abi,
                        functionName: "submitMilestone",
                        args: [BigInt(mid), proofInput.trim()],
                      }),
                      { actionType: "milestone_submitted", itemType: "milestone", itemId: mid },
                    )
                  }
                >
                  Submit
                </button>
              </div>
            </div>
          )}

          {showProviderMilestoneExtension && (
            <div className="action-group action-group--provider">
              <div className="action-group-head">
                <span className="action-group-step">V6 · Provider</span>
                <h3>Request milestone deadline extension</h3>
                <p>Ask the client to move a pending milestone deadline. The request is public on-chain and does not block refund unless the client accepts it.</p>
              </div>
              {activeMilestoneExtensions.length > 0 && (
                <div className="action-chip-row">
                  {activeMilestoneExtensions.map((m) => (
                    <button key={m.id} type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() =>
                      exec(`Cancel extension #${m.id}`, () =>
                        writeContractAsync({
                          address: contractAddress,
                          abi: DEALLOCK_V6_ABI,
                          functionName: "cancelMilestoneDeadlineExtension",
                          args: [BigInt(m.id)],
                        }),
                        { actionType: "deadline_extension_cancelled", itemType: "milestone", itemId: m.id },
                      )
                    }>
                      Cancel active request #{m.id}
                    </button>
                  ))}
                </div>
              )}
              {!showMilestoneExtensionForm ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                  setExtensionMilestoneId(String(milestoneExtensionEligible[0]?.id ?? 0));
                  setShowMilestoneExtensionForm(true);
                }}>
                  Request extension
                </button>
              ) : (
                <div className="adj-request-form">
                  <div className="adj-warning">{PUBLIC_ONCHAIN_WARNING}</div>
                  <div className="action-input-row">
                    <label className="input-label">
                      Milestone
                      <select value={extensionMilestoneId} onChange={(e) => setExtensionMilestoneId(e.target.value)} className="input input-narrow">
                        {milestoneExtensionEligible.map((m) => <option key={m.id} value={m.id}>#{m.id}</option>)}
                      </select>
                    </label>
                    <label className="input-label">
                      New deadline
                      <input type="datetime-local" value={extensionMilestoneDeadline} onChange={(e) => setExtensionMilestoneDeadline(e.target.value)} className="input" />
                    </label>
                    <label className="input-label input-label--grow">
                      Reason
                      <input type="text" value={extensionMilestoneReason} onChange={(e) => setExtensionMilestoneReason(e.target.value)} placeholder="Public-safe reason" className="input" />
                    </label>
                  </div>
                  <div className="adj-form-actions">
                    <button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={handleRequestMilestoneExtension}>
                      Submit request
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowMilestoneExtensionForm(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {showClientMilestoneExtension && (
            <div className="action-group action-group--client">
              <div className="action-group-head">
                <span className="action-group-step">V6 · Client</span>
                <h3>Milestone deadline extension requests</h3>
                <p>Accepting updates the milestone deadline. Rejecting or ignoring does not block refund after the current deadline plus grace window.</p>
              </div>
              <div className="action-stack">
                {activeMilestoneExtensions.map((m) => {
                  const request = milestoneExtensions[m.id]!;
                  return (
                    <div key={m.id} className="adj-request-form">
                      <div className="grace-period-notice">
                        Milestone #{m.id}: {formatTimestamp(m.deadline)} → {formatTimestamp(request.proposedDeadline)}
                        {request.reason ? ` · ${request.reason}` : ""}
                      </div>
                      <div className="action-chip-row">
                        <button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={() =>
                          exec(`Accept extension #${m.id}`, () =>
                            writeContractAsync({
                              address: contractAddress,
                              abi: DEALLOCK_V6_ABI,
                              functionName: "acceptMilestoneDeadlineExtension",
                              args: [BigInt(m.id)],
                            }),
                            { actionType: "deadline_extension_accepted", itemType: "milestone", itemId: m.id },
                          )
                        }>
                          Accept
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() =>
                          exec(`Reject extension #${m.id}`, () =>
                            writeContractAsync({
                              address: contractAddress,
                              abi: DEALLOCK_V6_ABI,
                              functionName: "rejectMilestoneDeadlineExtension",
                              args: [BigInt(m.id)],
                            }),
                            { actionType: "deadline_extension_rejected", itemType: "milestone", itemId: m.id },
                          )
                        }>
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showClientApprove && (
            <div className="action-group action-group--client">
              <div className="action-group-head">
                <span className="action-group-step">Active · Client</span>
                <h3>Approve milestones</h3>
                <p>Release escrow for each milestone after verifying the delivery reference.</p>
              </div>
              <div className="action-chip-row">
                {submittedToApprove.map((m) => (
                  <button key={m.id} type="button" className="btn btn-primary btn-sm"
                    disabled={disabled}
                    onClick={() =>
                      exec(`Approve #${m.id}`, () =>
                        writeContractAsync({
                          address: contractAddress, abi,
                          functionName: "approveMilestone",
                          args: [BigInt(m.id)],
                        }),
                        { actionType: "milestone_released", itemType: "milestone", itemId: m.id },
                      )
                    }
                  >
                    Approve #{m.id} ({formatAmount(m.amount)})
                  </button>
                ))}
              </div>
            </div>
          )}

          {showClientRefund && (
            <div className="action-group action-group--danger-zone">
              <div className="action-group-head">
                <span className="action-group-step">Client · Refund</span>
                <h3>Refund expired milestones</h3>
                <p>If a milestone is still pending after its deadline, reclaim that tranche.
                  {(isV3 || isV4) && (isV6
                    ? " V6 keeps a 30-minute deadline grace window for late submission or client-approved extension requests."
                    : " V3-V5 use a short grace period before refund opens.")}
                </p>
              </div>
              {inGracePeriodMilestones.length > 0 && (
                <div className="grace-period-notice">
                  Deadline passed. Refund opens after the grace window.
                </div>
              )}
              <div className="action-chip-row">
                {expiredToRefund.map((m) => (
                  <button key={m.id} type="button" className="btn btn-danger btn-sm"
                    disabled={disabled}
                    onClick={() =>
                      exec(`Refund #${m.id}`, () =>
                        writeContractAsync({
                          address: contractAddress, abi,
                          functionName: "refundExpiredMilestone",
                          args: [BigInt(m.id)],
                        }),
                        { actionType: "milestone_refunded", itemType: "milestone", itemId: m.id },
                      )
                    }
                  >
                    Refund #{m.id} ({formatAmount(m.amount)})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── V2 adjustment actions ────────────────────────────────────── */}

          {showProviderAcceptAdj && (
            <div className="action-group action-group--provider">
              <div className="action-group-head">
                <span className="action-group-step">Provider · Adjustments</span>
                <h3>Accept paid adjustments</h3>
                <p>Accept a proposed adjustment to let the client fund it.</p>
              </div>
              <div className="action-chip-row">
                {proposedAdjs.map((a) => (
                  <button key={a.id} type="button" className="btn btn-primary btn-sm"
                    disabled={disabled}
                    onClick={() =>
                      exec(`Accept Adj #${a.id}`, () =>
                        writeContractAsync({
                          address: contractAddress, abi: adjAbi,
                          functionName: "acceptAdjustment",
                          args: [BigInt(a.id)],
                        }),
                        { actionType: "adjustment_accepted", itemType: "adjustment", itemId: a.id },
                      )
                    }
                  >
                    Accept Adj #{a.id} — {a.description.slice(0, 30)} ({formatAmount(a.amount)})
                  </button>
                ))}
              </div>
            </div>
          )}

          {showClientFundAdj && (
            <div className="action-group action-group--client">
              <div className="action-group-head">
                <span className="action-group-step">Client · Adjustments</span>
                <h3>Fund accepted adjustments</h3>
                <p>Escrow the extra payment so the provider can begin work.</p>
              </div>
              <div className="action-chip-row">
                {acceptedAdjs.map((a) => (
                  <button key={a.id} type="button" className="btn btn-primary btn-sm"
                    disabled={disabled || (isErc20Payment && (allowance < a.amount || balance < a.amount))}
                    onClick={() =>
                      exec(`Fund Adj #${a.id}`, () =>
                        writeContractAsync({
                          address: contractAddress, abi: adjAbi,
                          functionName: "fundAdjustment",
                          args: [BigInt(a.id)],
                          ...(isErc20Payment ? {} : { value: a.amount }),
                        }),
                        { actionType: "adjustment_funded", itemType: "adjustment", itemId: a.id },
                      )
                    }
                  >
                    Fund Adj #{a.id} ({formatAmount(a.amount)})
                  </button>
                ))}
              </div>
              {isErc20Payment && acceptedAdjs.map((a) => (
                <button
                  key={`approve-${a.id}`}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={disabled || allowance >= a.amount}
                  onClick={() => approveToken(a.amount)}
                >
                  Approve {asset.symbol} for Adj #{a.id}
                </button>
              ))}
            </div>
          )}

          {showProviderSubmitAdj && (
            <div className="action-group action-group--provider">
              <div className="action-group-head">
                <span className="action-group-step">Provider · Adjustments</span>
                <h3>Submit adjustment proof</h3>
                <p>Provide a stable public reference — URL, commit SHA, or IPFS CID.
                   Proof is stored on-chain and is publicly visible; do not include private
                   credentials or confidential data.</p>
              </div>
              <div className="action-input-row">
                <label className="input-label">
                  Adjustment
                  <input type="number" min={0}
                    max={Math.max(0, adjustments.length - 1)}
                    value={adjSubmitIdInput}
                    onChange={(e) => setAdjSubmitIdInput(e.target.value)}
                    className="input input-narrow"
                  />
                </label>
                <label className="input-label input-label--grow">
                  Proof
                  <input type="text" value={adjProofInput}
                    onChange={(e) => setAdjProofInput(e.target.value)}
                    placeholder="https://… · commit SHA · IPFS CID…"
                    className="input"
                  />
                </label>
                <button type="button" className="btn btn-primary action-submit-btn"
                  disabled={disabled || !adjProofInput.trim()}
                  onClick={() =>
                    exec(`Submit Adj #${adjSubmitId}`, () =>
                      writeContractAsync({
                        address: contractAddress, abi: adjAbi,
                        functionName: "submitAdjustment",
                        args: [BigInt(adjSubmitId), adjProofInput.trim()],
                      }),
                      { actionType: "adjustment_submitted", itemType: "adjustment", itemId: adjSubmitId },
                    )
                  }
                >
                  Submit
                </button>
              </div>
            </div>
          )}

          {showProviderAdjExtension && (
            <div className="action-group action-group--provider">
              <div className="action-group-head">
                <span className="action-group-step">V6 · Provider</span>
                <h3>Request adjustment deadline extension</h3>
                <p>Ask the client to move a funded adjustment deadline. The request itself does not block refund after the current grace window.</p>
              </div>
              {activeAdjExtensions.length > 0 && (
                <div className="action-chip-row">
                  {activeAdjExtensions.map((a) => (
                    <button key={a.id} type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() =>
                      exec(`Cancel Adj extension #${a.id}`, () =>
                        writeContractAsync({
                          address: contractAddress,
                          abi: DEALLOCK_V6_ABI,
                          functionName: "cancelAdjustmentDeadlineExtension",
                          args: [BigInt(a.id)],
                        }),
                        { actionType: "deadline_extension_cancelled", itemType: "adjustment", itemId: a.id },
                      )
                    }>
                      Cancel active request Adj #{a.id}
                    </button>
                  ))}
                </div>
              )}
              {!showAdjExtensionForm ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                  setExtensionAdjId(String(adjExtensionEligible[0]?.id ?? 0));
                  setShowAdjExtensionForm(true);
                }}>
                  Request adjustment extension
                </button>
              ) : (
                <div className="adj-request-form">
                  <div className="adj-warning">{PUBLIC_ONCHAIN_WARNING}</div>
                  <div className="action-input-row">
                    <label className="input-label">
                      Adjustment
                      <select value={extensionAdjId} onChange={(e) => setExtensionAdjId(e.target.value)} className="input input-narrow">
                        {adjExtensionEligible.map((a) => <option key={a.id} value={a.id}>#{a.id}</option>)}
                      </select>
                    </label>
                    <label className="input-label">
                      New deadline
                      <input type="datetime-local" value={extensionAdjDeadline} onChange={(e) => setExtensionAdjDeadline(e.target.value)} className="input" />
                    </label>
                    <label className="input-label input-label--grow">
                      Reason
                      <input type="text" value={extensionAdjReason} onChange={(e) => setExtensionAdjReason(e.target.value)} placeholder="Public-safe reason" className="input" />
                    </label>
                  </div>
                  <div className="adj-form-actions">
                    <button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={handleRequestAdjustmentExtension}>
                      Submit request
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAdjExtensionForm(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {showClientAdjExtension && (
            <div className="action-group action-group--client">
              <div className="action-group-head">
                <span className="action-group-step">V6 · Client</span>
                <h3>Adjustment deadline extension requests</h3>
                <p>Accepting updates the adjustment deadline. Rejecting or ignoring keeps refund timing based on the current deadline.</p>
              </div>
              <div className="action-stack">
                {activeAdjExtensions.map((a) => {
                  const request = adjExtensions[a.id]!;
                  return (
                    <div key={a.id} className="adj-request-form">
                      <div className="grace-period-notice">
                        Adjustment #{a.id}: {formatTimestamp(a.deadline)} → {formatTimestamp(request.proposedDeadline)}
                        {request.reason ? ` · ${request.reason}` : ""}
                      </div>
                      <div className="action-chip-row">
                        <button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={() =>
                          exec(`Accept Adj extension #${a.id}`, () =>
                            writeContractAsync({
                              address: contractAddress,
                              abi: DEALLOCK_V6_ABI,
                              functionName: "acceptAdjustmentDeadlineExtension",
                              args: [BigInt(a.id)],
                            }),
                            { actionType: "deadline_extension_accepted", itemType: "adjustment", itemId: a.id },
                          )
                        }>
                          Accept
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() =>
                          exec(`Reject Adj extension #${a.id}`, () =>
                            writeContractAsync({
                              address: contractAddress,
                              abi: DEALLOCK_V6_ABI,
                              functionName: "rejectAdjustmentDeadlineExtension",
                              args: [BigInt(a.id)],
                            }),
                            { actionType: "deadline_extension_rejected", itemType: "adjustment", itemId: a.id },
                          )
                        }>
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showClientApproveAdj && (
            <div className="action-group action-group--client">
              <div className="action-group-head">
                <span className="action-group-step">Client · Adjustments</span>
                <h3>Approve adjustments</h3>
                <p>Release extra payment after verifying the submitted proof.</p>
              </div>
              <div className="action-chip-row">
                {submittedAdjs.map((a) => (
                  <button key={a.id} type="button" className="btn btn-primary btn-sm"
                    disabled={disabled}
                    onClick={() =>
                      exec(`Approve Adj #${a.id}`, () =>
                        writeContractAsync({
                          address: contractAddress, abi: adjAbi,
                          functionName: "approveAdjustment",
                          args: [BigInt(a.id)],
                        }),
                        { actionType: "adjustment_released", itemType: "adjustment", itemId: a.id },
                      )
                    }
                  >
                    Approve Adj #{a.id} ({formatAmount(a.amount)})
                  </button>
                ))}
              </div>
            </div>
          )}

          {showClientRefundAdj && (
            <div className="action-group action-group--danger-zone">
              <div className="action-group-head">
                <span className="action-group-step">Client · Adjustments</span>
                <h3>Refund expired adjustments</h3>
                <p>Reclaim funded adjustment payment if the provider missed the deadline.
                  {(isV3 || isV4) && (isV6
                    ? " V6 keeps a 30-minute deadline grace window for late submission or client-approved extension requests."
                    : " V3-V5 use a short grace period before refund opens.")}
                </p>
              </div>
              {inGracePeriodAdjs.length > 0 && (
                <div className="grace-period-notice">
                  Deadline passed. Refund opens after the grace window.
                </div>
              )}
              <div className="action-chip-row">
                {expiredFundedAdjs.map((a) => (
                  <button key={a.id} type="button" className="btn btn-danger btn-sm"
                    disabled={disabled}
                    onClick={() =>
                      exec(`Refund Adj #${a.id}`, () =>
                        writeContractAsync({
                          address: contractAddress, abi: adjAbi,
                          functionName: "refundExpiredAdjustment",
                          args: [BigInt(a.id)],
                        }),
                        { actionType: "adjustment_refunded", itemType: "adjustment", itemId: a.id },
                      )
                    }
                  >
                    Refund Adj #{a.id} ({formatAmount(a.amount)})
                  </button>
                ))}
              </div>
            </div>
          )}

          {(showClientCancelAdj || showProviderCancelAdj) && (
            <div className="action-group action-group--danger-zone">
              <div className="action-group-head">
                <span className="action-group-step">Cancel · Adjustments</span>
                <h3>Cancel pending adjustments</h3>
                <p>Either party can cancel a proposed or accepted unfunded adjustment.</p>
              </div>
              <div className="action-chip-row">
                {cancellableAdjs.map((a) => (
                  <button key={a.id} type="button" className="btn btn-ghost btn-sm"
                    disabled={disabled}
                    onClick={() =>
                      exec(`Cancel Adj #${a.id}`, () =>
                        writeContractAsync({
                          address: contractAddress, abi: adjAbi,
                          functionName: "cancelAdjustment",
                          args: [BigInt(a.id)],
                        }),
                      )
                    }
                  >
                    Cancel Adj #{a.id} ({adjustmentLabel(a.state)})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Request adjustment form ──────────────────────────────────── */}

          {showRequestAdj && (
            <div className="action-group action-group--client">
              <div className="action-group-head">
                <span className="action-group-step">Client · Change Order</span>
                <h3>Request paid adjustment</h3>
                <p>Propose extra paid work attached to an existing milestone. Provider must
                   accept before you fund it.</p>
              </div>

              {!showAdjForm ? (
                <button type="button" className="btn btn-secondary btn-sm"
                  onClick={() => setShowAdjForm(true)}>
                  + Request adjustment
                </button>
              ) : (
                <div className="adj-request-form">
                  <div className="adj-warning">
                    Adjustment descriptions and proof strings are stored permanently on-chain and
                    are publicly visible. Do not include private credentials, confidential client
                    information, or sensitive business details.
                  </div>
                  <div className="action-input-row">
                    <label className="input-label">
                      Milestone
                      <input type="number" min={0}
                        max={Math.max(0, milestones.length - 1)}
                        value={adjMilestoneId}
                        onChange={(e) => setAdjMilestoneId(e.target.value)}
                        className="input input-narrow"
                      />
                    </label>
                    <label className="input-label input-label--grow">
                      Description
                      <input type="text" value={adjDescription}
                        onChange={(e) => setAdjDescription(e.target.value)}
                        placeholder="e.g. Add dark mode toggle"
                        className="input"
                      />
                    </label>
                  </div>
                  <div className="action-input-row">
                    <label className="input-label">
                      Amount ({asset.symbol})
                      <input type="number" step={inputStep(asset)} min="0"
                        value={adjAmount}
                        onChange={(e) => setAdjAmount(e.target.value)}
                        className="input input-narrow"
                      />
                    </label>
                    <label className="input-label input-label--grow">
                      Deadline
                      <input type="datetime-local" value={adjDeadline}
                        onChange={(e) => setAdjDeadline(e.target.value)}
                        className="input"
                      />
                    </label>
                  </div>
                  {adjFormErrors.length > 0 && (
                    <div className="validation-errors">
                      {adjFormErrors.map((e, i) => <div key={i}>{e}</div>)}
                    </div>
                  )}
                  <div className="adj-form-actions">
                    <button type="button" className="btn btn-primary btn-sm"
                      disabled={disabled}
                      onClick={handleRequestAdj}>
                      Submit request
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm"
                      onClick={() => { setShowAdjForm(false); setAdjFormErrors([]); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── V6 revision request actions ──────────────────────────────── */}

          {showV6ClientRequestRevision && (
            <div className="action-group action-group--client">
              <div className="action-group-head">
                <span className="action-group-step">Client · Review</span>
                <h3>Request fixes</h3>
                <p>Ask the provider to fix the submitted work within the original scope. This is the cooperative path; direct dispute remains available if funds need to be locked for settlement.</p>
              </div>
              {!showRevisionForm ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                  setRevisionMilestoneId(String(revisionEligibleMilestones[0]?.id ?? 0));
                  setShowRevisionForm(true);
                }}>
                  Request fixes
                </button>
              ) : (
                <div className="adj-request-form">
                  <div className="adj-warning">{PUBLIC_ONCHAIN_WARNING}</div>
                  <div className="action-input-row">
                    <label className="input-label">
                      Milestone
                      <select value={revisionMilestoneId} onChange={(e) => setRevisionMilestoneId(e.target.value)} className="input input-narrow">
                        {revisionEligibleMilestones.map((m) => <option key={m.id} value={m.id}>#{m.id}</option>)}
                      </select>
                    </label>
                    <label className="input-label">
                      Fix deadline
                      <input type="datetime-local" value={revisionDeadlineInput} onChange={(e) => setRevisionDeadlineInput(e.target.value)} className="input" />
                    </label>
                    <label className="input-label input-label--grow">
                      Reason
                      <input type="text" value={revisionReason} onChange={(e) => setRevisionReason(e.target.value)} placeholder="What needs to be fixed?" className="input" />
                    </label>
                  </div>
                  <div className="adj-form-actions">
                    <button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={handleRequestRevision}>
                      Request fixes
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowRevisionForm(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {showV6ProviderRevisionActions && (
            <div className="action-group action-group--provider">
              <div className="action-group-head">
                <span className="action-group-step">Provider · Revision</span>
                <h3>Respond to revision request</h3>
                <p>Accept the revision to return the milestone to pending with the client-selected deadline. Request more time if needed. Reject to escalate to a dispute.</p>
              </div>
              {revisionRequestedMilestones.map((m) => {
                const revision = milestoneRevisions[m.id];
                if (!revision?.exists) return null;
                return (
                  <div key={m.id} className="adj-request-form">
                    <div className="action-group-head">
                      <span className="action-group-step">Milestone #{m.id} — Revision round {String(revision.revisionRound)}</span>
                      <h3>{m.description}</h3>
                      <p>Reason: {revision.reason} · Fix deadline: {formatTimestamp(revision.revisionDeadline)}</p>
                      {revision.providerDeadlineRequestExists && (
                        <p>Your requested deadline: {formatTimestamp(revision.providerRequestedDeadline)} · {revision.providerDeadlineReason}</p>
                      )}
                    </div>
                    <div className="action-chip-row">
                      <button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={() =>
                        exec(`Accept revision #${m.id}`, () =>
                          writeContractAsync({
                            address: contractAddress,
                            abi: DEALLOCK_V6_ABI,
                            functionName: "acceptMilestoneRevision",
                            args: [BigInt(m.id)],
                          }),
                          { actionType: "revision_accepted", itemType: "milestone", itemId: m.id },
                        )
                      }>
                        Accept revision
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => {
                        setShowProviderRevDeadlineForm(m.id);
                        setShowRejectRevisionForm(null);
                      }}>
                        Request different deadline
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" disabled={disabled} onClick={() => {
                        setShowRejectRevisionForm(m.id);
                        setShowProviderRevDeadlineForm(null);
                      }}>
                        Reject (escalate dispute)
                      </button>
                    </div>
                    {showProviderRevDeadlineForm === m.id && (
                      <div className="adj-request-form">
                        <div className="adj-warning">{PUBLIC_ONCHAIN_WARNING}</div>
                        <div className="action-input-row">
                          <label className="input-label">
                            Requested deadline
                            <input type="datetime-local" value={providerRevDeadlineInput} onChange={(e) => setProviderRevDeadlineInput(e.target.value)} className="input" />
                          </label>
                          <label className="input-label input-label--grow">
                            Reason
                            <input type="text" value={providerRevDeadlineReason} onChange={(e) => setProviderRevDeadlineReason(e.target.value)} placeholder="Why do you need more time?" className="input" />
                          </label>
                        </div>
                        <div className="adj-form-actions">
                          <button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={() => handleProviderRequestRevisionDeadline(m.id)}>
                            Submit deadline request
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowProviderRevDeadlineForm(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {showRejectRevisionForm === m.id && (
                      <div className="adj-request-form">
                        <div className="adj-warning">{PUBLIC_ONCHAIN_WARNING}</div>
                        <div className="action-input-row">
                          <label className="input-label input-label--grow">
                            Rejection reason
                            <input type="text" value={rejectRevisionReason} onChange={(e) => setRejectRevisionReason(e.target.value)} placeholder="Why is the work acceptable as-is?" className="input" />
                          </label>
                        </div>
                        <div className="adj-form-actions">
                          <button type="button" className="btn btn-danger btn-sm" disabled={disabled} onClick={() => handleRejectRevision(m.id)}>
                            Reject and escalate dispute
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowRejectRevisionForm(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {showV6ClientRevisionActions && (
            <div className="action-group action-group--client">
              <div className="action-group-head">
                <span className="action-group-step">Client · Revision</span>
                <h3>Revision request active</h3>
                <p>You can update the fix deadline. If the provider ignores the request for 3 days, you can escalate it to a dispute.</p>
              </div>
              {revisionRequestedMilestones.map((m) => {
                const revision = milestoneRevisions[m.id];
                if (!revision?.exists) return null;
                const responseDeadline = revisionResponseDeadline(m.id, revision);
                const canEscalate = responseDeadline > 0n && now > responseDeadline;
                return (
                  <div key={m.id} className="adj-request-form">
                    <div className="grace-period-notice">
                      Milestone #{m.id}: Revision round {String(revision.revisionRound)} · Fix deadline: {formatTimestamp(revision.revisionDeadline)}
                      <> · Provider response deadline: {formatTimestamp(responseDeadline)}</>
                      {revision.providerDeadlineRequestExists && (
                        <> · Provider requests: {formatTimestamp(revision.providerRequestedDeadline)} ({revision.providerDeadlineReason})</>
                      )}
                    </div>
                    <div className="action-chip-row">
                      <button type="button" className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => {
                        setShowClientRevDeadlineForm(showClientRevDeadlineForm === m.id ? null : m.id);
                        setClientRevDeadlineInput("");
                      }}>
                        Update fix deadline
                      </button>
                      {canEscalate && (
                        <button type="button" className="btn btn-danger btn-sm" disabled={disabled} onClick={() => {
                          setShowEscalateRevisionForm(showEscalateRevisionForm === m.id ? null : m.id);
                          setEscalateRevisionReason("");
                        }}>
                          Escalate to dispute
                        </button>
                      )}
                    </div>
                    {showClientRevDeadlineForm === m.id && (
                      <div className="adj-request-form">
                        <div className="action-input-row">
                          <label className="input-label">
                            New fix deadline
                            <input type="datetime-local" value={clientRevDeadlineInput} onChange={(e) => setClientRevDeadlineInput(e.target.value)} className="input" />
                          </label>
                        </div>
                        <div className="adj-form-actions">
                          <button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={() => handleClientSetRevisionDeadline(m.id)}>
                            Update deadline
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowClientRevDeadlineForm(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {showEscalateRevisionForm === m.id && (
                      <div className="adj-request-form">
                        <div className="adj-warning">{PUBLIC_ONCHAIN_WARNING}</div>
                        <div className="action-input-row">
                          <label className="input-label input-label--grow">
                            Escalation reason
                            <input type="text" value={escalateRevisionReason} onChange={(e) => setEscalateRevisionReason(e.target.value)} placeholder="Why should this revision become a dispute?" className="input" />
                          </label>
                        </div>
                        <div className="adj-form-actions">
                          <button type="button" className="btn btn-danger btn-sm" disabled={disabled} onClick={() => handleEscalateRevision(m.id)}>
                            Escalate dispute
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowEscalateRevisionForm(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── V4 milestone review / dispute / settlement actions ───────── */}

          {showV4ClientDisputeMilestone && (
            <div className="action-group action-group--danger-zone">
              <div className="action-group-head">
                <span className="action-group-step">Client · Review</span>
                <h3>Dispute submitted milestone</h3>
                <p>Open a dispute during the {reviewPeriodLabel} review period to lock funds for mutual settlement. For ordinary fixes on V6 agreements, use Request fixes first.</p>
              </div>
              <div className="action-chip-row">
                {submittedMilestonesInReview.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={disabled}
                    onClick={() => {
                      setDisputeMilestoneId(m.id);
                      setShowDisputeForm(true);
                    }}
                  >
                    Dispute #{m.id} · until {formatTimestamp(milestoneReviewDeadlines[m.id] ?? 0n)}
                  </button>
                ))}
              </div>

              {showDisputeForm && selectedDisputeMilestone && (
                <div className="adj-request-form">
                  <div className="adj-warning">{PUBLIC_ONCHAIN_WARNING}</div>
                  <div className="action-input-row">
                    <label className="input-label">
                      Milestone
                      <select
                        value={selectedDisputeMilestone.id}
                        onChange={(e) => setDisputeMilestoneId(Number(e.target.value))}
                        className="input input-narrow"
                      >
                        {submittedMilestonesInReview.map((m) => (
                          <option key={m.id} value={m.id}>#{m.id}</option>
                        ))}
                      </select>
                    </label>
                    <label className="input-label input-label--grow">
                      Reason
                      <input
                        type="text"
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        placeholder="Public-safe summary of the issue"
                        className="input"
                      />
                    </label>
                  </div>
                  <div className="adj-form-actions">
                    <button type="button" className="btn btn-danger btn-sm" disabled={disabled} onClick={handleDisputeMilestone}>
                      Open dispute
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowDisputeForm(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {showV4ProviderClaimMilestone && (
            <div className="action-group action-group--provider">
              <div className="action-group-head">
                <span className="action-group-step">Provider · Review</span>
                <h3>Claim after review period</h3>
                <p>The client did not dispute before the review deadline, so you can release payment.</p>
              </div>
              <div className="action-chip-row">
                {submittedMilestonesReviewExpired.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={disabled}
                    onClick={() =>
                      exec(`Claim #${m.id}`, () =>
                        writeContractAsync({
                          address: contractAddress,
                          abi: DEALLOCK_V4_ABI,
                          functionName: "claimMilestoneAfterReview",
                          args: [BigInt(m.id)],
                        }),
                        { actionType: "review_claimed", itemType: "milestone", itemId: m.id },
                      )
                    }
                  >
                    Claim #{m.id} ({formatAmount(m.amount)})
                  </button>
                ))}
              </div>
            </div>
          )}

          {showV4DisputedMilestonesActions && (
            <div className="action-group action-group--client">
              <div className="action-group-head">
                <span className="action-group-step">Settlement · Milestones</span>
                <h3>Resolve disputed milestones</h3>
                <p>Settlement divides the locked milestone amount. The provider receives the provider share; the rest returns to the client.</p>
              </div>

              <div className="action-stack">
                {disputedMilestones.map((m) => {
                  const dispute = milestoneDisputes[m.id];
                  const proposal = milestoneSettlements[m.id];
                  const byCurrentUser = proposalByCurrentRole(proposal);
                  const clientAmount = proposal?.exists ? m.amount - proposal.providerAmount : 0n;
                  return (
                    <div key={m.id} className="adj-request-form">
                      <div className="action-group-head">
                        <span className="action-group-step">Milestone #{m.id}</span>
                        <h3>{m.description}</h3>
                        {dispute?.exists && (
                          <p>Reason: {dispute.reason} · opened {formatTimestamp(dispute.openedAt)}</p>
                        )}
                      </div>
                      {proposal?.exists ? (
                        <>
                          <div className="grace-period-notice">
                            Proposed by {proposerLabel(proposal)} · provider {formatAmount(proposal.providerAmount)} · client {formatAmount(clientAmount)}
                            {proposal.note ? ` · ${proposal.note}` : ""}
                          </div>
                          <div className="action-chip-row">
                            {!byCurrentUser && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={disabled}
                                onClick={() =>
                                  exec(`Accept settlement #${m.id}`, () =>
                                    writeContractAsync({
                                      address: contractAddress,
                                      abi: DEALLOCK_V4_ABI,
                                      functionName: "acceptMilestoneSettlement",
                                      args: [BigInt(m.id)],
                                    }),
                                    { actionType: "settlement_accepted", itemType: "milestone", itemId: m.id },
                                  )
                                }
                              >
                                Accept settlement
                              </button>
                            )}
                            {byCurrentUser && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={disabled}
                                onClick={() =>
                                  exec(`Cancel settlement #${m.id}`, () =>
                                    writeContractAsync({
                                      address: contractAddress,
                                      abi: DEALLOCK_V4_ABI,
                                      functionName: "cancelMilestoneSettlement",
                                      args: [BigInt(m.id)],
                                    }),
                                  )
                                }
                              >
                                Cancel proposal
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="grace-period-notice">No active settlement proposal.</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!showSettleForm ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSettleMilestoneId(disputedMilestones[0]?.id ?? 0);
                    setShowSettleForm(true);
                  }}
                >
                  Propose milestone settlement
                </button>
              ) : selectedSettleMilestone && (
                <div className="adj-request-form">
                  <div className="adj-warning">{PUBLIC_ONCHAIN_WARNING}</div>
                  <div className="action-input-row">
                    <label className="input-label">
                      Milestone
                      <select
                        value={selectedSettleMilestone.id}
                        onChange={(e) => setSettleMilestoneId(Number(e.target.value))}
                        className="input input-narrow"
                      >
                        {disputedMilestones.map((m) => (
                          <option key={m.id} value={m.id}>#{m.id}</option>
                        ))}
                      </select>
                    </label>
                    <label className="input-label">
                      Provider share ({asset.symbol})
                      <input
                        type="number"
                        step={inputStep(asset)}
                        min="0"
                        max={inputMax(selectedSettleMilestone.amount, asset)}
                        value={settleProviderAmount}
                        onChange={(e) => setSettleProviderAmount(e.target.value)}
                        className="input input-narrow"
                      />
                    </label>
                    <label className="input-label input-label--grow">
                      Note
                      <input
                        type="text"
                        value={settleNote}
                        onChange={(e) => setSettleNote(e.target.value)}
                        placeholder="Optional public-safe settlement note"
                        className="input"
                      />
                    </label>
                  </div>
                  <div className="grace-period-notice">
                    Provider receives {formatAmount(milestoneProviderSharePreview)} · client receives {formatAmount(milestoneClientSharePreview)}.
                  </div>
                  <div className="adj-form-actions">
                    <button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={handleProposeMilestoneSettlement}>
                      Propose settlement
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowSettleForm(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── V4 adjustment review / dispute / settlement actions ──────── */}

          {showV4ClientDisputeAdj && (
            <div className="action-group action-group--danger-zone">
              <div className="action-group-head">
                <span className="action-group-step">Client · Adjustment Review</span>
                <h3>Dispute submitted adjustment</h3>
                <p>Open a dispute during the {reviewPeriodLabel} review period if the adjustment is incomplete or outside scope.</p>
              </div>
              <div className="action-chip-row">
                {submittedAdjsInReview.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={disabled}
                    onClick={() => {
                      setDisputeAdjId(a.id);
                      setShowAdjDisputeForm(true);
                    }}
                  >
                    Dispute Adj #{a.id} · until {formatTimestamp(adjReviewDeadlines[a.id] ?? 0n)}
                  </button>
                ))}
              </div>

              {showAdjDisputeForm && selectedDisputeAdj && (
                <div className="adj-request-form">
                  <div className="adj-warning">{PUBLIC_ONCHAIN_WARNING}</div>
                  <div className="action-input-row">
                    <label className="input-label">
                      Adjustment
                      <select
                        value={selectedDisputeAdj.id}
                        onChange={(e) => setDisputeAdjId(Number(e.target.value))}
                        className="input input-narrow"
                      >
                        {submittedAdjsInReview.map((a) => (
                          <option key={a.id} value={a.id}>#{a.id}</option>
                        ))}
                      </select>
                    </label>
                    <label className="input-label input-label--grow">
                      Reason
                      <input
                        type="text"
                        value={disputeAdjReason}
                        onChange={(e) => setDisputeAdjReason(e.target.value)}
                        placeholder="Public-safe summary of the issue"
                        className="input"
                      />
                    </label>
                  </div>
                  <div className="adj-form-actions">
                    <button type="button" className="btn btn-danger btn-sm" disabled={disabled} onClick={handleDisputeAdjustment}>
                      Open dispute
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAdjDisputeForm(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {showV4ProviderClaimAdj && (
            <div className="action-group action-group--provider">
              <div className="action-group-head">
                <span className="action-group-step">Provider · Adjustment Review</span>
                <h3>Claim adjustment after review</h3>
                <p>The client did not dispute before the review deadline, so you can release adjustment payment.</p>
              </div>
              <div className="action-chip-row">
                {submittedAdjsReviewExpired.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={disabled}
                    onClick={() =>
                      exec(`Claim Adj #${a.id}`, () =>
                        writeContractAsync({
                          address: contractAddress,
                          abi: DEALLOCK_V4_ABI,
                          functionName: "claimAdjustmentAfterReview",
                          args: [BigInt(a.id)],
                        }),
                        { actionType: "review_claimed", itemType: "adjustment", itemId: a.id },
                      )
                    }
                  >
                    Claim Adj #{a.id} ({formatAmount(a.amount)})
                  </button>
                ))}
              </div>
            </div>
          )}

          {showV4DisputedAdjsActions && (
            <div className="action-group action-group--client">
              <div className="action-group-head">
                <span className="action-group-step">Settlement · Adjustments</span>
                <h3>Resolve disputed adjustments</h3>
                <p>Settlement divides the locked adjustment amount. Both parties must agree before funds move.</p>
              </div>

              <div className="action-stack">
                {disputedAdjs.map((a) => {
                  const dispute = adjDisputes[a.id];
                  const proposal = adjSettlements[a.id];
                  const byCurrentUser = proposalByCurrentRole(proposal);
                  const clientAmount = proposal?.exists ? a.amount - proposal.providerAmount : 0n;
                  return (
                    <div key={a.id} className="adj-request-form">
                      <div className="action-group-head">
                        <span className="action-group-step">Adjustment #{a.id}</span>
                        <h3>{a.description}</h3>
                        {dispute?.exists && (
                          <p>Reason: {dispute.reason} · opened {formatTimestamp(dispute.openedAt)}</p>
                        )}
                      </div>
                      {proposal?.exists ? (
                        <>
                          <div className="grace-period-notice">
                            Proposed by {proposerLabel(proposal)} · provider {formatAmount(proposal.providerAmount)} · client {formatAmount(clientAmount)}
                            {proposal.note ? ` · ${proposal.note}` : ""}
                          </div>
                          <div className="action-chip-row">
                            {!byCurrentUser && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={disabled}
                                onClick={() =>
                                  exec(`Accept Adj settlement #${a.id}`, () =>
                                    writeContractAsync({
                                      address: contractAddress,
                                      abi: DEALLOCK_V4_ABI,
                                      functionName: "acceptAdjustmentSettlement",
                                      args: [BigInt(a.id)],
                                    }),
                                    { actionType: "settlement_accepted", itemType: "adjustment", itemId: a.id },
                                  )
                                }
                              >
                                Accept settlement
                              </button>
                            )}
                            {byCurrentUser && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={disabled}
                                onClick={() =>
                                  exec(`Cancel Adj settlement #${a.id}`, () =>
                                    writeContractAsync({
                                      address: contractAddress,
                                      abi: DEALLOCK_V4_ABI,
                                      functionName: "cancelAdjustmentSettlement",
                                      args: [BigInt(a.id)],
                                    }),
                                  )
                                }
                              >
                                Cancel proposal
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="grace-period-notice">No active settlement proposal.</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!showAdjSettleForm ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSettleAdjId(disputedAdjs[0]?.id ?? 0);
                    setShowAdjSettleForm(true);
                  }}
                >
                  Propose adjustment settlement
                </button>
              ) : selectedSettleAdj && (
                <div className="adj-request-form">
                  <div className="adj-warning">{PUBLIC_ONCHAIN_WARNING}</div>
                  <div className="action-input-row">
                    <label className="input-label">
                      Adjustment
                      <select
                        value={selectedSettleAdj.id}
                        onChange={(e) => setSettleAdjId(Number(e.target.value))}
                        className="input input-narrow"
                      >
                        {disputedAdjs.map((a) => (
                          <option key={a.id} value={a.id}>#{a.id}</option>
                        ))}
                      </select>
                    </label>
                    <label className="input-label">
                      Provider share ({asset.symbol})
                      <input
                        type="number"
                        step={inputStep(asset)}
                        min="0"
                        max={inputMax(selectedSettleAdj.amount, asset)}
                        value={settleAdjProviderAmount}
                        onChange={(e) => setSettleAdjProviderAmount(e.target.value)}
                        className="input input-narrow"
                      />
                    </label>
                    <label className="input-label input-label--grow">
                      Note
                      <input
                        type="text"
                        value={settleAdjNote}
                        onChange={(e) => setSettleAdjNote(e.target.value)}
                        placeholder="Optional public-safe settlement note"
                        className="input"
                      />
                    </label>
                  </div>
                  <div className="grace-period-notice">
                    Provider receives {formatAmount(adjProviderSharePreview)} · client receives {formatAmount(adjClientSharePreview)}.
                  </div>
                  <div className="adj-form-actions">
                    <button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={handleProposeAdjustmentSettlement}>
                      Propose settlement
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAdjSettleForm(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {txState.status === "pending" && (
        <div className="tx-status tx-pending">Waiting for wallet signature · {txState.label}</div>
      )}
      {txState.status === "confirming" && (
        <div className="tx-status tx-pending">
          <span>Confirming on-chain · {txState.label}</span>
          <TxLink hash={txState.hash} chainId={chainId} />
        </div>
      )}
      {txState.status === "success" && (
        <div className="tx-status tx-success">
          <strong>Confirmed</strong>
          <TxLink hash={txState.hash} chainId={chainId} />
        </div>
      )}
      {txState.status === "error" && (
        <div className="tx-status tx-error">{txState.message}</div>
      )}
      {notificationState.status === "pending" && (
        <div className="tx-status tx-pending">Sending notification email…</div>
      )}
      {notificationState.status === "attempted" && (
        <div className="tx-status tx-success">Transaction confirmed. Notification email attempted.</div>
      )}
      {notificationState.status === "failed" && (
        <div className="tx-status tx-error">Transaction confirmed. Notification email failed.</div>
      )}
    </section>
  );
}

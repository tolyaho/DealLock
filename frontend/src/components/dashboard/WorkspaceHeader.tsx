import { type Address } from "viem";
import { useChainId } from "wagmi";
import { agreementLabel, formatEth, type Role } from "../../types.ts";
import { chainName, explorerAddressUrl, isSepoliaChain } from "../../network.ts";
import { templateLabel, type ServiceTemplateId } from "../../templates.ts";
import CopyButton from "../ui/CopyButton.tsx";

interface WorkspaceHeaderProps {
  contractAddress: Address;
  role: Role;
  projectTitle?: string;
  serviceTemplate?: ServiceTemplateId;
  agreementState?: number;
  totalAmount?: bigint;
  releasedAmount?: bigint;
  refundedAmount?: bigint;
  onRefresh?: () => void;
  refreshing?: boolean;
}

function roleLabel(role: Role): string {
  if (role === "client") return "Client";
  if (role === "provider") return "Provider";
  return "Viewer";
}

function roleSummary(role: Role, state?: number): string {
  if (state === undefined) return "Loading agreement state…";
  if (role === "client") {
    if (state === 0) return "Waiting for the provider to accept. Nothing for you to sign yet.";
    if (state === 1) return "Fund the escrow to unlock milestone delivery.";
    if (state === 2) return "Approve submitted milestones or refund past-deadline ones.";
    if (state === 3) return "All milestones released. Contract complete.";
    if (state === 4) return "Agreement cancelled.";
    return "Client view — actions appear when relevant.";
  }
  if (role === "provider") {
    if (state === 0) return "Accept the agreement terms to let the client fund.";
    if (state === 1) return "Waiting for the client to fund. Nothing for you to sign yet.";
    if (state === 2) return "Submit delivery evidence for the next milestone in sequence.";
    if (state === 3) return "All milestones released. Contract complete.";
    if (state === 4) return "Agreement cancelled.";
    return "Provider view — actions appear when relevant.";
  }
  return "Read-only — this wallet is neither client nor provider on this agreement.";
}

function computeProgress(
  totalAmount?: bigint,
  releasedAmount?: bigint,
  refundedAmount?: bigint,
) {
  if (totalAmount === undefined || totalAmount === 0n) return null;
  const released = releasedAmount ?? 0n;
  const refunded = refundedAmount ?? 0n;
  const resolved = released + refunded;
  const percent = Math.min(100, Math.max(0, Number((resolved * 1000n) / totalAmount) / 10));
  return {
    percent,
    resolved,
    total: totalAmount,
    released,
    refunded,
  };
}

export default function WorkspaceHeader({
  contractAddress,
  role,
  projectTitle,
  serviceTemplate,
  agreementState,
  totalAmount,
  releasedAmount,
  refundedAmount,
  onRefresh,
  refreshing,
}: WorkspaceHeaderProps) {
  const chainId = useChainId();
  const explorerUrl = explorerAddressUrl(chainId, contractAddress);
  const stateLabel = agreementState !== undefined ? agreementLabel(agreementState) : null;
  const stateSlug = stateLabel ? stateLabel.toLowerCase() : "";
  const tmpl = serviceTemplate ? templateLabel(serviceTemplate) : null;
  const title = projectTitle?.trim() || "Untitled agreement";
  const summary = roleSummary(role, agreementState);
  const progress = computeProgress(totalAmount, releasedAmount, refundedAmount);
  const roleSlug = role === "other" ? "viewer" : role;
  const short = `${contractAddress.slice(0, 6)}…${contractAddress.slice(-4)}`;
  const network = isSepoliaChain(chainId) ? "Sepolia" : chainName(chainId);

  return (
    <header
      className={`workspace-hero workspace-hero--${roleSlug} anim-fade-rise`}
      aria-label={`Active agreement: ${title}`}
    >
      <div className="workspace-hero-rail" aria-hidden />

      <div className="workspace-hero-body">
        <div className="workspace-hero-head">
          <div className="workspace-hero-meta">
            {tmpl && <span className="workspace-hero-meta-item">{tmpl}</span>}
            {tmpl && <span className="workspace-hero-meta-sep" aria-hidden />}
            <span className="workspace-hero-meta-item workspace-hero-meta-item--muted">
              {network}
            </span>
          </div>
          {stateLabel && (
            <span className={`state-pill state-pill--lg state-pill--${stateSlug}`}>
              {stateLabel}
            </span>
          )}
        </div>

        <h1 className="workspace-hero-title">{title}</h1>

        <p className="workspace-hero-summary">
          <span className={`workspace-hero-rolechip workspace-hero-rolechip--${roleSlug}`}>
            <span className="workspace-hero-rolechip-dot" aria-hidden />
            {roleLabel(role)}
          </span>
          <span className="workspace-hero-summary-text">{summary}</span>
        </p>

        <div className="workspace-hero-foot">
          <div className="workspace-hero-contract" title={contractAddress}>
            <span className="workspace-hero-contract-label">Contract</span>
            <code className="workspace-hero-contract-code">{short}</code>
            <CopyButton text={contractAddress} label="Copy" className="btn-xs" />
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="workspace-hero-contract-link"
              >
                Etherscan ↗
              </a>
            )}
          </div>

          {progress && (
            <div className="workspace-hero-progress" aria-label={`Resolved ${progress.percent.toFixed(0)}%`}>
              <div className="workspace-hero-progress-track">
                <div
                  className="workspace-hero-progress-fill"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <span className="workspace-hero-progress-label mono">
                {progress.percent.toFixed(0)}% · {formatEth(progress.resolved)}/{formatEth(progress.total)} ETH
              </span>
            </div>
          )}

          {onRefresh && (
            <button
              type="button"
              className="btn btn-ghost btn-sm workspace-hero-refresh"
              onClick={() => void onRefresh()}
              disabled={refreshing}
              title="Refresh contract data"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

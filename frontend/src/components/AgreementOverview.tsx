import { useChainId } from "wagmi";
import { type Address } from "viem";
import { formatEth, shortAddress, type Role } from "../types.ts";
import { explorerAddressUrl } from "../network.ts";
import CopyButton from "./ui/CopyButton.tsx";

interface Props {
  viewerRole: Role;
  clientAddr?: Address;
  providerAddr?: Address;
  totalAmount?: bigint;
  fundedAmount?: bigint;
  releasedAmount?: bigint;
  refundedAmount?: bigint;
  balance?: bigint;
}

function PartyCard({
  label,
  addr,
  chainId,
  highlight,
  tone,
}: {
  label: string;
  addr?: Address;
  chainId: number;
  highlight: boolean;
  tone: "client" | "provider";
}) {
  const url = addr ? explorerAddressUrl(chainId, addr) : null;
  const dotColor = tone === "client" ? "var(--client)" : "var(--provider)";
  return (
    <div className={`party-card ${highlight ? "party-card--highlight" : ""}`}>
      <div className="party-card-label">
        <span className="party-card-label-icon" style={{ background: dotColor }} aria-hidden />
        {label}
      </div>
      {addr ? (
        <div className="party-card-body">
          <span className="party-card-addr">{shortAddress(addr)}</span>
          <div className="party-card-actions">
            <CopyButton text={addr} label="Copy" className="btn-xs" />
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-xs"
              >
                Explorer ↗
              </a>
            )}
          </div>
        </div>
      ) : (
        <span className="text-muted text-small">Not set</span>
      )}
    </div>
  );
}

export default function AgreementOverview({
  viewerRole,
  clientAddr,
  providerAddr,
  totalAmount,
  fundedAmount,
  releasedAmount,
  refundedAmount,
  balance,
}: Props) {
  const chainId = useChainId();

  return (
    <section
      id="dealock-overview"
      className="surface-card surface-card--pad overview-root anim-fade-rise"
    >
      <div className="section-header">
        <h2 className="section-header-title">Overview</h2>
        <span className="section-header-desc">Parties and money in escrow</span>
      </div>

      <div className="overview-parties">
        <PartyCard
          label="Client"
          addr={clientAddr}
          chainId={chainId}
          highlight={viewerRole === "client"}
          tone="client"
        />
        <PartyCard
          label="Provider"
          addr={providerAddr}
          chainId={chainId}
          highlight={viewerRole === "provider"}
          tone="provider"
        />
      </div>

      <div className="overview-metrics">
        <div className="metric-tile">
          <span className="metric-label">Total</span>
          <span className="metric-value">
            {totalAmount !== undefined ? `${formatEth(totalAmount)} ETH` : "—"}
          </span>
        </div>
        <div className="metric-tile">
          <span className="metric-label">Funded</span>
          <span className="metric-value">
            {fundedAmount !== undefined ? `${formatEth(fundedAmount)} ETH` : "—"}
          </span>
        </div>
        <div className="metric-tile">
          <span className="metric-label">Released</span>
          <span className="metric-value">
            {releasedAmount !== undefined ? `${formatEth(releasedAmount)} ETH` : "—"}
          </span>
        </div>
        <div className="metric-tile">
          <span className="metric-label">Refunded</span>
          <span className="metric-value">
            {refundedAmount !== undefined ? `${formatEth(refundedAmount)} ETH` : "—"}
          </span>
        </div>
        <div className="metric-tile metric-tile--wide">
          <span className="metric-label">In escrow right now</span>
          <span className="metric-value">
            {balance !== undefined ? `${formatEth(balance)} ETH` : "—"}
          </span>
        </div>
      </div>
    </section>
  );
}

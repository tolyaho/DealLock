import { useChainId } from "wagmi";
import { type Address } from "viem";
import { formatEth, shortAddress, agreementLabel } from "../types.ts";
import { explorerAddressUrl } from "../network.ts";

interface Props {
  clientAddr?: Address;
  providerAddr?: Address;
  totalAmount?: bigint;
  fundedAmount?: bigint;
  releasedAmount?: bigint;
  refundedAmount?: bigint;
  agreementState?: number;
  balance?: bigint;
  projectTitle?: string;
  contractAddress?: Address;
}

function CopyBtn({ text }: { text: string }) {
  return (
    <button
      type="button"
      className="btn-icon"
      title="Copy"
      onClick={() => navigator.clipboard.writeText(text)}
    >
      Copy
    </button>
  );
}

function AddressCell({
  label,
  addr,
  chainId,
}: {
  label: string;
  addr?: Address;
  chainId: number;
}) {
  const url = addr ? explorerAddressUrl(chainId, addr) : null;
  return (
    <div className="overview-item">
      <div className="label">{label}</div>
      <div className="value address-value">
        {addr ? (
          <>
            <span>{shortAddress(addr)}</span>
            <CopyBtn text={addr} />
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn-icon">
                ↗
              </a>
            )}
          </>
        ) : (
          "—"
        )}
      </div>
    </div>
  );
}

export default function AgreementOverview({
  clientAddr,
  providerAddr,
  totalAmount,
  fundedAmount,
  releasedAmount,
  refundedAmount,
  agreementState,
  balance,
  projectTitle,
  contractAddress,
}: Props) {
  const chainId = useChainId();
  const stateLabel = agreementState !== undefined ? agreementLabel(agreementState) : "—";
  const badgeClass = `badge badge-lg badge-${stateLabel.toLowerCase()}`;
  const contractUrl = contractAddress ? explorerAddressUrl(chainId, contractAddress) : null;

  return (
    <section className="card">
      <div className="card-header">
        <span className="card-title">Agreement Overview</span>
        {agreementState !== undefined && (
          <span className={badgeClass}>{stateLabel}</span>
        )}
      </div>
      {projectTitle && <p className="overview-project-title">{projectTitle}</p>}

      {contractAddress && (
        <div className="overview-contract-row">
          <span
            className="text-muted text-xs"
            style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}
          >
            Contract
          </span>
          <code className="mono-sm">{contractAddress}</code>
          <CopyBtn text={contractAddress} />
          {contractUrl && (
            <a href={contractUrl} target="_blank" rel="noopener noreferrer" className="btn-icon">
              Etherscan ↗
            </a>
          )}
        </div>
      )}

      <div className="overview-grid">
        <AddressCell label="Client" addr={clientAddr} chainId={chainId} />
        <AddressCell label="Provider" addr={providerAddr} chainId={chainId} />
        <div className="overview-item">
          <div className="label">Total</div>
          <div className="value">{totalAmount !== undefined ? `${formatEth(totalAmount)} ETH` : "—"}</div>
        </div>
        <div className="overview-item">
          <div className="label">Funded</div>
          <div className="value">{fundedAmount !== undefined ? `${formatEth(fundedAmount)} ETH` : "—"}</div>
        </div>
        <div className="overview-item">
          <div className="label">Released</div>
          <div className="value">{releasedAmount !== undefined ? `${formatEth(releasedAmount)} ETH` : "—"}</div>
        </div>
        <div className="overview-item">
          <div className="label">Refunded</div>
          <div className="value">{refundedAmount !== undefined ? `${formatEth(refundedAmount)} ETH` : "—"}</div>
        </div>
        <div className="overview-item">
          <div className="label">Balance</div>
          <div className="value">{balance !== undefined ? `${formatEth(balance)} ETH` : "—"}</div>
        </div>
      </div>
    </section>
  );
}

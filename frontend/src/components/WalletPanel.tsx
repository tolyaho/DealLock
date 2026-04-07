import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";
import { injected } from "wagmi/connectors";
import { type Role, shortAddress } from "../types.ts";
import {
  chainName,
  isSupportedChain,
  isSepoliaChain,
  switchToSepolia,
  explorerAddressUrl,
} from "../network.ts";

export default function WalletPanel({ role }: { role: Role }) {
  const { address, isConnected } = useAccount();
  const { connectAsync, error: connectError, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const [switching, setSwitching] = useState(false);
  const [manualConnectError, setManualConnectError] = useState<string | null>(null);

  const supported = isSupportedChain(chainId);
  const onSepolia = isSepoliaChain(chainId);

  async function handleSwitch() {
    setSwitching(true);
    await switchToSepolia();
    setSwitching(false);
  }

  function copyAddr() {
    if (address) navigator.clipboard.writeText(address);
  }

  function formatConnectError(err: unknown): string {
    if (!err) return "Unknown wallet error.";
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message;
    if (typeof err === "object") {
      const rec = err as Record<string, unknown>;
      const candidates = [rec.shortMessage, rec.message, rec.details, rec.reason];
      for (const c of candidates) {
        if (typeof c === "string" && c.trim().length > 0) return c;
      }
      try {
        return JSON.stringify(err);
      } catch {
        return "Wallet error (unable to format details).";
      }
    }
    return String(err);
  }

  async function handleConnectWallet() {
    setManualConnectError(null);
    try {
      const hasInjectedProvider =
        typeof window !== "undefined" && !!(window as Window & { ethereum?: unknown }).ethereum;
      if (!hasInjectedProvider) {
        setManualConnectError(
          "No injected wallet found. Install MetaMask and refresh this page."
        );
        return;
      }
      await connectAsync({ connector: injected() });
    } catch (err) {
      const msg = formatConnectError(err);
      setManualConnectError(msg.slice(0, 220));
    }
  }

  const addrExplorerUrl = address ? explorerAddressUrl(chainId, address) : null;

  return (
    <section className="card wallet-panel">
      {isConnected && address ? (
        <>
          <div className="wallet-info">
            <div className="wallet-avatar">{address.slice(2, 4).toUpperCase()}</div>
            <span className="wallet-addr">{shortAddress(address)}</span>
            <button type="button" className="btn-icon" title="Copy address" onClick={copyAddr}>
              Copy
            </button>
            {addrExplorerUrl && (
              <a
                href={addrExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-icon"
              >
                Etherscan ↗
              </a>
            )}
            <span
              className={`badge ${onSepolia ? "badge-sepolia" : supported ? "badge-hardhat-chain" : "badge-wrong"}`}
            >
              {chainName(chainId)}
            </span>
            {role !== "other" && <span className={`badge badge-${role}`}>{role}</span>}
          </div>
          <div className="wallet-actions">
            {!onSepolia && (
              <button
                className="btn btn-warning btn-sm"
                onClick={handleSwitch}
                disabled={switching}
              >
                {switching ? "Switching…" : "Switch to Sepolia"}
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => disconnect()}>
              Disconnect
            </button>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">🔗</div>
          <div className="empty-state-title">Wallet not connected</div>
          <p className="empty-state-text">Connect your wallet to create or interact with agreements.</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: "1rem" }}
            onClick={handleConnectWallet}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting…" : "Connect Wallet"}
          </button>
          {(manualConnectError || connectError) && (
            <div
              className="banner banner-error"
              style={{ marginTop: "0.75rem", textAlign: "left" }}
            >
              <strong>Connection failed.</strong>{" "}
              {(manualConnectError ?? connectError?.message ?? "Unknown error").slice(0, 260)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

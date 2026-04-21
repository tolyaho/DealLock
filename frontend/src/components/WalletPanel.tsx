import { useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";

export default function WalletPanel() {
  const { isConnected } = useAccount();
  const { connectAsync, error: connectError, isPending: isConnecting } = useConnect();
  const [manualConnectError, setManualConnectError] = useState<string | null>(null);

  if (isConnected) return null;

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
          "No injected wallet detected. Install MetaMask (or compatible) and refresh.",
        );
        return;
      }
      await connectAsync({ connector: injected() });
    } catch (err) {
      setManualConnectError(formatConnectError(err).slice(0, 220));
    }
  }

  return (
    <section className="surface-card surface-card--pad wallet-panel-card anim-fade-rise">
      <div className="wallet-empty">
        <div className="wallet-empty-icon" aria-hidden>
          ◈
        </div>
        <h3 className="wallet-empty-title">Connect your wallet</h3>
        <p className="wallet-empty-text">
          Create agreements, fund escrow, and sign milestones. Uses Sepolia test ETH only — your
          keys stay in the wallet, nothing leaves your browser except RPC calls you approve.
        </p>
        <button className="btn btn-primary btn-lg" onClick={handleConnectWallet} disabled={isConnecting}>
          {isConnecting ? "Connecting…" : "Connect wallet"}
        </button>
        <div className="wallet-empty-trust">
          <span className="chip">
            <span className="chip-dot" aria-hidden /> No custody
          </span>
          <span className="chip">
            <span className="chip-dot" aria-hidden /> Client-only
          </span>
          <span className="chip">
            <span className="chip-dot" aria-hidden /> Sepolia test ETH
          </span>
        </div>
        {(manualConnectError || connectError) && (
          <div className="banner banner-error banner--inline">
            <strong>Connection failed.</strong>{" "}
            {(manualConnectError ?? connectError?.message ?? "Unknown error").slice(0, 260)}
          </div>
        )}
      </div>
    </section>
  );
}

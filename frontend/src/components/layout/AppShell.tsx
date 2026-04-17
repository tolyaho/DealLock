import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";
import { injected } from "wagmi/connectors";
import { shortAddress } from "../../types.ts";
import { chainName, isSupportedChain, isSepoliaChain, switchToSepolia } from "../../network.ts";

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const [switching, setSwitching] = useState(false);

  const sepolia = isSepoliaChain(chainId);
  const supported = isSupportedChain(chainId);

  async function handleSepolia() {
    setSwitching(true);
    await switchToSepolia();
    setSwitching(false);
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-topbar-inner">
          <div className="app-topbar-left">
            <Link to="/" className="app-topbar-brand" aria-label="DealLock home">
              <span className="app-topbar-logo-mark" aria-hidden />
              <span className="app-topbar-brand-text">
                <span className="app-topbar-logo-name">DealLock</span>
                <span className="app-topbar-logo-sub">Milestone escrow</span>
              </span>
            </Link>
            <span className="app-topbar-divider" aria-hidden />
            <span className="app-topbar-env" title={`Connected chain: ${chainName(chainId)}`}>
              <span
                className="app-topbar-env-dot"
                data-state={sepolia ? "ok" : supported ? "local" : "bad"}
                aria-hidden
              />
              <span className="app-topbar-env-label">{chainName(chainId)}</span>
            </span>
          </div>
          <div className="app-topbar-right">
            {!sepolia && isConnected && (
              <button
                type="button"
                className="btn btn-warning btn-sm"
                onClick={handleSepolia}
                disabled={switching}
                title="Switch MetaMask to Sepolia"
              >
                {switching ? "Switching…" : "Use Sepolia"}
              </button>
            )}
            {isConnected && address ? (
              <div className="app-topbar-wallet" title={address}>
                <span className="app-topbar-wallet-avatar" aria-hidden>
                  {address.slice(2, 4).toUpperCase()}
                </span>
                <span className="app-topbar-addr">{shortAddress(address)}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => disconnect()}
                  aria-label="Disconnect wallet"
                  title="Disconnect"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => connect({ connector: injected() })}
              >
                Connect wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="app-content">{children}</main>
    </div>
  );
}

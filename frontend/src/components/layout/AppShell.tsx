import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";
import { injected } from "wagmi/connectors";
import { shortAddress } from "../../types.ts";
import { chainName, isSupportedChain, isSepoliaChain } from "../../network.ts";

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();

  const networkBadgeClass = isSepoliaChain(chainId)
    ? "badge badge-sepolia"
    : isSupportedChain(chainId)
      ? "badge badge-hardhat-chain"
      : "badge badge-wrong";

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-topbar-inner">
          <div className="app-topbar-left">
            <Link to="/" className="app-topbar-logo">
              <span className="app-topbar-logo-icon">D</span>
              DealLock
            </Link>
            <div className="app-topbar-sep" />
            <span className="app-topbar-page">Dashboard</span>
          </div>
          <div className="app-topbar-right">
            {isConnected && address ? (
              <div className="app-topbar-wallet">
                <span className={networkBadgeClass}>{chainName(chainId)}</span>
                <span className="app-topbar-addr">{shortAddress(address)}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => disconnect()}>
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => connect({ connector: injected() })}
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="app-content">{children}</main>
    </div>
  );
}

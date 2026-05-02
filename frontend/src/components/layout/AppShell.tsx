import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount, useConnect, useDisconnect, useChainId, useSignMessage } from "wagmi";
import { injected } from "wagmi/connectors";
import { shortAddress } from "../../types.ts";
import { chainName, isSupportedChain, isSepoliaChain, switchToSepolia } from "../../network.ts";
import { useAccountSession } from "../../account/useAccountSession.ts";
import { ApiError } from "../../api/client.ts";
import LinkedWalletsPanel from "../dashboard/LinkedWalletsPanel.tsx";
import EmailSettingsPanel from "../dashboard/EmailSettingsPanel.tsx";

/** Testnet beta banner — always visible at the top of the app. */
function BetaBanner() {
  return (
    <div
      style={{
        background: "var(--color-warning-bg, #fffbeb)",
        borderBottom: "1px solid var(--color-warning-border, #fcd34d)",
        padding: "6px 16px",
        fontSize: "0.78rem",
        color: "var(--color-warning-text, #92400e)",
        textAlign: "center",
      }}
    >
      <strong>Testnet Beta</strong> — DealLock runs on Sepolia testnet. Use test ETH only. Not
      production-ready.
    </div>
  );
}

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const [switching, setSwitching] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [walletsOpen, setWalletsOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(() =>
    new URLSearchParams(window.location.search).has("verifyEmail"),
  );

  const { sessionStatus, wallets, signIn, signOut } = useAccountSession();

  const sepolia = isSepoliaChain(chainId);
  const supported = isSupportedChain(chainId);

  async function handleSepolia() {
    setSwitching(true);
    await switchToSepolia();
    setSwitching(false);
  }

  async function handleSignIn() {
    if (!address) return;
    setSigningIn(true);
    setSignInError(null);
    try {
      await signIn(address, chainId, (msg) => signMessageAsync({ message: msg }));
    } catch (err) {
      setSignInError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Sign-in failed",
      );
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    setWalletsOpen(false);
    setEmailOpen(false);
    await signOut();
  }

  return (
    <div className="app-shell">
      <BetaBanner />
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

            {/* Session controls */}
            {isConnected && address && sessionStatus === "signed-out" && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleSignIn}
                disabled={signingIn}
                title="Sign in to sync agreements across wallets and devices"
              >
                {signingIn ? "Signing…" : "Sign in"}
              </button>
            )}

            {sessionStatus === "signed-in" && (
              <div className="session-status" style={{ position: "relative" }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm session-status-btn"
                  onClick={() => {
                    setWalletsOpen((o) => !o);
                    setEmailOpen(false);
                  }}
                  title="Manage linked wallets"
                >
                  <span className="session-dot session-dot--active" aria-hidden />
                  <span>
                    {wallets.length} wallet{wallets.length !== 1 ? "s" : ""}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm session-status-btn"
                  onClick={() => {
                    setEmailOpen((o) => !o);
                    setWalletsOpen(false);
                  }}
                  title="Manage email and notifications"
                >
                  Email
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={handleSignOut}
                  title="Sign out of DealLock account"
                >
                  Sign out
                </button>
                {walletsOpen && (
                  <div className="linked-wallets-dropdown">
                    <LinkedWalletsPanel onClose={() => setWalletsOpen(false)} />
                  </div>
                )}
                {emailOpen && (
                  <div className="linked-wallets-dropdown email-settings-dropdown">
                    <EmailSettingsPanel onClose={() => setEmailOpen(false)} />
                  </div>
                )}
              </div>
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
        {signInError && (
          <div className="topbar-error" role="alert">
            {signInError}
          </div>
        )}
      </header>

      <main className="app-content">{children}</main>
    </div>
  );
}

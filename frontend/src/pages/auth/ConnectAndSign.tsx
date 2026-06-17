/*
 * ConnectAndSign — the shared wallet step both auth pages use: it shows the
 * "Connect wallet" CTA, then (once connected) a small connected-wallet row plus
 * the "Sign message" CTA. It deliberately stops at the signature — the parent
 * page decides what happens once a session exists (login continues to the
 * dashboard; signup advances to the email step).
 *
 * Loading uses a disabled button with a working label + a quiet metallic sweep
 * (no spinner), per the DealLock motion language. Buttons disable while pending.
 */
import { Button } from "../../components/app";
import { StatusChip } from "../../components/app";
import { IconCheck, IconLock, IconWallet } from "../../components/app/icons";
import { useWalletAuth } from "../../auth/useWalletAuth";

export function shortAddress(address?: string): string {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
}

/** The connected-wallet identity row — an orb, the truncated address, a chip. */
export function WalletRow({
  address,
  tone = "secure",
  label = "Connected",
}: {
  address?: string;
  tone?: "secure" | "review" | "neutral";
  label?: string;
}) {
  return (
    <div className="dl-auth__wallet">
      <span className="dl-auth__wallet-orb" aria-hidden="true">
        {tone === "secure" ? <IconCheck /> : <IconWallet />}
      </span>
      <span className="dl-auth__wallet-addr" title={address}>
        {shortAddress(address)}
      </span>
      <StatusChip tone={tone}>{label}</StatusChip>
    </div>
  );
}

export function ConnectAndSign({ signLabel = "Sign message" }: { signLabel?: string }) {
  const { address, isConnected, connecting, signing, error, hasInjected, connect, sign } = useWalletAuth();

  return (
    <div className="dl-auth__steps">
      <span className="dl-auth__eyebrow">Wallet-first sign in</span>

      {isConnected && <WalletRow address={address} tone="neutral" label="Wallet connected" />}

      {!isConnected ? (
        <Button
          block
          variant="primary"
          icon={<IconWallet />}
          disabled={connecting}
          className={connecting ? "is-working" : undefined}
          onClick={() => void connect()}
        >
          {connecting ? "Opening wallet…" : "Continue with wallet"}
        </Button>
      ) : (
        <Button
          block
          variant="metal"
          icon={<IconLock />}
          disabled={signing}
          className={signing ? "is-working" : undefined}
          onClick={() => void sign()}
        >
          {signing ? "Waiting for signature…" : signLabel}
        </Button>
      )}

      {!isConnected && !hasInjected && (
        <p className="dl-auth__hint">
          No browser wallet detected. Install MetaMask or another injected wallet to continue.
        </p>
      )}
      {error && (
        <p className="dl-auth__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

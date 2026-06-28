/*
 * Display helpers for the authenticated user — one place that decides how a name
 * and avatar monogram are derived, with graceful fallbacks for accounts that
 * haven't set a name yet (so the avatar is never blank).
 */
import type { SessionUser, WalletRecord } from "./api";

function primaryAddress(wallets: WalletRecord[]): string | undefined {
  return (wallets.find((w) => w.isPrimary) ?? wallets[0])?.address;
}

/** "First Last" when a name is set, else the truncated primary wallet, else "". */
export function displayName(user: SessionUser | null, wallets: WalletRecord[] = []): string {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  const addr = primaryAddress(wallets);
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

/** Up-to-two-letter avatar monogram: name initials → wallet hex → "?". */
export function initialsFor(user: SessionUser | null, wallets: WalletRecord[] = []): string {
  const f = (user?.firstName ?? "").trim();
  const l = (user?.lastName ?? "").trim();
  if (f || l) {
    const monogram = `${f.charAt(0)}${l.charAt(0)}` || f.charAt(0) || l.charAt(0);
    return monogram.toUpperCase();
  }
  const addr = primaryAddress(wallets);
  return addr ? addr.slice(2, 4).toUpperCase() : "?";
}

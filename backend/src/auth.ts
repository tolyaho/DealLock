export function buildSigninMessage(opts: {
  address: string;
  chainId: number;
  nonce: string;
  now: Date;
  expiresAt: Date;
}): string {
  return [
    "Sign in to DealLock",
    "",
    "This signature proves that you control this wallet.",
    "It does not trigger a blockchain transaction and does not cost gas.",
    "",
    `Wallet: ${opts.address}`,
    `Chain ID: ${opts.chainId}`,
    `Purpose: signin`,
    `Nonce: ${opts.nonce}`,
    `Issued At: ${opts.now.toISOString()}`,
    `Expires At: ${opts.expiresAt.toISOString()}`,
  ].join("\n");
}

export function buildLinkWalletMessage(opts: {
  address: string;
  chainId: number;
  nonce: string;
  now: Date;
  expiresAt: Date;
}): string {
  return [
    "Link wallet to DealLock account",
    "",
    "This signature links this wallet to your currently signed-in DealLock account.",
    "It does not trigger a blockchain transaction and does not cost gas.",
    "",
    `Wallet: ${opts.address}`,
    `Chain ID: ${opts.chainId}`,
    `Purpose: link_wallet`,
    `Nonce: ${opts.nonce}`,
    `Issued At: ${opts.now.toISOString()}`,
    `Expires At: ${opts.expiresAt.toISOString()}`,
  ].join("\n");
}

export const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes

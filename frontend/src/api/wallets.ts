import { apiFetch } from "./client.ts";
import type { LinkedWallet } from "./auth.ts";

export type { LinkedWallet };

export async function getWallets(): Promise<{ wallets: LinkedWallet[] }> {
  return apiFetch("/wallets");
}

export async function fetchLinkNonce(
  address: string,
  chainId: number,
): Promise<{ message: string; nonceId: string; alreadyLinked?: boolean }> {
  return apiFetch("/wallets/link/nonce", {
    method: "POST",
    body: JSON.stringify({ address, chainId }),
  });
}

export async function verifyLinkWallet(
  address: string,
  nonceId: string,
  signature: string,
  label?: string,
): Promise<{ wallets: LinkedWallet[] }> {
  return apiFetch("/wallets/link/verify", {
    method: "POST",
    body: JSON.stringify({ address, nonceId, signature, label }),
  });
}

export async function updateWallet(
  address: string,
  updates: { label?: string; isPrimary?: boolean },
): Promise<{ wallets: LinkedWallet[] }> {
  return apiFetch(`/wallets/${address}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function removeWallet(address: string): Promise<{ wallets: LinkedWallet[] }> {
  return apiFetch(`/wallets/${address}`, { method: "DELETE" });
}

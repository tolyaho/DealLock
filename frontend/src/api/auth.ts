import { apiFetch } from "./client.ts";

export interface LinkedWallet {
  id: string;
  address: string;
  label: string;
  isPrimary: boolean;
}

export interface SessionUser {
  id: string;
  email: string | null;
  emailVerifiedAt: string | null;
}

export async function fetchSignInNonce(
  address: string,
  chainId: number,
): Promise<{ message: string; nonceId: string }> {
  return apiFetch("/auth/nonce", {
    method: "POST",
    body: JSON.stringify({ address, chainId }),
  });
}

export async function verifySignIn(
  address: string,
  nonceId: string,
  signature: string,
): Promise<{ user: SessionUser; wallets: LinkedWallet[] }> {
  return apiFetch("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ address, nonceId, signature }),
  });
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

export async function getMe(): Promise<{ user: SessionUser; wallets: LinkedWallet[] }> {
  return apiFetch("/me");
}

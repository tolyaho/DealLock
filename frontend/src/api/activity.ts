import { apiFetch } from "./client.ts";

export interface ActivityEvent {
  id: string;
  eventName: string;
  itemType: string | null;
  itemId: number | null;
  actorAddress: string | null;
  counterpartyAddress: string | null;
  amountWei: string | null;
  amountRaw: string | null;
  paymentTokenAddress: string | null;
  paymentSymbol: string | null;
  paymentDecimals: number | null;
  txHash: string;
  blockNumber: string;
  occurredAt: string;
  payload: unknown;
}

export async function getAgreementActivity(
  contractAddress: string,
  chainId: number,
  cursor?: string,
): Promise<{ events: ActivityEvent[]; nextCursor?: string }> {
  const params = new URLSearchParams({ chainId: String(chainId), limit: "50" });
  if (cursor) params.set("cursor", cursor);
  return apiFetch(`/agreements/${contractAddress}/activity?${params.toString()}`);
}

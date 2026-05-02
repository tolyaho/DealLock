import type { PublicClient } from "viem";

const cache = new Map<string, Date>();

export async function blockTimestamp(
  client: PublicClient,
  chainId: number,
  blockNumber: bigint,
): Promise<Date> {
  const key = `${chainId}:${blockNumber.toString()}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const block = await client.getBlock({ blockNumber });
  const occurredAt = new Date(Number(block.timestamp) * 1000);
  cache.set(key, occurredAt);
  return occurredAt;
}

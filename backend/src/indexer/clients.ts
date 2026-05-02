import { createPublicClient, http, type PublicClient } from "viem";
import { hardhat, sepolia } from "viem/chains";
import type { IndexerConfig } from "./config.js";

const clients = new Map<number, PublicClient>();

export function publicClientForChain(chainId: number, config: IndexerConfig): PublicClient | null {
  const cached = clients.get(chainId);
  if (cached) return cached;

  const rpcUrl = config.rpcUrls.get(chainId);
  if (!rpcUrl) return null;

  const chain = chainId === sepolia.id ? sepolia : chainId === hardhat.id ? hardhat : null;
  if (!chain) return null;

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  }) as PublicClient;
  clients.set(chainId, client);
  return client;
}

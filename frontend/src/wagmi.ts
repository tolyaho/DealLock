import { http, createConfig } from "wagmi";
import { sepolia, hardhat } from "wagmi/chains";

const sepoliaRpc =
  (import.meta.env.VITE_SEPOLIA_RPC_URL as string | undefined) || undefined;

function hardhatRpcUrl(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:8545";
  if (import.meta.env.DEV) return `${window.location.origin}/rpc-hardhat`;
  return "http://127.0.0.1:8545";
}

/**
 * Sepolia-first: listed first so wagmi treats it as the default chain.
 * Hardhat stays available for local development but is secondary.
 */
export const config = createConfig({
  chains: [sepolia, hardhat],
  transports: {
    [sepolia.id]: http(sepoliaRpc),
    [hardhat.id]: http(hardhatRpcUrl()),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}

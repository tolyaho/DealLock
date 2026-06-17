/*
 * wagmi configuration — DealLock is wallet-first, and the wallet scope is
 * deliberately INJECTED ONLY (MetaMask / Rabby / Coinbase extension and other
 * EIP-1193 `window.ethereum` providers). No WalletConnect / projectId, no UI kit
 * — that can be layered on later without reworking the sign-in flow.
 *
 * `multiInjectedProviderDiscovery: false` keeps the connector list to the single
 * injected connector instead of fanning out one per discovered EIP-6963 wallet,
 * which matches the "one Connect wallet button" flow on the auth pages.
 *
 * Sepolia is the only chain — the backend signs a plain SIWE message and verifies
 * the signature, so the chain id is informational; we pass the wallet's current
 * chain through to /auth/nonce.
 */
import { http, createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const sepoliaRpc = import.meta.env.VITE_SEPOLIA_RPC_URL as string | undefined;

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  multiInjectedProviderDiscovery: false,
  transports: {
    [sepolia.id]: http(sepoliaRpc || undefined),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

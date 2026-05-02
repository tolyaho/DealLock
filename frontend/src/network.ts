import { sepolia, hardhat } from "wagmi/chains";

export const SEPOLIA_CHAIN_ID = sepolia.id;
export const HARDHAT_CHAIN_ID = hardhat.id;

export const SEPOLIA_EXPLORER = (
  import.meta.env.VITE_SEPOLIA_EXPLORER as string | undefined
) || "https://sepolia.etherscan.io";

export const SUPPORTED_CHAIN_IDS = [SEPOLIA_CHAIN_ID, HARDHAT_CHAIN_ID] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

export function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return (SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);
}

export function isSepoliaChain(chainId: number): boolean {
  return chainId === SEPOLIA_CHAIN_ID;
}

export function chainName(chainId: number): string {
  if (chainId === SEPOLIA_CHAIN_ID) return "Sepolia";
  if (chainId === HARDHAT_CHAIN_ID) return "Hardhat Local";
  return `Unknown (${chainId})`;
}

function explorerBase(chainId: number): string | null {
  if (chainId === SEPOLIA_CHAIN_ID) return SEPOLIA_EXPLORER;
  return null;
}

export function explorerTxUrl(chainId: number, hash: string): string | null {
  const base = explorerBase(chainId);
  return base ? `${base}/tx/${hash}` : null;
}

export function explorerAddressUrl(chainId: number, address: string): string | null {
  const base = explorerBase(chainId);
  return base ? `${base}/address/${address}` : null;
}

export function explorerContractUrl(chainId: number, address: string): string | null {
  return explorerAddressUrl(chainId, address);
}

/**
 * Converts raw wallet/contract errors into concise user-readable messages.
 * Handles the most common failure modes: user rejection, gas shortfall,
 * ERC-20 allowance, wrong network, contract reverts, and RPC failures.
 */
export function humanizeContractError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes("user rejected") || lower.includes("userejectedrequesterror") || lower.includes("eth_requestaccounts") && lower.includes("denied")) {
    return "Transaction rejected. You cancelled the request in your wallet.";
  }
  if (lower.includes("insufficient funds for gas") || lower.includes("insufficient balance for gas") || (lower.includes("insufficient funds") && !lower.includes("allowance"))) {
    return "Insufficient ETH for gas. Add ETH to your wallet and try again.";
  }
  if (lower.includes("insufficient allowance") || lower.includes("erc20: insufficient allowance")) {
    return "Insufficient token allowance. Approve the required amount first, then fund.";
  }
  if (lower.includes("wrong network") || lower.includes("chain mismatch")) {
    return "Wrong network. Switch your wallet to Sepolia (or Hardhat for local dev).";
  }
  if (lower.includes("factory v2") || lower.includes("vite_deallock_factory_v2")) {
    return raw.slice(0, 300);
  }
  if (lower.includes("erc-20 agreements require")) {
    return raw.slice(0, 300);
  }
  // Extract revert reason when present.
  const revertMatch = raw.match(/execution reverted:?\s*(?:Error\()?["']?([^"'\n]+?)["']?\)?(?:\s|$)/i);
  if (revertMatch) {
    return `Transaction reverted: ${revertMatch[1]!.trim()}`;
  }
  if (lower.includes("execution reverted")) {
    return "Transaction reverted by the contract. Check the contract state and try again.";
  }
  if (lower.includes("could not connect") || lower.includes("econnrefused") || lower.includes("failed to fetch") || lower.includes("network error")) {
    return "Network error. Check your RPC connection and try again.";
  }
  return raw.slice(0, 300);
}

export async function switchToSepolia(): Promise<boolean> {
  const provider = ((window as unknown) as Record<string, unknown>).ethereum as
    | { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
    | undefined;
  if (!provider) return false;

  const hexChainId = `0x${SEPOLIA_CHAIN_ID.toString(16)}`;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }],
    });
    return true;
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code === 4902) {
      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hexChainId,
              chainName: "Sepolia Testnet",
              nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://rpc.sepolia.org"],
              blockExplorerUrls: [SEPOLIA_EXPLORER],
            },
          ],
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

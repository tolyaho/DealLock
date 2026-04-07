import { sepolia, hardhat } from "wagmi/chains";

export const SEPOLIA_CHAIN_ID = sepolia.id; // 11155111
export const HARDHAT_CHAIN_ID = hardhat.id; // 31337

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
 * Asks MetaMask (or compatible wallet) to switch to Sepolia.
 * Falls back to wallet_addEthereumChain if the chain isn't configured.
 */
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

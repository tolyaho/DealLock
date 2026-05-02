import { type Address } from "viem";
import { DEALLOCK_V2_ABI } from "./contractV2.ts";

/**
 * 1 = original DealLock (no contractVersion function)
 * 2 = DealLockV2 (paid adjustments, no grace period)
 * 3 = DealLockV3 (paid adjustments + 24-second refund grace period)
 * 4 = DealLockV4 (+ review period, disputes, mutual settlement)
 * 5 = DealLockMultiAsset (V4 mechanics + ETH/ERC-20 payment asset)
 * 6 = DealLockMultiAssetV2 (V5 + 30-minute deadline grace + extension requests)
 */
export type ContractVersion = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Detect the deployed contract version.
 *
 * Detection strategy:
 *  - Call contractVersion() using the V2 ABI (V3 is a superset, same function name).
 *  - V1 contracts do not have contractVersion() — the call reverts → return 1.
 *  - V2 returns uint8(2), viem types this as number → Number(version) === 2.
 *  - V3 returns uint256(3), viem types this as bigint → Number(version) === 3.
 *  - V4 returns uint256(4), MultiAsset returns uint256(5), MultiAssetV2 returns uint256(6).
 *  - Unknown future version (> 6): treat as latest known (6) rather than silently
 *    downgrading, which would show wrong UI.
 */
export async function detectContractVersion(
  contractAddress: Address,
  chainId: number,
): Promise<ContractVersion> {
  try {
    const { getPublicClient } = await import("wagmi/actions");
    const { config } = await import("./wagmi.ts");
    const publicClient = getPublicClient(config, { chainId: chainId as 11155111 | 31337 });
    if (!publicClient) return 1;

    const raw = await publicClient.readContract({
      address: contractAddress,
      abi: DEALLOCK_V2_ABI,
      functionName: "contractVersion",
    });

    const v = Number(raw);
    if (v === 6) return 6;
    if (v === 5) return 5;
    if (v === 4) return 4;
    if (v === 3) return 3;
    if (v === 2) return 2;
    if (v > 6) return 6; // future unknown version — use latest known UI
    return 1;
  } catch {
    // Call reverted: contract is V1 (no contractVersion function)
    return 1;
  }
}

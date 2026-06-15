import { isAddress } from "viem";
import type { AgreementPaymentSnapshot, PaymentAsset } from "./types.js";

export const HARDHAT_CHAIN_ID = 31337;
export const SEPOLIA_CHAIN_ID = 11155111;
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function normalizeAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  if (!isAddress(address)) return null;
  const lowered = address.toLowerCase();
  return lowered === ZERO_ADDRESS ? null : lowered;
}

function asset(
  input: Omit<PaymentAsset, "address"> & { address?: string | null },
): PaymentAsset {
  return {
    ...input,
    address: normalizeAddress(input.address),
  };
}

export function paymentAssetRegistry(): PaymentAsset[] {
  const sepoliaUsdc = normalizeAddress(process.env.USDC_SEPOLIA_ADDRESS);
  const hardhatUsdc = normalizeAddress(process.env.USDC_HARDHAT_ADDRESS);

  return [
    asset({
      key: "sepolia-eth",
      chainId: SEPOLIA_CHAIN_ID,
      type: "native",
      symbol: "ETH",
      name: "Sepolia Ether",
      address: null,
      decimals: 18,
      iconKey: "eth",
      enabled: true,
      stablecoin: false,
      displayPriority: 10,
      explorerUrlPattern: "https://sepolia.etherscan.io/tx/{txHash}",
    }),
    asset({
      key: "hardhat-eth",
      chainId: HARDHAT_CHAIN_ID,
      type: "native",
      symbol: "ETH",
      name: "Hardhat Ether",
      address: null,
      decimals: 18,
      iconKey: "eth",
      enabled: true,
      stablecoin: false,
      displayPriority: 10,
    }),
    asset({
      key: "sepolia-usdc",
      chainId: SEPOLIA_CHAIN_ID,
      type: "erc20",
      symbol: "USDC",
      name: "USD Coin",
      address: sepoliaUsdc,
      decimals: 6,
      iconKey: "usdc",
      enabled: Boolean(sepoliaUsdc),
      stablecoin: true,
      displayPriority: 20,
      explorerUrlPattern: "https://sepolia.etherscan.io/token/{address}",
    }),
    asset({
      key: "hardhat-usdc",
      chainId: HARDHAT_CHAIN_ID,
      type: "erc20",
      symbol: "MockUSDC",
      name: "Mock USD Coin",
      address: hardhatUsdc,
      decimals: 6,
      iconKey: "usdc",
      enabled: Boolean(hardhatUsdc),
      stablecoin: true,
      displayPriority: 20,
    }),
  ];
}

export function listPaymentAssets(chainId?: number): PaymentAsset[] {
  return paymentAssetRegistry()
    .filter((asset) => asset.enabled)
    .filter((asset) => chainId === undefined || asset.chainId === chainId)
    .sort((a, b) => a.displayPriority - b.displayPriority || a.symbol.localeCompare(b.symbol));
}

export function getPaymentAssetByKey(chainId: number, key: string): PaymentAsset | null {
  return (
    listPaymentAssets(chainId).find(
      (asset) => asset.key === key && asset.chainId === chainId,
    ) ?? null
  );
}

export function getPaymentAssetByAddress(
  chainId: number,
  tokenAddress: string | null | undefined,
): PaymentAsset | null {
  const normalized = normalizeAddress(tokenAddress);
  return (
    listPaymentAssets(chainId).find((asset) => {
      if (normalized === null) return asset.type === "native";
      return asset.type === "erc20" && asset.address === normalized;
    }) ?? null
  );
}

export function isNativeAsset(asset: PaymentAsset): boolean {
  return asset.type === "native";
}

export function isSupportedAsset(chainId: number, tokenAddress: string | null | undefined): boolean {
  return getPaymentAssetByAddress(chainId, tokenAddress) !== null;
}

export function snapshotPaymentAsset(asset: PaymentAsset): AgreementPaymentSnapshot {
  return {
    paymentAssetKind: asset.type,
    paymentTokenAddress: asset.type === "native" ? null : asset.address,
    paymentSymbol: asset.symbol,
    paymentDecimals: asset.decimals,
  };
}

export function resolvePaymentAsset(input: {
  chainId: number;
  assetKey?: unknown;
  tokenAddress?: unknown;
}): PaymentAsset | null {
  if (typeof input.assetKey === "string" && input.assetKey.trim()) {
    return getPaymentAssetByKey(input.chainId, input.assetKey.trim());
  }

  if (typeof input.tokenAddress === "string") {
    const normalized = normalizeAddress(input.tokenAddress);
    return getPaymentAssetByAddress(input.chainId, normalized);
  }

  return getPaymentAssetByAddress(input.chainId, null);
}

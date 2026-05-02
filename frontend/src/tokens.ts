import { formatUnits, parseUnits, type Address } from "viem";

export type PaymentAsset = {
  kind: "native" | "erc20";
  chainId: number;
  address: Address | null;
  symbol: string;
  name: string;
  decimals: number;
  isDefault?: boolean;
};

const ETH_ASSETS: PaymentAsset[] = [
  { kind: "native", chainId: 11155111, address: null, symbol: "ETH", name: "Sepolia ETH", decimals: 18, isDefault: true },
  { kind: "native", chainId: 31337, address: null, symbol: "ETH", name: "Local ETH", decimals: 18, isDefault: true },
];

function envAddress(name: string): Address | null {
  const value = import.meta.env[name] as string | undefined;
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as Address) : null;
}

export function paymentAssetsForChain(chainId: number): PaymentAsset[] {
  const native = ETH_ASSETS.find((asset) => asset.chainId === chainId) ?? {
    kind: "native" as const,
    chainId,
    address: null,
    symbol: "ETH",
    name: "Native ETH",
    decimals: 18,
    isDefault: true,
  };
  const usdcAddress =
    chainId === 11155111
      ? envAddress("VITE_USDC_SEPOLIA_ADDRESS")
      : chainId === 31337
        ? envAddress("VITE_USDC_HARDHAT_ADDRESS")
        : null;
  return [
    native,
    ...(usdcAddress
      ? [{
          kind: "erc20" as const,
          chainId,
          address: usdcAddress,
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
        }]
      : []),
  ];
}

export function assetKey(asset: PaymentAsset): string {
  return asset.kind === "native" ? "native" : asset.address!.toLowerCase();
}

export function parseAssetAmount(input: string, asset: PaymentAsset): bigint {
  return parseUnits(input.trim(), asset.decimals);
}

export function formatAssetAmount(rawAmount: bigint, asset: PaymentAsset): string {
  const formatted = formatUnits(rawAmount, asset.decimals);
  const [whole, fraction = ""] = formatted.split(".");
  const trimmedFraction = fraction.replace(/0+$/, "").slice(0, asset.decimals === 6 ? 2 : 6);
  return `${trimmedFraction ? `${whole}.${trimmedFraction}` : whole} ${asset.symbol}`;
}

export function nativePaymentAsset(chainId: number): PaymentAsset {
  return paymentAssetsForChain(chainId)[0]!;
}

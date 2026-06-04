/* Display formatting helpers. Amounts are display-only — never used for math. */
import type { AssetSymbol, Money } from "./types";

const NF = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NF0 = new Intl.NumberFormat("en-US");

/** "$12,500.00" for USDC, "3.20 ETH" for ETH. */
export function formatMoney({ amount, asset }: Money): string {
  if (asset === "ETH") return `${NF.format(amount)} ETH`;
  return `$${NF.format(amount)}`;
}

/** Compact unit label shown beside a big number, e.g. "USDC" / "ETH". */
export function assetUnit(asset: AssetSymbol): string {
  return asset === "ETH" ? "ETH" : "USDC";
}

export function formatCount(n: number): string {
  return NF0.format(n);
}

/** Short wallet/contract address: 0x12ab…7f90 */
export function shortAddress(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

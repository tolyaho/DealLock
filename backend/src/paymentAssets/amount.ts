const DECIMAL_RE = /^(?:0|[1-9]\d*)(?:\.(\d+))?$/;

export function parseAssetAmount(value: string, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error("Invalid asset decimals");
  }
  const trimmed = value.trim();
  const match = DECIMAL_RE.exec(trimmed);
  if (!match) throw new Error("Invalid amount");

  const [wholeRaw, fractionRaw = ""] = trimmed.split(".");
  if (fractionRaw.length > decimals) {
    throw new Error(`Amount has more than ${decimals} decimal places`);
  }

  const whole = BigInt(wholeRaw);
  const fraction = fractionRaw.padEnd(decimals, "0");
  const base = whole * 10n ** BigInt(decimals) + BigInt(fraction || "0");
  if (base <= 0n) throw new Error("Amount must be greater than zero");
  return base.toString();
}

export function formatAssetAmount(baseUnits: string | bigint, decimals: number, symbol?: string): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error("Invalid asset decimals");
  }
  const raw = typeof baseUnits === "bigint" ? baseUnits : BigInt(baseUnits);
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const fraction = raw % scale;
  const fractionText =
    decimals === 0
      ? ""
      : fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  const formatted = fractionText ? `${whole}.${fractionText}` : whole.toString();
  return symbol ? `${formatted} ${symbol}` : formatted;
}

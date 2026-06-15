export type PaymentAssetType = "native" | "erc20";

export interface PaymentAsset {
  key: string;
  chainId: number;
  type: PaymentAssetType;
  symbol: string;
  name: string;
  address: string | null;
  decimals: number;
  iconKey?: string;
  iconUrl?: string;
  enabled: boolean;
  stablecoin: boolean;
  displayPriority: number;
  explorerUrlPattern?: string;
}

export interface AgreementPaymentSnapshot {
  paymentAssetKind: PaymentAssetType;
  paymentTokenAddress: string | null;
  paymentSymbol: string;
  paymentDecimals: number;
}

# Payment Asset Architecture

DealLock is an EVM/Solidity escrow. This round supports explicit EVM payment
assets only.

## Supported Assets

| Chain | Chain ID | Asset | Type | Decimals | Source |
| --- | ---: | --- | --- | ---: | --- |
| Sepolia | `11155111` | ETH | native | 18 | built-in |
| Hardhat | `31337` | ETH | native | 18 | built-in |
| Sepolia | `11155111` | USDC | ERC-20 | 6 | `USDC_SEPOLIA_ADDRESS` |
| Hardhat | `31337` | MockUSDC | ERC-20 | 6 | `USDC_HARDHAT_ADDRESS` |

Optional future registry assets:

- USDT.
- DAI.
- WETH.

## Non-Goals

- No TON in this EVM round.
- No Solana.
- No arbitrary public ERC-20 address entry.
- No bridge support.
- No token discovery.
- No price oracle.
- No multi-token basket per agreement.

## Registry Shape

Each supported asset should be represented as:

```ts
type PaymentAsset = {
  key: string;
  chainId: number;
  type: "native" | "erc20";
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
};
```

## Backend Rules

- `GET /payment-assets?chainId=...` returns enabled supported assets.
- `GET /payment-assets/:chainId/:assetKey` returns one asset.
- Agreement creation requires either an asset key or token address matching the
  registry.
- Native ETH normalizes to `null` token address for storage/API display.
- Unsupported ERC-20 token addresses are rejected for user-facing creation.
- Agreement rows store an asset metadata snapshot so future registry changes do
  not break historical display.

## Frontend Rules

- Main create flow shows only supported registry assets.
- Amount parsing uses the selected asset decimals.
- Formatting uses stored decimals/symbol from the agreement when available.
- ERC-20 funding uses approve-then-fund.
- Native funding uses `msg.value`.

## Adding A New ERC-20 Safely

1. Confirm the token is normal ERC-20, not fee-on-transfer/rebasing/permit-only.
2. Add it to the backend registry for the intended chain.
3. Add frontend icon/display metadata if needed.
4. Add parse/format tests for decimals.
5. Test approval, funding, refund/release paths.
6. Update docs and deployment env examples.

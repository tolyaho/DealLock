# DealLock Round 10 — Stablecoin / ERC-20 Payments

## Status
Planned.

## Goal
Add stablecoin / ERC-20 escrow support while preserving the existing ETH flow, V4 review/dispute/settlement mechanics, factory-based creation, backend indexing, activity feed, and notification infrastructure.

Round 10 introduces a new multi-asset agreement contract where each agreement is created with exactly one payment asset:

```text
Native ETH agreement  -> paymentToken = address(0)
ERC-20 agreement      -> paymentToken = token contract address, e.g. USDC
```

The primary production use case is USDC-style stablecoin escrow, but the contract should support standard ERC-20 tokens in general.

This round is a major payment-layer change. Testing must be treated as the main deliverable.

---

## Why this round matters
Current DealLock contracts are ETH-only. ETH is acceptable for a technical MVP, but less natural for freelance payments because clients and providers usually think in stable fiat-like amounts.

USDC support makes DealLock more usable:

```text
Client escrows 500 USDC
Provider receives 500 USDC
Milestone amounts stay stable
Gas is still paid in native ETH
Payment value is held in a stablecoin
```

This must not change the authority model:

```text
Wallet = contract authority
Smart contract = escrow authority
Backend = indexing / identity / notification / metadata
Email = notifications only
```

---

## Product behavior
At agreement creation, the client chooses a payment asset:

```text
ETH
USDC / ERC-20
```

For ETH agreements:

```text
Client funds agreement with native ETH in the funding transaction.
```

For ERC-20 agreements:

```text
Client first approves the agreement contract to spend the token.
Client then calls fundAgreement().
The agreement contract pulls tokens from the client using transferFrom().
```

The rest of the workflow remains the same:

```text
provider accepts
client funds
provider submits
client approves / disputes
provider can claim after review
client/provider can mutually settle
paid adjustments can be requested, funded, submitted, approved, disputed, settled, or refunded
```

---

## Naming and versioning
Round 8 already introduced `DealLockV5.sol` as a factory-created V4-compatible wrapper, but it is not a new business-logic version and `contractVersion()` returns `4`.

Recommended naming for the new business-logic contract:

```text
contracts/DealLockMultiAsset.sol
contractVersion() returns 5
```

Recommended factory:

```text
contracts/DealLockFactoryV2.sol
factoryVersion() returns 2
```

If different names are used, docs must clearly explain:

```text
Protocol version 5 = multi-asset / ERC-20 payment support
Round 8 DealLockV5 wrapper = V4-compatible factory deployment wrapper, not protocol version 5
```

Do not silently mutate a deployed factory. Prefer Factory V2 for multi-asset agreements.

---

## Smart contract design

### New contract
Add:

```text
contracts/DealLockMultiAsset.sol
```

This contract should preserve V4 behavior and add payment-asset abstraction.

### Payment asset model
Use:

```solidity
address public immutable paymentToken;
```

Rules:

```text
paymentToken == address(0)  -> native ETH agreement
paymentToken != address(0)  -> ERC-20 agreement
```

Optional helper:

```solidity
function isNativePayment() public view returns (bool);
```

### Constructor
The factory-created contract must accept explicit `_client`:

```solidity
constructor(
    address _client,
    address _provider,
    address _paymentToken,
    string[] memory descriptions,
    uint256[] memory amounts,
    uint256[] memory deadlines,
    uint256 _reviewPeriod
)
```

Validation:
- `_client != address(0)`
- `_provider != address(0)`
- `_provider != _client`
- milestone arrays are non-empty and equal length
- all amounts are non-zero
- deadlines are valid and non-decreasing
- review period remains between 1 hour and 14 days
- `paymentToken == address(0)` means ETH
- `paymentToken != address(0)` means ERC-20

Do not validate token symbol/decimals on-chain. Frontend/backend can read token metadata off-chain.

### ERC-20 implementation
Use OpenZeppelin where possible:

```solidity
IERC20
SafeERC20
ReentrancyGuard
```

Use `SafeERC20` for all ERC-20 transfers.

Suggested internal helpers:

```solidity
function _collectPayment(uint256 amount) internal;
function _sendPayment(address to, uint256 amount) internal;
function _contractPaymentBalance() internal view returns (uint256);
```

Expected behavior:

```text
ETH funding:
  require(paymentToken == address(0))
  require(msg.value == amount)

ERC-20 funding:
  require(paymentToken != address(0))
  require(msg.value == 0)
  safeTransferFrom(client, address(this), amount)
```

For ERC-20 funding, check exact balance delta:

```text
balanceAfter - balanceBefore == amount
```

This intentionally rejects fee-on-transfer / tax tokens for Round 10. Round 10 supports standard ERC-20 behavior only.

### Functions affected by payment abstraction
These functions must work for both ETH and ERC-20:

```text
fundAgreement()
approveMilestone()
refundExpiredMilestone()
claimMilestoneAfterReview()
acceptMilestoneSettlement()
fundAdjustment()
approveAdjustment()
refundExpiredAdjustment()
claimAdjustmentAfterReview()
acceptAdjustmentSettlement()
getContractBalance()
```

Rules:
- ETH agreement uses native ETH balance and payable value
- ERC-20 agreement uses ERC-20 balance
- ERC-20 funding functions must reject non-zero `msg.value`
- ETH funding functions must require exact `msg.value`

### Reentrancy
Any function that transfers ETH or ERC-20 tokens must be `nonReentrant` or otherwise demonstrably safe.

At minimum, apply `nonReentrant` to:
- `fundAgreement`
- `approveMilestone`
- `refundExpiredMilestone`
- `claimMilestoneAfterReview`
- `acceptMilestoneSettlement`
- `fundAdjustment`
- `approveAdjustment`
- `refundExpiredAdjustment`
- `claimAdjustmentAfterReview`
- `acceptAdjustmentSettlement`

Keep checks-effects-interactions:
1. validate
2. update state/accounting
3. transfer payment
4. emit event
5. try complete agreement

---

## Factory V2
Add:

```text
contracts/DealLockFactoryV2.sol
```

Factory V2 should:
- deploy `DealLockMultiAsset`
- record every agreement in on-chain registry
- track agreements by client/provider
- emit a payment-aware `AgreementCreated`
- preserve pagination helpers
- have no owner, no pause, no fees, no upgrade authority

Main function:

```solidity
function createAgreement(
    address provider,
    address paymentToken,
    string[] calldata descriptions,
    uint256[] calldata amounts,
    uint256[] calldata deadlines,
    uint256 reviewPeriod,
    bytes32 metadataHash
) external returns (address agreement);
```

The caller becomes the client.

Factory V2 itself must not receive ETH.

Event:

```solidity
event AgreementCreated(
    address indexed agreement,
    address indexed client,
    address indexed provider,
    uint256 chainId,
    uint256 contractVersion,
    address paymentToken,
    uint256 milestoneCount,
    uint256 totalAmount,
    uint256 reviewPeriod,
    bytes32 metadataHash
);
```

---

## Test mocks
Add mocks for test coverage:

```text
contracts/mocks/MockUSDC.sol
contracts/mocks/FeeOnTransferToken.sol
contracts/mocks/BadReturnERC20.sol
```

`MockUSDC`:
- ERC-20
- 6 decimals
- mint function for tests/local dev

`FeeOnTransferToken`:
- proves exact balance-delta check rejects fee-on-transfer tokens

`BadReturnERC20` or equivalent:
- verifies SafeERC20 handling of non-standard ERC-20 behavior

---

## Frontend changes

### Token configuration
Add:

```text
frontend/src/tokens.ts
```

Suggested type:

```ts
export type PaymentAsset = {
  kind: "native" | "erc20";
  chainId: number;
  address: `0x${string}` | null;
  symbol: string;
  name: string;
  decimals: number;
  isDefault?: boolean;
};
```

Add env vars:

```text
VITE_USDC_SEPOLIA_ADDRESS
VITE_USDC_HARDHAT_ADDRESS
VITE_DEALLOCK_FACTORY_V2_SEPOLIA
VITE_DEALLOCK_FACTORY_V2_HARDHAT
```

Do not hardcode production token addresses unless clearly documented.

### Create agreement flow
Update `CreateAgreementForm.tsx`:
- add payment asset selector
- default to ETH if no ERC-20 token configured
- show USDC when configured
- parse amount inputs according to selected token decimals
- save payment asset metadata to localStorage/backend
- deploy through Factory V2 when configured
- fallback behavior must be explicit and documented

### Funding flow
For ETH:

```text
Fund Agreement -> one transaction with msg.value
```

For ERC-20:

```text
1. Check token balance
2. Check allowance(client -> agreement)
3. If allowance < required amount: show Approve USDC button
4. After approval confirmed: show Fund Agreement button
5. fundAgreement() calls contract, which transferFroms tokens
```

Same for paid adjustments.

Important UX copy:
- users still need native ETH for gas
- USDC is the escrow payment asset
- approving USDC does not transfer funds yet; funding does

### Display formatting
Add/update helpers:

```text
formatAssetAmount(rawAmount, asset)
parseAssetAmount(input, asset)
```

Display:
- `0.01 ETH`
- `500.00 USDC`

Do not call ERC-20 base units "wei" in UI.

---

## Backend/indexer changes

### Prisma schema
Extend `Agreement`:
- `paymentTokenAddress`
- `paymentAssetKind` (`native` or `erc20`)
- `paymentSymbol`
- `paymentDecimals`
- `factoryVersion`

Legacy defaults:
- `paymentAssetKind = native`
- `paymentTokenAddress = null`
- `paymentSymbol = ETH`
- `paymentDecimals = 18`

### ChainEvent amounts
Current `ChainEvent.amountWei` is ETH-specific. Preserve backward compatibility but add neutral fields:
- `amountRaw`
- `paymentTokenAddress`
- `paymentSymbol`
- `paymentDecimals`

New multi-asset logic should use `amountRaw`.

### Factory indexer
Update factory indexer to support:
- Factory V1 `AgreementCreated`
- Factory V2 payment-aware `AgreementCreated`
- idempotent upsert by `chainId + txHash + logIndex`
- agreement payment metadata

### Agreement indexer
Update per-agreement event indexing:
- decode contractVersion 5 events
- store raw amounts and payment metadata
- keep activity feed readable
- keep notification dedupe working

### Notifications
Update email templates and activity feed:
- show `0.01 ETH` for ETH agreements
- show `500.00 USDC` for USDC agreements
- never expose sensitive proof/dispute/settlement text

---

## Testing requirements — critical
Round 10 must be test-heavy. Do not accept a shallow implementation.

Add:

```text
test/DealLockMultiAsset.ts
test/DealLockFactoryV2.ts
```

Minimum coverage target:

```text
at least 60 new tests
```

The exact number is less important than covering all payment-critical cases.

### Contract tests
Cover ETH regression inside the multi-asset contract:
- ETH agreement deploys with `paymentToken = address(0)`
- exact `msg.value` funding works
- wrong `msg.value` reverts
- milestone release/refund works
- review auto-release works
- dispute settlement splits ETH
- paid adjustment lifecycle works
- ETH balance accounting remains correct

Cover ERC-20 core:
- ERC-20 agreement deploys with `paymentToken = MockUSDC`
- cannot fund without approval
- insufficient allowance reverts
- insufficient balance reverts
- funding after approval works
- contract token balance increases exactly by `totalAmount`
- provider receives tokens on release/auto-release/settlement
- client receives tokens on refund/settlement
- fundedAmount/releasedAmount/refundedAmount update correctly

Cover ERC-20 adjustments:
- request/accept/fund/submit/approve
- refund expired funded adjustment
- auto-release after review
- disputed settlement split
- multiple adjustments resolve independently

Cover edge cases:
- fee-on-transfer token rejected by balance-delta check
- non-standard token behavior handled via SafeERC20
- malicious/reentrant token cannot exploit transfer hooks
- ERC-20 functions reject `msg.value`
- wrong caller cannot release/refund/settle
- completion requires all items terminal

### Accounting invariants
Add helper assertions:

```text
For ETH:
  address(contract).balance == unresolved escrowed native amount

For ERC-20:
  token.balanceOf(contract) == unresolved escrowed token amount
```

Check after important state-changing actions.

Also assert:

```text
released + refunded + settledProvider + settledClient + currentlyHeld == total funded amount
```

### Factory V2 tests
Cover:
- `factoryVersion() == 2`
- create ETH agreement
- create ERC-20 agreement
- created agreement client is caller, not factory
- `paymentToken` stored correctly
- event includes `paymentToken`
- registry pagination works
- client/provider registry works
- invalid provider/milestones revert
- factory does not accept ETH
- old Factory V1 tests still pass

### Frontend/backend tests
At minimum:
- frontend TypeScript compile
- frontend production build
- token parse/format tests for 18-decimal ETH and 6-decimal USDC
- backend TypeScript compile
- Prisma migration applies
- Factory V2 event decode test
- multi-asset activity feed formatting
- notification templates show ETH/USDC correctly
- legacy ETH agreements still display correctly

### Required verification commands
Run and document:

```bash
npx hardhat compile
npx hardhat test

cd backend
npm run db:generate
npm run build
npm test

cd ../frontend
npx tsc --noEmit
npm run build
```

If PostgreSQL tests require Docker and Docker is unavailable, document the limitation honestly in `docs/state.md`.

---

## Security notes
Be conservative:
- Use SafeERC20
- Use nonReentrant on transfer functions
- Reject fee-on-transfer tokens via exact balance delta
- Do not support rebasing tokens as first-class assets
- Do not add arbitrary token discovery UI
- Frontend exposes only configured tokens
- Backend never controls funds
- Factory has no admin powers
- No platform fee in this round
- No hidden admin-controlled token whitelist

---

## Docs updates
Update:
- `docs/state.md`
- `README.md`
- `frontend/.env.example`
- `backend/.env.example`

Add Round 10 to implementation history.

Explain:
- ETH vs ERC-20 funding
- USDC requires approve + fund
- USDC is payment asset; ETH is still needed for gas
- contractVersion 5 = multi-asset
- legacy contracts remain supported
- backend/indexer are not escrow authority

---

## Out of scope
Do not implement:
- platform fees
- AI arbitration
- Google OAuth
- reputation system
- multi-party agreements
- cross-chain support
- fiat on/off ramps
- gasless permits / EIP-2612
- token swap UI
- mainnet deployment
- admin-controlled token whitelist

# DealLock Round 11 — Payment Layer Security Review and Invariant Testing

## Status

Planned.

## Goal

Round 11 is a security-focused validation round after the Round 10 payment-layer upgrade. Round 10 introduced `DealLockMultiAsset` and `DealLockFactoryV2`, allowing each new agreement to use either native ETH or one fixed ERC-20 token such as USDC.

Because this round touches fund movement, the goal is not to add new product features. The goal is to aggressively test, review, and patch the multi-asset payment layer so ETH and ERC-20 escrow flows are safe, consistent, and resistant to common failure modes.

Round 11 focuses on:

- reentrancy
- incorrect token balance accounting
- stuck funds
- wrong asset funding
- double release/refund/settlement
- settlement split errors
- adjustment accounting errors
- fee-on-transfer rejection
- false-return ERC-20 rejection
- native ETH accidentally sent to ERC-20 agreements
- ERC-20 accidentally used in ETH agreements
- legacy ETH-only agreement compatibility

No new escrow business logic should be added.

---

## Non-Goals

Do **not** implement any of the following in Round 11:

- platform fees
- AI arbitration
- Google OAuth
- reputation system
- multi-party agreements
- cross-chain support
- fiat payments
- token swaps
- gasless permit flow
- admin-controlled token whitelist
- upgradeable proxy system
- backend-controlled contract actions
- new payment assets beyond configured ETH / ERC-20 support
- new contract feature version unless a patch is truly required for safety

---

## Scope

### 1. Contract Security Review

Review and patch only where needed:

- `contracts/DealLockMultiAsset.sol`
- `contracts/DealLockFactoryV2.sol`
- ERC-20 mock contracts used for tests
- legacy compatibility with V1, V2, V3, V4, Factory V1, and Factory V2

The review must verify that every function moving funds follows a safe pattern.

For outgoing payments:

```text
checks → effects → interactions
```

State/accounting must be updated before releasing/refunding/settling funds.

For incoming ERC-20 funding:

```text
nonReentrant → transferFrom → exact balance delta check → update funded state
```

The exact balance-delta check must reject fee-on-transfer / tax tokens.

---

## Critical Contract Invariants

Round 11 should add invariant-style tests and targeted tests around these rules.

### Global payment invariants

For each agreement:

```text
releasedAmount + refundedAmount <= totalAmount
```

For every funded adjustment:

```text
adjustmentReleasedAmount + adjustmentRefundedAmount <= adjustmentFundedAmount
```

For each milestone:

```text
Released / Refunded / Settled is terminal
```

For each adjustment:

```text
Released / Refunded / Cancelled / Settled is terminal
```

For any settlement:

```text
providerAmount + clientAmount == locked item amount
```

For all outgoing transfers:

```text
state is terminal before external transfer is attempted
```

If an external transfer fails:

```text
the entire transaction reverts and no state/accounting change persists
```

### Native ETH invariants

For ETH agreements:

- `paymentToken == address(0)`
- funding requires `msg.value == totalAmount`
- adjustment funding requires `msg.value == adjustment.amount`
- ERC-20 approval must not be needed
- ETH release/refund/settlement must reduce the agreement ETH balance
- accidental extra ETH should not create incorrect accounting
- ERC-20 tokens sent to an ETH agreement should not affect escrow accounting

### ERC-20 invariants

For ERC-20 agreements:

- `paymentToken != address(0)`
- funding requires `msg.value == 0`
- adjustment funding requires `msg.value == 0`
- funding pulls tokens using `transferFrom`
- release/refund/settlement sends the configured token only
- native ETH sent with ERC-20 funding must revert
- wrong ERC-20 tokens sent to the agreement must not count as escrow funds
- token balance delta must equal the expected funding amount exactly
- fee-on-transfer tokens must be rejected
- false-return tokens must be rejected
- reentrant token callbacks must not allow duplicate state transitions or duplicate payouts

---

## Required Test Categories

### A. Reentrancy tests

Add or strengthen tests using malicious receiver/token contracts.

Test that reentrancy cannot cause:

- double milestone release
- double milestone refund
- double milestone review-period claim
- double milestone settlement acceptance
- double adjustment release
- double adjustment refund
- double adjustment review-period claim
- double adjustment settlement acceptance
- duplicate adjustment funding
- duplicate agreement funding

Expected result:

```text
reentrant call fails or is blocked, and accounting remains correct
```

### B. State-before-transfer tests

For each outgoing payment function, add tests proving the contract cannot be exploited if the recipient/token tries to reenter during transfer.

Functions to cover include:

- `approveMilestone`
- `refundExpiredMilestone`
- `claimMilestoneAfterReview`
- `acceptMilestoneSettlement`
- `approveAdjustment`
- `refundExpiredAdjustment`
- `claimAdjustmentAfterReview`
- `acceptAdjustmentSettlement`

Expected behavior:

```text
state/accounting is already updated before external transfer
reentrant second action cannot pass state checks
```

### C. Failed transfer rollback tests

Add tests proving that if a transfer fails, the whole transaction reverts and no partial state persists.

Cover:

- provider payout failure
- client refund failure
- settlement where provider transfer fails
- settlement where client transfer fails
- ERC-20 `transfer` returning false
- ERC-20 `transferFrom` returning false

Expected behavior:

```text
no terminal state is persisted
no accounting variable is incorrectly incremented
funds remain locked in the agreement
```

### D. Balance accounting tests

Add tests comparing accounting variables against real balances.

For ETH:

```text
address(agreement).balance
```

For ERC-20:

```text
IERC20(paymentToken).balanceOf(address(agreement))
```

Cover:

- initial funding
- milestone release
- milestone refund
- milestone settlement split
- adjustment funding
- adjustment release
- adjustment refund
- adjustment settlement split
- agreement completion

### E. Wrong asset tests

Add tests for:

- sending ETH to ERC-20 funding function
- sending ETH to ERC-20 adjustment funding
- attempting to fund ETH agreement without `msg.value`
- attempting to fund ETH agreement with ERC-20 approval only
- sending unrelated ERC-20 tokens to an agreement contract
- confirming unrelated token balance does not affect `getContractBalance()`
- confirming wrong-token transfers cannot satisfy funding

### F. Fee-on-transfer / bad token tests

Add or strengthen tests for:

- fee-on-transfer token rejected during agreement funding
- fee-on-transfer token rejected during adjustment funding
- false-return token rejected during `transferFrom`
- false-return token rejected during `transfer`
- token with unusual decimals still formats correctly in frontend if configured

### G. Settlement split tests

Add tests for both ETH and ERC-20:

- 0% provider / 100% client
- 25% provider / 75% client
- 50% / 50%
- 75% / 25%
- 100% provider / 0% client
- providerAmount greater than locked amount reverts
- settlement cannot be accepted twice
- proposal creator cannot accept own proposal
- cancelled proposal cannot be accepted
- new proposal replaces/correctly coexists according to current design

### H. Adjustment accounting tests

Add dedicated tests for paid adjustments:

- ERC-20 adjustment request
- provider accepts adjustment
- client approve+funds adjustment
- provider submits adjustment
- client approves adjustment
- client refunds expired funded adjustment
- provider claims after review
- disputed adjustment settlement split
- multiple adjustments resolved independently
- agreement completion waits for all funded/proposed/accepted adjustments to reach terminal state

### I. Legacy regression tests

Run and preserve all existing behavior:

- V1 ETH-only contract
- V2 paid adjustments
- V3 refund grace period
- V4 review/dispute/settlement
- Factory V1
- Factory V2
- Round 10 ETH path
- Round 10 ERC-20 path

No legacy test should be weakened to pass Round 11.

---

## Optional Tooling

Add these if practical without destabilizing the project:

- Slither config and documented command
- Solhint config
- Solidity coverage command
- gas report for key flows
- a short internal audit checklist in `docs/security_round_11_checklist.md`

If tooling adds friction, prioritize the test suite and manual security review first.

---

## Frontend Review Scope

Patch only if needed.

Verify:

- ETH funding remains one transaction
- ERC-20 funding remains approve → fund
- allowance is shown clearly
- token balance is checked before funding
- token decimals are formatted correctly
- USDC-style 6-decimal amounts are parsed correctly
- gas ETH and escrow token are clearly distinguished
- wrong-chain / missing-token config has safe UX
- payment asset display is consistent in create form, workspace header, overview metrics, milestone list, adjustment list, action panel, and activity feed

Add frontend unit tests for amount parsing/formatting if not already present.

---

## Backend / Indexer Review Scope

Patch only if needed.

Verify:

- `contractVersion == 5` is treated as V4-compatible event mechanics with payment metadata
- Factory V2 events are decoded correctly
- payment metadata is stored for agreements discovered through Factory V2
- activity feed uses `amountRaw`, `paymentSymbol`, and `paymentDecimals`
- notification templates format token amounts correctly
- backend never becomes authority over funds
- ChainEvent dedupe remains unique by `(chainId, txHash, logIndex)`

Add tests for Factory V2 event decode and payment metadata mapping if missing.

---

## Required Verification Commands

Run the full suite after patches:

```bash
npx hardhat compile
npx hardhat test
```

Backend:

```bash
cd backend
npx prisma generate
npm run build
./node_modules/.bin/tsx --test src/indexer/decode.test.ts
npm test
```

Frontend:

```bash
cd frontend
npm run build
```

If PostgreSQL-backed tests cannot run in the current environment, document the reason clearly and provide the exact command that should be run locally/CI.

---

## Documentation Updates

After implementation, update:

- `docs/state.md`
- `README.md`
- optionally `docs/security_round_11_checklist.md`

`docs/state.md` must add a Round 11 section summarizing:

- security-review status
- added tests
- vulnerabilities checked
- any patches made
- verification commands and results
- remaining known limitations

Do not rewrite unrelated project state sections unless they are stale or incorrect.

---

## Acceptance Criteria

Round 11 is complete when:

1. All Solidity tests pass.
2. Round 10 payment-layer tests are expanded with reentrancy, wrong-asset, transfer-failure, accounting, and settlement-invariant coverage.
3. ETH flow still works exactly as before.
4. ERC-20 flow is safe for standard tokens and rejects unsupported token behavior.
5. Release/refund/settlement functions update state before outgoing transfers.
6. ERC-20 funding uses nonReentrant + exact balance-delta checks.
7. Factory V2 and indexer payment metadata remain correct.
8. Frontend builds successfully and displays ETH/ERC-20 payment assets consistently.
9. Backend builds successfully and event decoding tests pass.
10. No new product feature, fee logic, AI logic, or backend authority is introduced.

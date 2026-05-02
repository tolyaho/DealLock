# DealLock Round 3 — Fair Refund Window / Deadline Grace Period

## Status

Planned.

## Goal

Add a fair refund window so providers are not punished for normal blockchain inclusion delay.

Today, the contract only sees `block.timestamp`, meaning the time when a transaction is executed inside a block. It cannot know when the provider clicked "Submit", signed in MetaMask, or broadcast the transaction to the mempool. Therefore, a provider could submit shortly before the deadline, but if the transaction is mined slightly after the deadline, the client may be able to refund first.

Round 3 fixes this by adding a short grace period after every deadline before refunds become available.

## Product Decision

Use the average Ethereum block/slot time as the basis for the grace window.

Ethereum proof-of-stake uses 12-second slots. The fair refund window is:

```text
2 × average block/slot time = 2 × 12 seconds = 24 seconds
```

Therefore:

```solidity
uint256 public constant REFUND_GRACE_PERIOD = 24 seconds;
```

A client refund becomes available only at:

```text
refundAvailableAt = deadline + REFUND_GRACE_PERIOD
```

This applies to:

1. original milestone refunds;
2. paid adjustment refunds.

The provider may still submit during the grace period.

## Core Rule

Do not try to prove when a transaction was submitted to the mempool.

The smart contract should use only on-chain time:

```solidity
block.timestamp
```

The rule should be:

```text
Provider can submit until the refund is successfully executed.
Client can refund only after deadline + REFUND_GRACE_PERIOD.
```

This is simple, explainable, and fair.

---

## Contract Strategy

Create a new contract version:

```text
contracts/DealLockV3.sol
```

Do not mutate existing V1 or V2 behavior.

New agreements should deploy V3 by default.

Legacy compatibility:

| Contract | Behavior |
|---|---|
| V1 | No grace period, legacy milestone-only behavior |
| V2 | No grace period, paid adjustments supported |
| V3 | Paid adjustments + refund grace period |

`contractVersion()` should return `3` in V3.

The frontend should detect:

```text
V1: contractVersion() reverts
V2: contractVersion() returns 2
V3: contractVersion() returns 3
```

---

## Smart Contract Requirements

### 1. Add `DealLockV3.sol`

Start from the current `DealLockV2.sol`.

Preserve all V2 features:

- original milestone workflow;
- paid adjustments/change orders;
- multiple adjustments;
- V2 accounting variables;
- checks-effects-interactions;
- no admin key;
- no custody beyond escrowed contract balance;
- no platform wallet;
- no upgradeability.

Then add the grace period behavior.

### 2. Version Marker

Add:

```solidity
function contractVersion() external pure returns (uint256) {
    return 3;
}
```

### 3. Grace Period Constant

Add:

```solidity
uint256 public constant REFUND_GRACE_PERIOD = 24 seconds;
```

The constant should be public so the frontend can read it from the contract if needed.

### 4. Helper Functions

Add milestone helper:

```solidity
function getMilestoneRefundAvailableAt(uint256 id) external view returns (uint256) {
    require(id < milestones.length, "Invalid milestone id");
    return milestones[id].deadline + REFUND_GRACE_PERIOD;
}
```

Add adjustment helper:

```solidity
function getAdjustmentRefundAvailableAt(uint256 id) external view returns (uint256) {
    require(id < _adjustments.length, "Invalid adjustment id");
    return _adjustments[id].deadline + REFUND_GRACE_PERIOD;
}
```

Optional internal helper:

```solidity
function _refundAvailableAt(uint256 deadline) internal pure returns (uint256) {
    return deadline + REFUND_GRACE_PERIOD;
}
```

### 5. Update Milestone Refund Logic

Change milestone refund eligibility from:

```solidity
block.timestamp > milestone.deadline
```

or equivalent to:

```solidity
block.timestamp >= milestone.deadline + REFUND_GRACE_PERIOD
```

The client should not be able to refund during the grace period.

### 6. Update Adjustment Refund Logic

Change adjustment refund eligibility from:

```solidity
block.timestamp > adjustment.deadline
```

or equivalent to:

```solidity
block.timestamp >= adjustment.deadline + REFUND_GRACE_PERIOD
```

This applies only to funded, unsubmitted adjustments.

### 7. Preserve Provider Submission Semantics

Do not add a hard "provider cannot submit after deadline" rule.

The intended behavior is:

```text
Provider can submit while the milestone/adjustment is still pending/funded.
Client can refund only after deadline + grace period.
Whichever valid transaction is mined first after refund availability determines the state.
```

This preserves the provider-friendly race model while still giving the client a clean refund path after the grace window.

### 8. Events

No new event is strictly required.

Optional event if useful:

```solidity
event RefundGracePeriodSet(uint256 secondsValue);
```

But since the value is a constant, this event is not necessary.

---

## Test Requirements

Add:

```text
test/DealLockV3.ts
```

Recommended tests:

1. `contractVersion()` returns `3`.
2. `REFUND_GRACE_PERIOD()` returns `24`.
3. `getMilestoneRefundAvailableAt(id)` returns `deadline + 24`.
4. Client cannot refund a pending milestone before the deadline.
5. Client cannot refund a pending milestone exactly at the deadline.
6. Client cannot refund a pending milestone during the 24-second grace period.
7. Client can refund a pending milestone at or after `deadline + 24`.
8. Provider can submit a milestone during the grace period.
9. If provider submits during the grace period, client can no longer refund that milestone as pending.
10. `getAdjustmentRefundAvailableAt(id)` returns `adjustment.deadline + 24`.
11. Client cannot refund a funded adjustment during the grace period.
12. Client can refund a funded adjustment at or after `deadline + 24`.
13. Provider can submit a funded adjustment during the grace period.
14. If provider submits an adjustment during the grace period, client can no longer refund it.
15. V2 tests still pass unchanged.
16. V1 tests still pass unchanged.

All tests should pass:

```bash
npx hardhat test
```

---

## Frontend Requirements

### 1. Add V3 ABI and Bytecode

Generate from Hardhat artifacts:

```text
frontend/src/contractV3.ts
frontend/src/bytecodeV3.ts
```

`CreateAgreementForm` should deploy V3 by default for all new agreements.

Do not remove:

```text
contract.ts       # V1 ABI
contractV2.ts     # V2 ABI
bytecode.ts       # V1 bytecode
bytecodeV2.ts     # V2 bytecode
```

### 2. Update Contract Version Detection

Update:

```text
frontend/src/contractVersion.ts
```

Support:

```ts
export type ContractVersion = 1 | 2 | 3;
```

Detection logic:

```text
contractVersion() reverts → V1
contractVersion() returns 2 → V2
contractVersion() returns 3 → V3
```

If a future unknown version is returned, handle it safely with a clear UI message instead of silently treating it as V2.

### 3. Update Dashboard Reads

In `DashboardPage.tsx`:

- detect V3;
- read `REFUND_GRACE_PERIOD` for V3 contracts;
- read `getMilestoneRefundAvailableAt(id)` for milestone refund availability, or compute from deadline + constant;
- read `getAdjustmentRefundAvailableAt(id)` for adjustment refund availability, or compute from deadline + constant.

Recommended frontend type additions:

```ts
type ContractVersion = 1 | 2 | 3;

interface RefundTiming {
  deadline: bigint;
  refundAvailableAt: bigint;
  gracePeriodSeconds: bigint;
}
```

### 4. Update UI Copy

Whenever a deadline is shown for a pending milestone or funded adjustment in V3, show:

```text
Deadline: ...
Refund available after: ...
Grace period: 24 seconds
```

Suggested copy:

```text
A short 24-second grace period protects providers from normal block inclusion delay.
```

### 5. Update Client Refund Buttons

For V3:

- do not enable refund button immediately after `deadline`;
- enable only after `deadline + 24 seconds`;
- while inside the grace period, show countdown/copy:

```text
Deadline passed. Refund opens after the grace window.
```

For V1/V2:

- keep legacy behavior;
- optionally show:

```text
This legacy agreement does not include a refund grace period.
```

### 6. Update ActionPanel

For V3 milestone refunds:

```text
Pending + now < deadline:
  "Refund not available before deadline"

Pending + deadline <= now < deadline + 24:
  "Grace period active — provider may still submit"

Pending + now >= deadline + 24:
  enable refund
```

For V3 adjustment refunds:

```text
Funded + now < deadline:
  "Refund not available before deadline"

Funded + deadline <= now < deadline + 24:
  "Grace period active — provider may still submit"

Funded + now >= deadline + 24:
  enable refund
```

### 7. Update AdjustmentList and MilestoneList

Display refund availability for V3 where relevant.

Do not overcomplicate the timeline. A small line under deadline is enough:

```text
Refund opens: Apr 30, 2026, 14:03:24
```

---

## Backend Requirements

### 1. Contract Version Support

Round 2 already added:

```text
Agreement.contractVersion
```

Update validation to allow:

```text
1, 2, 3
```

### 2. Registry Behavior

When saving an agreement, frontend should send `contractVersion: 3` for new V3 deployments.

Backend should store and return it.

### 3. No Backend Event Indexer Yet

Do not add event watching in this round.

Backend still does not determine whether refund is available. The chain and frontend reads remain the source of truth.

---

## Documentation Requirements

### 1. Update `docs/state.md`

After implementation, update `docs/state.md` in two ways:

1. Update the overall current project state to reflect:
   - DealLockV3;
   - refund grace period;
   - 24-second fair refund window;
   - V3 as default for new deployments;
   - V1/V2 compatibility;
   - frontend refund timing display;
   - backend `contractVersion` support for 1/2/3.

2. Add Round 3 to the `Implementation Rounds` section:
   - goal;
   - contract changes;
   - tests;
   - frontend changes;
   - backend changes;
   - out-of-scope items.

Do not replace useful previous state. Preserve V1 and V2 descriptions and add V3 cleanly.

### 2. Update `README.md`

Explain:

- V1: original milestone escrow;
- V2: paid adjustments;
- V3: paid adjustments + refund grace period;
- why the grace period exists;
- how `refundAvailableAt = deadline + 24 seconds` works.

### 3. Add This File

Place this file at:

```text
docs/round_3.md
```

---

## Acceptance Criteria

Round 3 is complete when:

- `contracts/DealLockV3.sol` exists.
- `contractVersion()` returns `3`.
- `REFUND_GRACE_PERIOD()` returns `24`.
- Milestone refunds are blocked until `deadline + 24 seconds`.
- Adjustment refunds are blocked until `deadline + 24 seconds`.
- Provider can still submit milestone proof during the grace period.
- Provider can still submit adjustment proof during the grace period.
- New agreements deploy V3 by default.
- V1 and V2 agreements remain readable and usable.
- Backend accepts and stores `contractVersion = 3`.
- UI clearly shows refund availability timing for V3.
- `docs/state.md` is updated with current architecture and Round 3 summary.
- `README.md` is updated.
- All tests pass.

---

## Out of Scope

Do not implement these in Round 3:

- Google OAuth;
- email notifications;
- event watcher / chain indexer;
- factory contract;
- platform fees;
- ERC-20 payments;
- arbitration;
- reputation system;
- free revision workflow;
- dynamic/custom grace period per contract;
- using mempool arrival time as proof of timely submission.

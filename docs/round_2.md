# DealLock Round 2 — Paid Adjustments / Change Orders

## Status

Planned.

## Context

DealLock is currently in a post-Round-1 state:

- `DealLock.sol` is the original V1 milestone escrow contract.
- One agreement is still one deployed contract.
- The original contract workflow is: provider accepts, client funds exact original total, provider submits milestones sequentially, client approves or refunds expired pending milestones.
- Round 1 added a backend account layer, wallet-signature sign-in, multi-wallet accounts, and a backend-backed agreement registry.
- Wallets remain the source of blockchain authority.
- The backend does not control escrow funds and does not execute contract actions.

Round 2 makes the escrow workflow more realistic for freelance work by adding **paid adjustments**, also called **change orders**.

The product decision for this round is explicit:

```text
No free revision workflow in Round 2.
Only paid adjustments / change orders.
```

A paid adjustment is extra work requested by the client after the agreement is already running. It is not a modification of the original milestone and not a free correction flow. It is an append-only extra work item with its own amount, deadline, proof, state, and payment release.

---

## Goal

Add support for multiple paid adjustments inside a DealLock agreement.

A paid adjustment should behave like an extra mini-milestone attached to an existing original milestone:

```text
Client requests adjustment
→ Provider accepts adjustment
→ Client funds adjustment amount
→ Provider submits adjustment proof
→ Client approves adjustment
→ Provider receives extra payment
```

The adjustment must be append-only. Original milestones, amounts, descriptions, and deadlines must not be edited.

---

## Product Rules

### Core rule

```text
Original milestone = original agreed scope
Paid adjustment = extra requested work with extra payment
```

### Authority rules

- Only the client can request a paid adjustment.
- Only the provider can accept a paid adjustment.
- Only the client can fund a paid adjustment.
- Only the provider can submit proof for a funded adjustment.
- Only the client can approve and release a submitted adjustment.
- Only the client can refund an expired funded adjustment that was not submitted.
- Neither party can unilaterally force the other party into extra work.

### Fairness rules

- The provider should not be expected to work before the adjustment is accepted and funded.
- The client should not pay the provider until the adjustment proof is submitted and approved.
- The client cannot force the provider to accept extra work.
- The provider cannot withdraw adjustment funds without client approval.
- The client can recover funded adjustment money only if the adjustment deadline passes and the provider has not submitted proof.

### Multiplicity rule

There can be multiple adjustments in one agreement.

Example:

```text
Milestone 1: Landing page build
├── Adjustment 0: Add dark mode — 0.01 ETH
├── Adjustment 1: Add mobile animation — 0.008 ETH
└── Adjustment 2: Add extra pricing section — 0.012 ETH
```

### Append-only rule

Do not edit original milestones. Do not edit existing adjustments after they are created. Add new adjustment records instead.

---

## Out of Scope

Do not implement these in Round 2:

- Free revision requests
- Editing existing milestones
- Editing existing adjustment terms after creation
- Arbitration or dispute resolution
- ERC-20 payments
- Platform fees
- Factory contract
- Event indexer
- Google OAuth
- Email notifications
- Reputation system
- Multi-party agreements

---

## Smart Contract Direction

### Add a new contract version

Do **not** break existing V1 contracts.

Add a new contract:

```text
contracts/DealLockV2.sol
```

Keep `contracts/DealLock.sol` unchanged unless a tiny shared typing/export change is absolutely necessary.

V2 should preserve the original milestone behavior and add paid adjustments.

### Versioning

Add a simple version marker to V2:

```solidity
function contractVersion() external pure returns (uint8) {
    return 2;
}
```

Frontend can detect:

```text
If contractVersion() succeeds and returns 2 → V2
If contractVersion() call fails → treat as V1
```

The backend agreement registry should also store a contract version field when known.

---

## DealLockV2 Contract Design

### Preserve original V1 behavior

The following should remain conceptually unchanged:

- client is immutable deployer
- provider is immutable constructor argument
- original milestones are fixed at deploy
- original milestone descriptions, amounts, and deadlines cannot change
- client funds exact original total through `fundAgreement()`
- provider submits original milestones sequentially
- client approves original milestones
- client refunds expired pending original milestones
- state updates happen before ETH transfers
- no admin key
- no platform wallet
- no upgradeability

### Original total amount

The original `totalAmount` may remain the sum of original milestones.

Do **not** mutate the original total when adjustments are added. Instead, track adjustment accounting separately.

Recommended extra accounting variables:

```solidity
uint256 public adjustmentFundedAmount;
uint256 public adjustmentReleasedAmount;
uint256 public adjustmentRefundedAmount;
```

The contract balance is the actual escrow balance and includes any unreleased original milestone funds plus any unreleased funded adjustment funds.

### Adjustment state enum

Add:

```solidity
enum AdjustmentState {
    Proposed,   // client requested, provider has not accepted yet
    Accepted,   // provider accepted, waiting for client to fund
    Funded,     // client funded, provider can submit proof
    Submitted,  // provider submitted proof, waiting for client approval
    Released,   // client approved, provider paid
    Refunded,   // deadline passed before submission, client refunded
    Cancelled   // unfunded adjustment cancelled
}
```

### Adjustment struct

Add:

```solidity
struct Adjustment {
    uint256 targetMilestoneId;
    string description;
    uint256 amount;
    uint256 deadline;
    string proof;
    uint256 submittedAt;
    AdjustmentState state;
}
```

Notes:

- `targetMilestoneId` links the adjustment to an original milestone.
- `description` is public on-chain, so frontend should warn users not to include private details.
- `proof` is public on-chain, so frontend should encourage hashes, CIDs, public demo links, or non-sensitive references.
- `deadline` is the provider's submission deadline for the adjustment proof.

### Adjustment storage

Add:

```solidity
Adjustment[] public adjustments;
```

Add read helpers:

```solidity
function getAdjustment(uint256 id) external view returns (Adjustment memory);
function getAdjustmentCount() external view returns (uint256);
```

---

## DealLockV2 Functions

### `requestAdjustment`

Client proposes paid extra work.

```solidity
function requestAdjustment(
    uint256 targetMilestoneId,
    string calldata description,
    uint256 amount,
    uint256 deadline
) external onlyClient inState(AgreementState.Funded)
```

Requirements:

- `targetMilestoneId < milestones.length`
- `bytes(description).length > 0`
- `amount > 0`
- `deadline > block.timestamp`
- recommended: target milestone should be `Submitted` or `Released`

Creates a new `Adjustment` in `Proposed` state.

Emit:

```solidity
event AdjustmentRequested(
    uint256 indexed adjustmentId,
    uint256 indexed targetMilestoneId,
    uint256 amount,
    uint256 deadline,
    string description
);
```

### `acceptAdjustment`

Provider accepts extra paid work.

```solidity
function acceptAdjustment(uint256 adjustmentId) external onlyProvider inState(AgreementState.Funded)
```

Requirements:

- adjustment exists
- state is `Proposed`

Transitions:

```text
Proposed → Accepted
```

Emit:

```solidity
event AdjustmentAccepted(uint256 indexed adjustmentId);
```

### `fundAdjustment`

Client escrows the extra payment.

```solidity
function fundAdjustment(uint256 adjustmentId) external payable onlyClient inState(AgreementState.Funded)
```

Requirements:

- adjustment exists
- state is `Accepted`
- `msg.value == adjustment.amount`

Transitions:

```text
Accepted → Funded
```

Effects:

- increase `adjustmentFundedAmount` by `msg.value`

Emit:

```solidity
event AdjustmentFunded(uint256 indexed adjustmentId, uint256 amount);
```

### `submitAdjustment`

Provider submits proof for funded adjustment.

```solidity
function submitAdjustment(
    uint256 adjustmentId,
    string calldata proof
) external onlyProvider inState(AgreementState.Funded)
```

Requirements:

- adjustment exists
- state is `Funded`
- `bytes(proof).length > 0`
- recommended: `block.timestamp <= adjustment.deadline`

Transitions:

```text
Funded → Submitted
```

Effects:

- store proof
- store submittedAt

Emit:

```solidity
event AdjustmentSubmitted(uint256 indexed adjustmentId, string proof);
```

### `approveAdjustment`

Client approves submitted adjustment and releases extra payment.

```solidity
function approveAdjustment(uint256 adjustmentId) external onlyClient inState(AgreementState.Funded)
```

Requirements:

- adjustment exists
- state is `Submitted`

Transitions:

```text
Submitted → Released
```

Effects:

- update state before transfer
- increase `adjustmentReleasedAmount`
- transfer `adjustment.amount` to provider via low-level `call`
- require transfer success
- call `_tryCompleteAgreement()` after transfer/accounting

Emit:

```solidity
event AdjustmentReleased(uint256 indexed adjustmentId, uint256 amount);
```

### `refundExpiredAdjustment`

Client refunds funded adjustment if provider misses the submission deadline.

```solidity
function refundExpiredAdjustment(uint256 adjustmentId) external onlyClient inState(AgreementState.Funded)
```

Requirements:

- adjustment exists
- state is `Funded`
- `block.timestamp > adjustment.deadline`

Transitions:

```text
Funded → Refunded
```

Effects:

- update state before transfer
- increase `adjustmentRefundedAmount`
- transfer `adjustment.amount` to client via low-level `call`
- require transfer success
- call `_tryCompleteAgreement()` after transfer/accounting

Emit:

```solidity
event AdjustmentRefunded(uint256 indexed adjustmentId, uint256 amount);
```

### `cancelAdjustment`

Allow either party to cancel an unfunded adjustment so the agreement cannot get stuck.

```solidity
function cancelAdjustment(uint256 adjustmentId) external inState(AgreementState.Funded)
```

Requirements:

- caller is client or provider
- adjustment exists
- state is `Proposed` or `Accepted`

Transitions:

```text
Proposed → Cancelled
Accepted → Cancelled
```

No ETH transfer.

Emit:

```solidity
event AdjustmentCancelled(uint256 indexed adjustmentId);
```

---

## Completion Logic

Update V2 `_tryCompleteAgreement()` so it considers both original milestones and adjustments.

Recommended behavior:

```text
Agreement completes only when:
1. original releasedAmount + refundedAmount == totalAmount
2. every existing adjustment is terminal:
   Released, Refunded, or Cancelled
```

This means proposed or accepted unfunded adjustments can block completion until either funded and resolved or cancelled.

To avoid grief/stuck state, `cancelAdjustment()` must allow either client or provider to cancel `Proposed` or `Accepted` adjustments.

Once agreement is `Completed`, do not allow new adjustments.

---

## Security Requirements

- Preserve role-based access control.
- Preserve state-machine checks.
- Preserve checks-effects-interactions for ETH transfers.
- Use low-level `call` with success assertion.
- Never allow provider to withdraw unfunded adjustment money.
- Never allow client to refund a submitted adjustment.
- Never allow adjustment funding with incorrect ETH amount.
- Never allow an adjustment to be funded before provider acceptance.
- Never allow an adjustment to be submitted before funding.
- Never allow an adjustment to target a nonexistent milestone.
- Avoid unbounded loops in write paths except `_tryCompleteAgreement()` over adjustments. This is acceptable for the current MVP-scale product, but document the limitation.

---

## Tests

Add:

```text
test/DealLockV2.ts
```

Required tests:

1. V2 deployment preserves original V1 fields and original milestone workflow.
2. `contractVersion()` returns `2`.
3. Client can request a paid adjustment attached to a submitted or released milestone.
4. Non-client cannot request adjustment.
5. Cannot request adjustment with invalid milestone id.
6. Cannot request adjustment with zero amount.
7. Cannot request adjustment with past deadline.
8. Provider can accept proposed adjustment.
9. Non-provider cannot accept adjustment.
10. Client can fund accepted adjustment with exact ETH amount.
11. Cannot fund proposed adjustment before provider acceptance.
12. Cannot fund with incorrect amount.
13. Provider can submit funded adjustment proof.
14. Cannot submit adjustment before funding.
15. Client can approve submitted adjustment and provider receives payment.
16. Client can refund expired funded adjustment that was not submitted.
17. Cannot refund funded adjustment before deadline.
18. Cannot refund adjustment after provider submitted proof.
19. Either party can cancel proposed or accepted unfunded adjustment.
20. Cannot cancel funded/submitted/released/refunded adjustment.
21. Multiple adjustments can exist and resolve independently.
22. Agreement completes only after original milestones and all adjustments are terminal.
23. DealLockV1 tests still pass unchanged.

---

## Frontend Requirements

### ABI and bytecode

Add V2 artifacts:

```text
frontend/src/contractV2.ts       # DEALLOCK_V2_ABI
frontend/src/bytecodeV2.ts       # DEALLOCK_V2_BYTECODE
```

Keep V1 artifacts for old agreements:

```text
frontend/src/contract.ts         # V1 ABI
frontend/src/bytecode.ts         # V1 bytecode
```

### Contract version detection

Add utility:

```text
frontend/src/contractVersion.ts
```

Behavior:

- Try reading `contractVersion()` with V2 ABI.
- If it returns `2`, treat contract as V2.
- If the call fails, treat contract as V1.
- Backend `contractVersion` can be used as a hint but chain detection should be the source of truth.

### Deployment

New agreements should deploy V2 by default.

`CreateAgreementForm` should use V2 ABI and V2 bytecode unless there is an explicit compatibility mode.

After deployment, save to backend registry with:

```ts
contractVersion: 2
```

### Types

Add adjustment types:

```ts
export const ADJUSTMENT_STATES = {
  0: "Proposed",
  1: "Accepted",
  2: "Funded",
  3: "Submitted",
  4: "Released",
  5: "Refunded",
  6: "Cancelled",
} as const;

export interface AdjustmentData {
  id: number;
  targetMilestoneId: number;
  description: string;
  amount: bigint;
  deadline: bigint;
  proof: string;
  submittedAt: bigint;
  state: number;
}
```

Add formatting helper:

```ts
adjustmentLabel(state: number): string
```

### Reads

For V2 agreements, read:

- `getAdjustmentCount()`
- `getAdjustment(id)` for all ids
- adjustment accounting variables if exposed:
  - `adjustmentFundedAmount`
  - `adjustmentReleasedAmount`
  - `adjustmentRefundedAmount`

For V1 agreements, skip adjustment reads.

### UI

Add a new component:

```text
frontend/src/components/AdjustmentList.tsx
```

It should show adjustments grouped under their `targetMilestoneId`.

Each adjustment card should show:

- adjustment id
- linked milestone
- state pill
- description
- amount
- deadline
- submittedAt if present
- proof if present
- available role-based next action

Update `MilestoneList` or the workspace layout so adjustments are visually attached to their target milestone.

### ActionPanel

Update `ActionPanel` for V2 agreements.

Client actions:

- Request paid adjustment
- Fund accepted adjustment
- Approve submitted adjustment
- Refund expired funded adjustment
- Cancel proposed/accepted unfunded adjustment

Provider actions:

- Accept proposed adjustment
- Submit funded adjustment proof
- Cancel proposed/accepted unfunded adjustment

Viewer/other role:

- Read-only.

Linked-wallet behavior from Round 1 must remain:

- If the user account has the correct wallet linked but the currently connected wallet is not the required role wallet, show the switch-wallet message.
- Do not allow contract write calls from the wrong connected wallet.

### Create paid adjustment form

Client should be able to open a compact form from a milestone card or action panel:

Fields:

- target milestone id, defaulting to the selected milestone
- description
- amount in ETH
- deadline datetime

Validation:

- description non-empty
- amount > 0
- deadline in future
- target milestone exists
- V2 contract only

UX warning:

```text
Adjustment descriptions are stored on-chain and are public. Do not include private credentials, confidential client information, or sensitive business details.
```

### V1 compatibility

For V1 agreements:

- Do not show paid adjustment actions.
- Show a small note:

```text
Paid adjustments are available only for V2 agreements. This agreement was deployed with the original V1 contract.
```

Existing V1 agreements must remain readable and usable with their original actions.

---

## Backend Requirements

Update Prisma `Agreement` model with a contract version field:

```prisma
contractVersion Int @default(1)
```

If using Prisma migrations, create a migration for the new field.

Update agreement API endpoints:

- `POST /agreements` accepts `contractVersion`
- `PATCH /agreements/:contractAddress` can update `contractVersion`
- `GET /agreements` returns `contractVersion`

No event watcher in this round.

No backend caching of adjustment state is required in this round. The frontend should read adjustment state from the contract.

---

## Documentation Requirements

Update:

```text
docs/state.md
```

Do this in two ways:

1. Update the overall current project state so it reflects:
   - `DealLockV2.sol`
   - paid adjustments/change orders
   - contract versioning
   - V1 compatibility
   - V2 default deployment
   - frontend adjustment UI
   - backend `contractVersion` field

2. Update the `Implementation Rounds` section:
   - Add `Round 2 — Paid Adjustments / Change Orders`
   - Mark status accurately: `Implemented` only if all requested work is complete
   - Summarize contract changes, frontend changes, backend changes, tests, and out-of-scope items

Also update:

```text
README.md
```

Include:

- V1 vs V2 explanation
- how to run V2 tests
- how paid adjustments work
- public on-chain data warning for adjustment descriptions and proof strings

---

## Acceptance Criteria

Round 2 is complete when all of these are true:

### Contract

- `DealLockV2.sol` exists.
- V1 contract remains unchanged and V1 tests still pass.
- V2 supports original milestone workflow.
- V2 supports multiple paid adjustments.
- Adjustment lifecycle works:

```text
Proposed → Accepted → Funded → Submitted → Released
```

- Expired funded adjustment can be refunded if not submitted.
- Proposed/accepted unfunded adjustment can be cancelled.
- Provider cannot be forced into extra work.
- Client cannot fund incorrect amount.
- Provider cannot withdraw adjustment funds before approval.
- Completion considers original milestones and terminal adjustments.

### Tests

- New V2 test suite covers paid adjustment behavior.
- Existing V1 test suite passes unchanged.

### Frontend

- New agreements deploy V2 by default.
- V1 agreements remain readable and usable.
- Contract version detection works.
- V2 agreements show adjustment list/grouping.
- Client can request, fund, approve, refund, and cancel adjustments through UI.
- Provider can accept, submit, and cancel adjustments through UI.
- Wrong-wallet behavior remains safe and clear.
- On-chain public-data warning is visible when creating adjustment descriptions/proofs.

### Backend

- Agreement registry stores and returns `contractVersion`.
- Existing agreement registry behavior from Round 1 still works.

### Docs

- `docs/state.md` is updated overall.
- `docs/state.md` has Round 2 in Implementation Rounds.
- `README.md` explains V2 paid adjustments.

---

## Suggested Implementation Order

1. Add `DealLockV2.sol` by copying V1 and carefully adding adjustment logic.
2. Add V2 tests and make them pass.
3. Generate/copy V2 ABI and bytecode for the frontend.
4. Add contract version detection in frontend.
5. Add backend `contractVersion` field and update API types.
6. Make new agreement deployment use V2 by default.
7. Add adjustment reads to `DashboardPage` only for V2.
8. Add adjustment types and labels.
9. Add `AdjustmentList` UI.
10. Add adjustment actions to `ActionPanel`.
11. Preserve V1 compatibility.
12. Update docs and README.

---

## Important Notes for Implementation

- Treat the blockchain as the source of truth for adjustment state.
- Do not put sensitive user data into on-chain adjustment descriptions or proof strings.
- Do not make the backend responsible for contract permissions.
- Do not let the frontend assume that account-level role equals connected-wallet authority. The currently connected wallet must still be the exact `client` or `provider` address for writes.
- Avoid overengineering. Round 2 should add paid adjustments cleanly, not solve arbitration, messaging, emails, or reputation.

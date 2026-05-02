# DealLock Round 4 — Review Period, Disputes, and Mutual Settlement

## Status

Implemented.

## Context

DealLock currently supports milestone escrow, multi-wallet accounts, paid adjustments, and a refund grace period. However, the product still has a major fairness gap:

- The provider may submit real work.
- The client may refuse to approve it.
- The client should not be able to simply wait and reclaim funds after work has been submitted.
- At the same time, the client needs a way to object if the delivered work is incomplete or outside the agreed scope.

Round 4 introduces a review period, a dispute state, provider auto-release after no client action, and manual/mutual settlement for disputed work.

This round does **not** add AI arbitration yet. The purpose is to create the contract and UI foundation that future AI-assisted dispute resolution can build on.

---

## Product Principle

Before submission, the client is protected by deadline refund.

After submission, the provider is protected by review-period finality.

The new rule is:

```text
Pending work with no submission after deadline + refund grace period
  → client can refund

Submitted work
  → client can approve
  → client can dispute during the review period
  → if client does nothing, provider can auto-release after the review period

Disputed work
  → cannot be unilaterally refunded or released
  → can be resolved only by mutual settlement in this round
```

This prevents the client from holding submitted work hostage forever, while still allowing the client to challenge poor or incomplete delivery.

---

## Round 4 Goal

Add a V4 contract and frontend workflow with:

1. Review period after milestone/adjustment submission.
2. Client dispute option during the review period.
3. Provider auto-release if the review period passes with no dispute.
4. Manual settlement proposals for disputed items.
5. Mutual acceptance of settlement by the opposite party.
6. Split payout between provider and client according to agreed settlement.
7. V1/V2/V3 compatibility preserved.
8. V4 used as the default contract for new deployments.

---

## Out of Scope

Do **not** implement the following in Round 4:

- AI dispute analysis
- Binding AI arbitration
- Human arbiter role
- Third-party arbitrator address
- Court/legal workflow
- Editing original milestone terms
- Free revision workflow
- ERC-20 payments
- Factory contract
- Platform fees
- Reputation system
- Event indexer
- Email notifications
- Google OAuth

---

## Contract Direction

Create a new contract:

```text
contracts/DealLockV4.sol
```

Do not modify `DealLock.sol`, `DealLockV2.sol`, or `DealLockV3.sol` except if absolutely necessary for imports/build tooling.

New agreements should deploy V4 by default. Existing V1/V2/V3 contracts must remain loadable and usable.

---

## Contract Versioning

V4 must expose:

```solidity
function contractVersion() external pure returns (uint256) {
    return 4;
}
```

Frontend version detection should become:

```text
contractVersion() returns 4 → V4
contractVersion() returns 3 → V3
contractVersion() returns 2 → V2
contractVersion() reverts → V1
```

Backend `Agreement.contractVersion` should allow `1`, `2`, `3`, or `4`.

---

## Review Period

Round 3 added refund grace period around deadline refunds. Round 4 adds a separate review period after submitted work.

Recommended design:

```solidity
uint256 public immutable reviewPeriod;
```

Recommended default in frontend:

```text
3 days
```

Constructor should accept `_reviewPeriod` so future agreements can choose a review length:

```solidity
constructor(
    address _provider,
    string[] memory descriptions,
    uint256[] memory amounts,
    uint256[] memory deadlines,
    uint256 _reviewPeriod
)
```

Validation:

```text
_reviewPeriod >= 1 hours
_reviewPeriod <= 14 days
```

Frontend should default to `3 days` and can either hide the field or expose it as an advanced option.

The review deadline is:

```text
reviewDeadline = submittedAt + reviewPeriod
```

---

## Milestone State Changes

V4 should extend the milestone lifecycle.

Recommended `MilestoneState`:

```solidity
enum MilestoneState {
    Pending,
    Submitted,
    Released,
    Refunded,
    Disputed,
    Settled
}
```

Lifecycle:

```text
Pending
  → Submitted              provider submits proof
  → Refunded               client refunds after deadline + grace if still pending

Submitted
  → Released               client approves
  → Disputed               client disputes during review period
  → Released               provider auto-releases after review period

Disputed
  → Settled                counterparty accepts settlement proposal
```

Terminal milestone states:

```text
Released
Refunded
Settled
```

---

## Adjustment State Changes

V4 should also support disputes and review periods for paid adjustments, because paid adjustments are also paid work.

Recommended `AdjustmentState`:

```solidity
enum AdjustmentState {
    Proposed,
    Accepted,
    Funded,
    Submitted,
    Released,
    Refunded,
    Cancelled,
    Disputed,
    Settled
}
```

Lifecycle additions:

```text
Submitted
  → Released               client approves
  → Disputed               client disputes during review period
  → Released               provider auto-releases after review period

Disputed
  → Settled                counterparty accepts settlement proposal
```

Terminal adjustment states:

```text
Released
Refunded
Cancelled
Settled
```

---

## Dispute Data

Dispute reasons and settlement notes are on-chain and publicly visible. The UI must warn users not to put private business details, credentials, private client data, or confidential links directly on-chain.

For MVP, keep dispute data minimal.

Recommended structs:

```solidity
struct DisputeInfo {
    bool exists;
    address openedBy;
    string reason;
    uint256 openedAt;
}

struct SettlementProposal {
    bool exists;
    address proposer;
    uint256 providerAmount;
    string note;
    uint256 proposedAt;
}
```

Use separate mappings for milestone disputes/proposals and adjustment disputes/proposals:

```solidity
mapping(uint256 => DisputeInfo) private _milestoneDisputes;
mapping(uint256 => SettlementProposal) private _milestoneSettlementProposals;

mapping(uint256 => DisputeInfo) private _adjustmentDisputes;
mapping(uint256 => SettlementProposal) private _adjustmentSettlementProposals;
```

The client share is always derived as:

```text
clientAmount = itemAmount - providerAmount
```

Settlement invariant:

```text
providerAmount <= itemAmount
providerAmount + clientAmount == itemAmount
```

---

## New Milestone Functions

### `disputeMilestone`

```solidity
function disputeMilestone(uint256 milestoneId, string calldata reason) external onlyClient inState(AgreementState.Funded)
```

Rules:

- Milestone must be `Submitted`.
- Reason must be non-empty.
- `block.timestamp <= submittedAt + reviewPeriod`.
- Sets milestone state to `Disputed`.
- Stores dispute info.
- Emits `MilestoneDisputed`.

### `claimMilestoneAfterReview`

```solidity
function claimMilestoneAfterReview(uint256 milestoneId) external onlyProvider inState(AgreementState.Funded)
```

Rules:

- Milestone must be `Submitted`.
- `block.timestamp > submittedAt + reviewPeriod`.
- Sets state to `Released`.
- Increments `releasedAmount` by milestone amount.
- Transfers milestone amount to provider.
- Calls `_tryCompleteAgreement()`.
- Emits `MilestoneAutoReleased` or reuse `MilestoneReleased` plus a specific auto-release event.

### `proposeMilestoneSettlement`

```solidity
function proposeMilestoneSettlement(
    uint256 milestoneId,
    uint256 providerAmount,
    string calldata note
) external inState(AgreementState.Funded)
```

Rules:

- Caller must be client or provider.
- Milestone must be `Disputed`.
- `providerAmount <= milestone.amount`.
- Stores or replaces active settlement proposal.
- Proposal proposer is `msg.sender`.
- The proposer cannot accept their own proposal.
- Emits `MilestoneSettlementProposed`.

### `acceptMilestoneSettlement`

```solidity
function acceptMilestoneSettlement(uint256 milestoneId) external inState(AgreementState.Funded)
```

Rules:

- Caller must be client or provider.
- Milestone must be `Disputed`.
- Active settlement proposal must exist.
- Caller must be the counterparty, not the proposal creator.
- `providerAmount` goes to provider.
- `clientAmount = milestone.amount - providerAmount` goes back to client.
- State becomes `Settled`.
- Increments `releasedAmount` by provider amount.
- Increments `refundedAmount` by client amount.
- Clears/deactivates the proposal.
- Calls `_tryCompleteAgreement()`.
- Emits `MilestoneSettlementAccepted`.

### `cancelMilestoneSettlement`

```solidity
function cancelMilestoneSettlement(uint256 milestoneId) external inState(AgreementState.Funded)
```

Rules:

- Active proposal must exist.
- Only the proposal creator can cancel their own proposal.
- Milestone remains `Disputed`.
- Emits `MilestoneSettlementCancelled`.

### View Helpers

Add view helpers for frontend:

```solidity
function getMilestoneDispute(uint256 milestoneId) external view returns (DisputeInfo memory)
function getMilestoneSettlementProposal(uint256 milestoneId) external view returns (SettlementProposal memory)
function getMilestoneReviewDeadline(uint256 milestoneId) external view returns (uint256)
function canClaimMilestoneAfterReview(uint256 milestoneId) external view returns (bool)
```

---

## New Adjustment Functions

Add the equivalent functions for adjustments:

```solidity
function disputeAdjustment(uint256 adjustmentId, string calldata reason) external onlyClient inState(AgreementState.Funded)
function claimAdjustmentAfterReview(uint256 adjustmentId) external onlyProvider inState(AgreementState.Funded)
function proposeAdjustmentSettlement(uint256 adjustmentId, uint256 providerAmount, string calldata note) external inState(AgreementState.Funded)
function acceptAdjustmentSettlement(uint256 adjustmentId) external inState(AgreementState.Funded)
function cancelAdjustmentSettlement(uint256 adjustmentId) external inState(AgreementState.Funded)
```

Add view helpers:

```solidity
function getAdjustmentDispute(uint256 adjustmentId) external view returns (DisputeInfo memory)
function getAdjustmentSettlementProposal(uint256 adjustmentId) external view returns (SettlementProposal memory)
function getAdjustmentReviewDeadline(uint256 adjustmentId) external view returns (uint256)
function canClaimAdjustmentAfterReview(uint256 adjustmentId) external view returns (bool)
```

Rules mirror milestone rules, but amounts use `adjustment.amount`, and accounting uses adjustment accounting variables:

```text
providerAmount → adjustmentReleasedAmount
clientAmount   → adjustmentRefundedAmount
```

---

## Completion Logic

Update `_tryCompleteAgreement()`.

V4 agreement completes only when:

1. All original milestone value is resolved:

```text
releasedAmount + refundedAmount == totalAmount
```

2. Every milestone is terminal:

```text
Released / Refunded / Settled
```

3. Every adjustment is terminal:

```text
Released / Refunded / Cancelled / Settled
```

4. All adjustment funded value is resolved:

```text
adjustmentReleasedAmount + adjustmentRefundedAmount == adjustmentFundedAmount
```

Important: proposed or accepted but unfunded adjustments must be cancelled or terminal before completion, unless you intentionally decide that unfunded adjustments should not block completion. Recommended for Round 4:

```text
Proposed and Accepted adjustments are non-terminal and block completion until cancelled.
```

This avoids leaving open change orders on a completed agreement.

---

## Events

Add milestone events:

```solidity
event MilestoneDisputed(uint256 indexed milestoneId, string reason);
event MilestoneAutoReleased(uint256 indexed milestoneId, uint256 amount);
event MilestoneSettlementProposed(
    uint256 indexed milestoneId,
    address indexed proposer,
    uint256 providerAmount,
    uint256 clientAmount,
    string note
);
event MilestoneSettlementAccepted(
    uint256 indexed milestoneId,
    uint256 providerAmount,
    uint256 clientAmount
);
event MilestoneSettlementCancelled(uint256 indexed milestoneId);
```

Add adjustment events:

```solidity
event AdjustmentDisputed(uint256 indexed adjustmentId, string reason);
event AdjustmentAutoReleased(uint256 indexed adjustmentId, uint256 amount);
event AdjustmentSettlementProposed(
    uint256 indexed adjustmentId,
    address indexed proposer,
    uint256 providerAmount,
    uint256 clientAmount,
    string note
);
event AdjustmentSettlementAccepted(
    uint256 indexed adjustmentId,
    uint256 providerAmount,
    uint256 clientAmount
);
event AdjustmentSettlementCancelled(uint256 indexed adjustmentId);
```

---

## Security Requirements

Preserve all existing security patterns:

- Role-based modifiers.
- State machine checks.
- Checks-effects-interactions.
- State updated before ETH transfers.
- No platform wallet.
- No admin key.
- No upgradeability.

New security requirements:

- Client cannot refund submitted work.
- Client can only dispute submitted work during the review period.
- Provider can only auto-release after review period expires.
- Settlement proposal creator cannot accept their own proposal.
- Settlement payout must exactly divide the item amount.
- Disputed funds cannot be unilaterally claimed by either party.
- Settlement functions must not allow double payout.
- Settlement state must be terminal.

---

## Frontend Requirements

### New Files

Add:

```text
frontend/src/contractV4.ts
frontend/src/bytecodeV4.ts
```

Update:

```text
frontend/src/contractVersion.ts
frontend/src/types.ts
frontend/src/components/ActionPanel.tsx
frontend/src/components/MilestoneList.tsx
frontend/src/components/AdjustmentList.tsx
frontend/src/components/CreateAgreementForm.tsx
frontend/src/pages/DashboardPage.tsx
```

### V4 Default Deployment

`CreateAgreementForm` should deploy V4 by default.

Add review period handling:

- Default review period: `3 days`.
- May be hidden as default or shown as an advanced setting.
- Pass review period to V4 constructor.

### Version Compatibility

- V1: original milestone workflow, no paid adjustments, no review/dispute UI.
- V2: paid adjustments, no refund grace / no review dispute UI unless existing implementation says otherwise.
- V3: paid adjustments + 24-second refund grace, no review/dispute UI.
- V4: paid adjustments + 24-second refund grace + review period + disputes + mutual settlement.

### Milestone UI

For V4 submitted milestones, show:

```text
Submitted at: ...
Review deadline: submittedAt + reviewPeriod
```

Client actions during review period:

```text
Approve & release
Open dispute
```

Provider actions before review period expires:

```text
Waiting for client review
Auto-release available at: ...
```

Provider actions after review period expires:

```text
Claim payment after review period
```

For disputed milestones, show:

```text
Disputed
Reason: ...
Opened at: ...
Settlement proposal section
```

### Adjustment UI

Apply the same workflow to submitted V4 adjustments:

```text
Approve adjustment
Open adjustment dispute
Claim adjustment after review period
Propose/accept/cancel adjustment settlement
```

### Settlement UI

For disputed item, show a settlement card:

- Provider amount input in ETH.
- Client refund amount calculated automatically.
- Optional note field.
- Buttons:
  - Propose settlement
  - Accept settlement, if counterparty proposed it
  - Cancel proposal, if current user created it

Recommended UI copy:

```text
Settlement divides the locked amount for this item. The provider receives the provider share; the rest is refunded to the client. Both parties must agree before funds move.
```

### Public On-Chain Data Warning

When opening a dispute or proposing settlement, show warning:

```text
This text is stored on-chain and will be public. Do not include private credentials, confidential files, personal data, or private client information. Use public-safe summaries, hashes, or references.
```

### ActionPanel Updates

`ActionPanel` should support V4-specific actions:

Milestones:

- dispute submitted milestone
- claim milestone after review
- propose milestone settlement
- accept milestone settlement
- cancel milestone settlement

Adjustments:

- dispute submitted adjustment
- claim adjustment after review
- propose adjustment settlement
- accept adjustment settlement
- cancel adjustment settlement

Preserve existing V2/V3 paid-adjustment actions.

### Data Reads

`DashboardPage` should read V4-specific data:

- `reviewPeriod`
- milestone dispute info
- milestone settlement proposals
- milestone review deadlines
- adjustment dispute info
- adjustment settlement proposals
- adjustment review deadlines

Do this efficiently with `useReadContracts` batching where possible.

---

## Backend Requirements

Backend changes are minimal.

Update `Agreement.contractVersion` validation and TypeScript types to support `4`.

Ensure `POST /agreements` and `PATCH /agreements/:contractAddress` accept and persist `contractVersion = 4`.

No backend dispute storage is required in Round 4. The source of truth remains the contract.

Do not implement AI dispute evidence storage yet.

---

## Tests Required

Add:

```text
test/DealLockV4.ts
```

Required test coverage:

1. V4 deploys and `contractVersion()` returns `4`.
2. Constructor stores `reviewPeriod`.
3. Constructor rejects too-short review period.
4. Constructor rejects too-long review period.
5. Original milestone workflow still works.
6. Client can approve submitted milestone during review period.
7. Client can dispute submitted milestone during review period.
8. Client cannot dispute pending milestone.
9. Client cannot dispute after review period expires.
10. Non-client cannot dispute milestone.
11. Provider cannot auto-release before review period expires.
12. Provider can auto-release after review period expires.
13. Non-provider cannot auto-release milestone.
14. Client cannot refund a submitted milestone.
15. Either party can propose milestone settlement when disputed.
16. Invalid milestone settlement provider amount greater than milestone amount reverts.
17. Proposal creator cannot accept their own milestone settlement.
18. Counterparty can accept milestone settlement.
19. Milestone settlement correctly splits funds between provider and client.
20. Milestone settlement updates `releasedAmount` and `refundedAmount`.
21. Proposal creator can cancel milestone settlement proposal.
22. Cannot settle milestone twice.
23. Disputed milestone blocks completion until settled.
24. Provider auto-release can complete agreement when all work resolved.
25. Adjustment review/dispute/auto-release flow works.
26. Adjustment settlement correctly splits funds and updates adjustment accounting.
27. Multiple adjustments and milestones can resolve independently.
28. Agreement completion requires milestones and adjustments to be terminal.
29. V1/V2/V3 tests remain passing.

All tests should pass:

```text
npx hardhat test
```

---

## Documentation Updates

Update:

```text
docs/state.md
README.md
```

`docs/state.md` must be updated in two ways:

1. Update the overall project state to reflect V4, review period, disputes, settlement, V4 default deployment, and V1/V2/V3 compatibility.
2. Add a new Round 4 entry in the Implementation Rounds section with:
   - status
   - goal
   - contract changes
   - frontend changes
   - backend changes
   - tests
   - out-of-scope items

`README.md` should explain:

- V1 vs V2 vs V3 vs V4 behavior.
- What the review period does.
- Why submitted work cannot be directly refunded.
- How disputes work.
- How mutual settlement splits payment.
- That Round 4 does not include AI arbitration yet.

---

## Acceptance Criteria

Round 4 is complete when:

- New contracts deploy as V4 by default.
- V1/V2/V3 contracts still load and work.
- V4 milestones support review period, dispute, auto-release, and mutual settlement.
- V4 adjustments support review period, dispute, auto-release, and mutual settlement.
- Client cannot directly refund submitted V4 work.
- Provider can claim payment after review period if client does not dispute.
- Disputed funds cannot move until both parties agree to settlement.
- Settlement can split funds between provider and client.
- The frontend clearly shows review deadlines and dispute/settlement states.
- The frontend warns that dispute/settlement text is public on-chain data.
- Backend stores `contractVersion = 4` for V4 agreements.
- `docs/state.md` and `README.md` are updated.
- Hardhat tests pass.

---

## Implementation Notes for Future AI Rounds

Round 4 intentionally creates the foundation for future AI-assisted dispute resolution.

Future rounds can add:

```text
Disputed item
  → evidence package uploaded off-chain
  → AI agent analyzes milestone terms, proof, complaint, and provider response
  → AI recommends split ratio
  → parties accept recommendation or binding AI mode executes signed resolution
```

Do not implement this yet.

For now, V4 should only support manual/mutual settlement.

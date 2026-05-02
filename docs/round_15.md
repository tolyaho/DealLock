# Round 15 — Deadline Grace Window and Client-Approved Deadline Extensions

## Status

Implemented locally; pending full PostgreSQL release-gate run

## Goal

Improve the deadline model for milestones and paid adjustments.

The current V3/V4/V5 behavior uses a short `REFUND_GRACE_PERIOD` mainly as a network-latency buffer. Round 15 changes this into a clearer product workflow:

- After a deadline passes, the provider gets a limited grace window.
- During this window, the provider may still submit work or request a deadline extension.
- The client cannot refund during the grace window.
- After the grace window closes, the provider can no longer submit or request an extension.
- A provider extension request does **not** block refund forever.
- Only explicit client acceptance changes the deadline.

No platform fees, arbitration, reputation, token swaps, or backend-controlled contract actions are added.

---

## Product Rule

For each pending milestone or funded adjustment:

```text
deadline
  → 30-minute grace window
      provider can still submit
      provider can request a deadline extension
      client cannot refund yet
  → deadline + 30 minutes
      provider can no longer submit
      provider can no longer request extension
      client can refund if no submission or accepted extension exists
```

If the provider requests an extension during the 30-minute window:

```text
The request itself does not block refund.

If the client accepts:
  the deadline is updated to the proposed new deadline.

If the client rejects or ignores:
  refund becomes available after deadline + 30 minutes.

If the client refunds first:
  the item becomes terminal and the extension request can no longer be accepted.
```

---

## Contract Versioning

Round 15 should introduce a new escrow contract version because it changes deadline/submission behavior.

Recommended new contract:

```text
contracts/DealLockMultiAssetV2.sol
contractVersion() returns 6
```

Recommended new factory:

```text
contracts/DealLockFactoryV3.sol
factoryVersion() returns 3
deploys DealLockMultiAssetV2
```

Rationale:

- Existing deployed V5 agreements must remain unchanged.
- Factory V2 is already tied to `DealLockMultiAsset`.
- Factory V3 becomes the preferred factory for new agreements.
- V6 remains V4/V5-compatible for escrow mechanics, but adds deadline extension functions and stricter post-grace submission behavior.

---

## New Constant

Replace the product meaning of the old 24-second refund grace period with a 30-minute deadline grace window.

Recommended:

```solidity
uint256 public constant DEADLINE_GRACE_PERIOD = 30 minutes;
```

For frontend/indexer compatibility, keep an alias getter:

```solidity
uint256 public constant REFUND_GRACE_PERIOD = DEADLINE_GRACE_PERIOD;
```

The meaning is now:

```text
refundAvailableAt = deadline + DEADLINE_GRACE_PERIOD
submissionClosesAt = deadline + DEADLINE_GRACE_PERIOD
extensionRequestClosesAt = deadline + DEADLINE_GRACE_PERIOD
```

---

## Submission Rule

### Milestones

Provider can submit a pending milestone only while:

```solidity
block.timestamp <= milestone.deadline + DEADLINE_GRACE_PERIOD
```

After that, submission is blocked.

Expected revert message:

```text
Submission window closed
```

### Adjustments

Provider can submit a funded adjustment only while:

```solidity
block.timestamp <= adjustment.deadline + DEADLINE_GRACE_PERIOD
```

After that, submission is blocked.

Expected revert message:

```text
Submission window closed
```

---

## Refund Rule

Refunds remain unavailable until the grace window closes.

### Milestones

Client can refund a pending milestone only when:

```solidity
block.timestamp >= milestone.deadline + DEADLINE_GRACE_PERIOD
```

### Adjustments

Client can refund a funded adjustment only when:

```solidity
block.timestamp >= adjustment.deadline + DEADLINE_GRACE_PERIOD
```

A pending extension request must not block this refund.

---

## Deadline Extension Requests

Add extension requests for both milestones and adjustments.

### Struct

```solidity
struct DeadlineExtensionRequest {
    bool active;
    address requester;
    uint256 requestedAt;
    uint256 proposedDeadline;
    string reason;
}
```

The `reason` is public on-chain text. The frontend must warn users not to include private or sensitive information.

---

## Milestone Extension Functions

```solidity
function requestMilestoneDeadlineExtension(
    uint256 milestoneId,
    uint256 proposedDeadline,
    string calldata reason
) external;

function acceptMilestoneDeadlineExtension(uint256 milestoneId) external;

function rejectMilestoneDeadlineExtension(uint256 milestoneId) external;

function cancelMilestoneDeadlineExtension(uint256 milestoneId) external;

function getMilestoneDeadlineExtensionRequest(
    uint256 milestoneId
) external view returns (DeadlineExtensionRequest memory);

function getMilestoneSubmissionClosesAt(
    uint256 milestoneId
) external view returns (uint256);
```

### Request rules

Provider only.

Allowed only when:

- agreement is funded
- milestone exists
- milestone state is `Pending`
- `block.timestamp <= milestone.deadline + DEADLINE_GRACE_PERIOD`
- `proposedDeadline > milestone.deadline`
- `reason` is non-empty

The request may replace an existing active request for the same milestone.

The request itself does not change the deadline.

### Accept rules

Client only.

Allowed only when:

- request is active
- milestone state is still `Pending`
- milestone has not been refunded, submitted, released, disputed, or settled
- `proposedDeadline > current deadline`

Effect:

- update `milestone.deadline = proposedDeadline`
- clear the active request
- emit acceptance event

After acceptance, refund/submission timing is based on the new deadline.

### Reject rules

Client only.

Allowed only when the request is active.

Effect:

- clear the active request
- deadline remains unchanged

### Cancel rules

Provider only.

Allowed only when the request is active.

Effect:

- clear the active request
- deadline remains unchanged

---

## Adjustment Extension Functions

```solidity
function requestAdjustmentDeadlineExtension(
    uint256 adjustmentId,
    uint256 proposedDeadline,
    string calldata reason
) external;

function acceptAdjustmentDeadlineExtension(uint256 adjustmentId) external;

function rejectAdjustmentDeadlineExtension(uint256 adjustmentId) external;

function cancelAdjustmentDeadlineExtension(uint256 adjustmentId) external;

function getAdjustmentDeadlineExtensionRequest(
    uint256 adjustmentId
) external view returns (DeadlineExtensionRequest memory);

function getAdjustmentSubmissionClosesAt(
    uint256 adjustmentId
) external view returns (uint256);
```

### Request rules

Provider only.

Allowed only when:

- agreement is funded
- adjustment exists
- adjustment state is `Funded`
- `block.timestamp <= adjustment.deadline + DEADLINE_GRACE_PERIOD`
- `proposedDeadline > adjustment.deadline`
- `reason` is non-empty

The request may replace an existing active request for the same adjustment.

The request itself does not change the deadline.

### Accept rules

Client only.

Allowed only when:

- request is active
- adjustment state is still `Funded`
- adjustment has not been submitted, refunded, released, disputed, settled, or cancelled
- `proposedDeadline > current deadline`

Effect:

- update `adjustment.deadline = proposedDeadline`
- clear the active request
- emit acceptance event

### Reject rules

Client only.

Allowed only when the request is active.

Effect:

- clear the active request
- deadline remains unchanged

### Cancel rules

Provider only.

Allowed only when the request is active.

Effect:

- clear the active request
- deadline remains unchanged

---

## Events

Add milestone events:

```solidity
event MilestoneDeadlineExtensionRequested(
    uint256 indexed milestoneId,
    uint256 oldDeadline,
    uint256 proposedDeadline,
    string reason
);

event MilestoneDeadlineExtensionAccepted(
    uint256 indexed milestoneId,
    uint256 oldDeadline,
    uint256 newDeadline
);

event MilestoneDeadlineExtensionRejected(
    uint256 indexed milestoneId
);

event MilestoneDeadlineExtensionCancelled(
    uint256 indexed milestoneId
);
```

Add adjustment events:

```solidity
event AdjustmentDeadlineExtensionRequested(
    uint256 indexed adjustmentId,
    uint256 oldDeadline,
    uint256 proposedDeadline,
    string reason
);

event AdjustmentDeadlineExtensionAccepted(
    uint256 indexed adjustmentId,
    uint256 oldDeadline,
    uint256 newDeadline
);

event AdjustmentDeadlineExtensionRejected(
    uint256 indexed adjustmentId
);

event AdjustmentDeadlineExtensionCancelled(
    uint256 indexed adjustmentId
);
```

---

## Frontend Changes

### Version handling

Update:

```text
ContractVersion = 1 | 2 | 3 | 4 | 5 | 6
```

Rules:

- V1: old milestone-only ETH flow
- V2: paid adjustments
- V3: deadline grace
- V4: review/dispute/settlement
- V5: multi-asset V4-compatible flow
- V6: V5 + 30-minute deadline grace + deadline extension requests

Unknown future versions greater than 6 may be treated as latest known only if compatible.

### ABI

Add:

```text
frontend/src/contractV6.ts
```

Generated from `DealLockMultiAssetV2`.

V6 can still reuse V4-compatible escrow paths conceptually, but extension functions should be typed in the V6 ABI.

### Create flow

Preferred order for new agreements:

```text
Factory V3 configured → deploy V6 DealLockMultiAssetV2
else Factory V2 configured → deploy V5 DealLockMultiAsset
else ETH selected + Factory V1 configured → deploy V4-compatible ETH agreement
else ETH selected → direct V4 fallback
else ERC-20 selected → block creation
```

ERC-20 agreements should require Factory V2 or Factory V3.

Factory V3 should be preferred when configured.

### UI behavior

For provider:

- show “Request deadline extension” for pending milestones and funded adjustments before `deadline + 30 minutes`
- show “Submit” until `deadline + 30 minutes`
- after `deadline + 30 minutes`, hide/disable submit and extension request actions

For client:

- show active extension request cards
- allow Accept / Reject
- make clear that accepting changes the deadline
- make clear that ignoring the request does not block refund
- after `deadline + 30 minutes`, show refund if item is still pending/funded

For both parties:

- show:
  - original/current deadline
  - submission closes at
  - refund available at
  - active extension request, if any

---

## Backend / Indexer Changes

### Prisma/API

Update contract version validation to allow:

```text
1 | 2 | 3 | 4 | 5 | 6
```

No new database table is required unless we want off-chain extension summaries. The source of truth is on-chain.

### Indexer

Update event ABIs to include V6 extension events.

Decode and store extension events as `ChainEvent` rows.

Suggested event mappings:

```text
MilestoneDeadlineExtensionRequested
MilestoneDeadlineExtensionAccepted
MilestoneDeadlineExtensionRejected
MilestoneDeadlineExtensionCancelled
AdjustmentDeadlineExtensionRequested
AdjustmentDeadlineExtensionAccepted
AdjustmentDeadlineExtensionRejected
AdjustmentDeadlineExtensionCancelled
```

Activity feed should display these events in human-readable form.

Notification emails may be sent for extension request and extension acceptance/rejection/cancellation, but they must not include long sensitive reason text.

### Factory indexing

Add support for Factory V3 config.

Suggested env vars:

```text
FACTORY_V3_CONTRACTS
VITE_DEALLOCK_FACTORY_V3_SEPOLIA
VITE_DEALLOCK_FACTORY_V3_HARDHAT
```

Factory V3 event may match Factory V2’s payment-aware `AgreementCreated` shape, with `factoryVersion() == 3` and deployed contract version `6`.

---

## Tests

Add a new Solidity test file:

```text
test/DealLockMultiAssetV2_DeadlineExtensions.ts
```

Required tests:

1. `contractVersion()` returns `6`.
2. `DEADLINE_GRACE_PERIOD()` returns `1800`.
3. `REFUND_GRACE_PERIOD()` returns `1800` as compatibility alias.
4. Provider can submit a milestone before deadline.
5. Provider can submit a milestone after deadline but before deadline + 30 minutes.
6. Provider cannot submit a milestone after deadline + 30 minutes.
7. Client cannot refund a pending milestone during the 30-minute window.
8. Client can refund a pending milestone at/after deadline + 30 minutes.
9. Provider can request milestone deadline extension during grace window.
10. Provider cannot request milestone deadline extension after grace window.
11. Milestone extension request does not block refund after grace window.
12. Client can accept milestone extension request and update deadline.
13. After accepted milestone extension, refund uses the new deadline + grace period.
14. Client can reject milestone extension request.
15. Provider can cancel milestone extension request.
16. Cannot accept own request as provider.
17. Cannot request extension with empty reason.
18. Cannot request extension with proposed deadline <= current deadline.
19. Cannot request/accept extension after milestone becomes submitted/refunded/released/disputed/settled.
20. Same lifecycle tests for funded adjustments.
21. Adjustment extension request does not block refund.
22. Client can accept adjustment extension and update adjustment deadline.
23. Existing V5 ETH funding/release/refund behavior still works where deadline rules are unchanged.
24. Existing ERC-20 approve + fund behavior still works.
25. Factory V3 deploys V6 agreements with correct payment metadata.
26. Factory V2 regression: existing V5 factory behavior remains unchanged.
27. V1-V5 regression tests remain passing.

---

## Documentation Updates

Update:

```text
docs/state.md
docs/public_beta_checklist.md
README.md
frontend copy near deadlines/refunds
```

Replace stale wording:

```text
24-second refund grace period
```

with version-aware wording:

```text
V3-V5 use a short refund grace period.
V6 uses a 30-minute deadline grace window with client-approved extension requests.
```

Update intentional scope limits:

```text
No milestone revision except client-approved deadline extensions in V6.
Descriptions and amounts remain fixed.
```

---

## Implementation Instructions

Implement Round 15 from this file.

Main changes:

1. Add `DealLockMultiAssetV2.sol` with `contractVersion() == 6`.
2. Add `DEADLINE_GRACE_PERIOD = 30 minutes` and keep `REFUND_GRACE_PERIOD` as an alias returning the same value.
3. Provider can submit pending milestones / funded adjustments only until `deadline + DEADLINE_GRACE_PERIOD`.
4. Client can refund only after `deadline + DEADLINE_GRACE_PERIOD`.
5. Add provider deadline extension requests for milestones and adjustments.
6. Extension requests must not block refund by themselves.
7. Only client acceptance updates the deadline.
8. Add `DealLockFactoryV3.sol` that deploys `DealLockMultiAssetV2` and keeps Factory V2-style payment metadata.
9. Update frontend contract version handling to support version 6.
10. Prefer Factory V3 for new agreements when configured; otherwise fall back to Factory V2/V1/direct V4 exactly as before.
11. Add V6 UI for extension request, accept, reject, cancel, and display submission/refund timing.
12. Update backend validation/indexer/activity to support contractVersion 6 and new extension events.
13. Add full Solidity tests for V6 deadline extension behavior and Factory V3.
14. Update `README.md`, `docs/state.md`, `docs/public_beta_checklist.md`, and keep this file at `docs/round_15.md`.
15. Do not add fees, arbitration, Google OAuth, reputation, token swaps, proxy upgrades, or backend-controlled contract actions.

Run:

```bash
npm run lint:contracts
npx hardhat compile
npx hardhat test
cd backend && npm run build
cd backend && npm test
cd backend && npm run test:indexer
cd frontend && npm run build
npm run release:check
```

---

## Out of Scope

- No amount changes
- No description changes
- No free revision workflow
- No platform fees
- No AI arbitration
- No third-party arbitration
- No reputation system
- No backend authority over deadlines
- No backend-controlled contract actions
- No token swaps
- No gasless permit flow
- No proxy upgrades

Only the client’s on-chain acceptance can extend a deadline.

# DealLock Round 16 — Revision Requests, Provider Deadline Requests, and Paid Adjustment Separation

Generated: 2026-05-01

## Goal

Round 16 refines the post-submission workflow so that DealLock distinguishes clearly between three different cases:

1. **Approval** — the client accepts the submitted milestone and the provider is paid.
2. **Paid adjustment / change order** — the client accepts the milestone but wants additional extra-scope work.
3. **Revision request** — the client does not accept the submitted work yet and asks the provider to fix issues within the original scope.

The key product rule is:

> Paid adjustments are not revisions. A paid adjustment means the original milestone is approved and the client is adding extra paid scope.

For unsatisfactory submitted work, the system should support multiple cooperative revision rounds before escalating to a real dispute.

---

## Current Problem

The current contract has this milestone flow:

```text
Pending → Submitted → Released
Pending → Refunded
Submitted → Disputed → Settled
```

This is too coarse for real service work because a submitted milestone is often not simply accepted or escalated into a dispute. The more natural workflow is:

```text
Provider submits work
Client asks for fixes
Provider agrees to fix
Provider resubmits
Client reviews again
```

Right now, `Disputed` is doing two different jobs:

- cooperative revision request;
- actual disagreement / bad-case dispute.

Round 16 separates those cases.

---

## Product Decision

### Paid adjustments

Paid adjustments mean:

> “The submitted milestone is acceptable, but I want extra work beyond the original scope.”

Therefore, in the normal UX, the client should approve the milestone first, then create a paid adjustment.

Recommended flow:

```text
Submitted milestone
↓
Client approves milestone
↓
Provider receives original milestone payment
↓
Client requests paid adjustment / change order
↓
Provider accepts adjustment
↓
Client funds adjustment
↓
Provider delivers extra work
```

This avoids mixing original-scope fixes with extra paid work.

### Revision requests

A revision request means:

> “The submitted work does not satisfy the original milestone yet, but the client is giving the provider a chance to fix it.”

Recommended flow:

```text
Pending
  ↓ provider submits
Submitted
  ↓ client requests fixes during review period
RevisionRequested
  ↓ provider accepts revision request
Pending
  ↓ provider resubmits
Submitted
```

This can happen multiple times.

### Bad-case disputes

A bad-case dispute happens when the provider does not agree with the client’s requested fixes.

Recommended flow:

```text
Submitted
  ↓ client requests fixes
RevisionRequested
  ↓ provider rejects revision request
Disputed
  ↓ mutual settlement / AI-assisted settlement path
Settled
```

The provider should not be forced into an unpaid revision loop forever. If the provider believes the work is acceptable, they can reject the revision request and escalate to the dispute path.

---

## Deadline Decision

The provider may ask for a new revision deadline, but the client chooses the actual deadline.

This means:

- the provider can submit an on-chain request like “I need until May 12 because the requested fix is larger than expected”; 
- this request should be visible in the UI and event history;
- the request itself must **not** update the milestone deadline;
- only the client can set/update the active revision deadline.

Product rule:

> Provider can request a deadline. Client decides the final deadline.

Recommended flow:

```text
Client requests fixes with proposed revision deadline
↓
Provider can accept immediately

OR

Provider asks for a different deadline
↓
Client either keeps the original deadline or sets a new one
↓
Provider accepts revision request
↓
Milestone returns to Pending with the client-selected deadline
```

---

## State Machine Update

### Current milestone states

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

### Round 16 target milestone states

Add a cooperative revision state:

```solidity
enum MilestoneState {
    Pending,            // 0
    Submitted,          // 1
    RevisionRequested,  // 2
    Released,           // 3 — terminal
    Refunded,           // 4 — terminal
    Disputed,           // 5
    Settled             // 6 — terminal
}
```

Important migration note: changing enum order can affect frontend state decoding and tests. Since the contract is deployed per agreement and this is a new version, it is acceptable for new deployments, but the frontend must be updated to read the V6 enum order.

Alternative safer enum migration:

```solidity
enum MilestoneState {
    Pending,            // 0
    Submitted,          // 1
    Released,           // 2
    Refunded,           // 3
    Disputed,           // 4
    Settled,            // 5
    RevisionRequested   // 6
}
```

This preserves existing numeric values and appends the new state. Prefer this if the frontend currently assumes old enum indexes.

Recommended implementation choice for Round 16:

> Append `RevisionRequested` at the end to minimize compatibility risk.

---

## New Storage

Add a revision info struct.

```solidity
struct RevisionInfo {
    bool exists;
    address requestedBy;
    string reason;
    uint256 requestedAt;
    uint256 revisionDeadline;
    uint256 revisionRound;
    bool providerDeadlineRequestExists;
    uint256 providerRequestedDeadline;
    string providerDeadlineReason;
    uint256 providerDeadlineRequestedAt;
}
```

Add mapping:

```solidity
mapping(uint256 => RevisionInfo) private _milestoneRevisions;
```

Add optional revision counter per milestone.

Simplest approach:

```solidity
mapping(uint256 => uint256) public milestoneRevisionCount;
```

Better approach:

```solidity
struct Milestone {
    string description;
    uint256 amount;
    uint256 deadline;
    string proof;
    uint256 submittedAt;
    MilestoneState state;
    uint256 revisionCount;
}
```

Recommended for Round 16:

> Add `revisionCount` directly to `Milestone` because it belongs to milestone state.

---

## New Events

Add events for the cooperative revision workflow.

```solidity
event MilestoneRevisionRequested(
    uint256 indexed milestoneId,
    uint256 indexed revisionRound,
    string reason,
    uint256 revisionDeadline
);

event MilestoneRevisionDeadlineRequested(
    uint256 indexed milestoneId,
    uint256 indexed revisionRound,
    uint256 requestedDeadline,
    string reason
);

event MilestoneRevisionDeadlineUpdated(
    uint256 indexed milestoneId,
    uint256 indexed revisionRound,
    uint256 newDeadline
);

event MilestoneRevisionAccepted(
    uint256 indexed milestoneId,
    uint256 indexed revisionRound,
    uint256 finalDeadline
);

event MilestoneRevisionRejected(
    uint256 indexed milestoneId,
    uint256 indexed revisionRound,
    string reason
);
```

These events are important for the DealLock activity feed and future AI dispute evidence.

---

## New Read Functions

Add frontend-friendly getters:

```solidity
function getMilestoneRevision(uint256 milestoneId) external view returns (RevisionInfo memory);

function canRequestMilestoneRevision(uint256 milestoneId) external view returns (bool);

function canProviderAcceptRevision(uint256 milestoneId) external view returns (bool);
```

Expected behavior:

- `canRequestMilestoneRevision` returns true when milestone is `Submitted` and review period has not expired.
- `canProviderAcceptRevision` returns true when milestone is `RevisionRequested`.

---

## New Write Functions

### 1. Client requests fixes

```solidity
function requestMilestoneRevision(
    uint256 milestoneId,
    string calldata reason,
    uint256 revisionDeadline
) external onlyClient inState(AgreementState.Funded);
```

Requirements:

```solidity
_checkMilestoneId(milestoneId);
Milestone storage m = milestones[milestoneId];
require(m.state == MilestoneState.Submitted, "Milestone not submitted");
require(bytes(reason).length > 0, "Empty reason");
require(block.timestamp <= m.submittedAt + reviewPeriod, "Review period expired");
require(revisionDeadline > block.timestamp, "Deadline must be future");
```

Effects:

```solidity
m.state = MilestoneState.RevisionRequested;
_milestoneRevisions[milestoneId] = RevisionInfo({ ... });
```

Notes:

- This pauses provider auto-release because `claimMilestoneAfterReview` requires `Submitted`.
- This does not release or refund money.
- This does not modify `releasedAmount` or `refundedAmount`.

---

### 2. Provider asks for a different revision deadline

```solidity
function requestRevisionDeadline(
    uint256 milestoneId,
    uint256 requestedDeadline,
    string calldata reason
) external onlyProvider inState(AgreementState.Funded);
```

Requirements:

```solidity
_checkMilestoneId(milestoneId);
Milestone storage m = milestones[milestoneId];
require(m.state == MilestoneState.RevisionRequested, "Revision not requested");
require(requestedDeadline > block.timestamp, "Deadline must be future");
require(bytes(reason).length > 0, "Empty reason");
```

Effects:

```solidity
RevisionInfo storage r = _milestoneRevisions[milestoneId];
r.providerDeadlineRequestExists = true;
r.providerRequestedDeadline = requestedDeadline;
r.providerDeadlineReason = reason;
r.providerDeadlineRequestedAt = block.timestamp;
```

Important:

> This function does not update the actual milestone deadline. It only records the provider's request.

---

### 3. Client sets the revision deadline

```solidity
function setRevisionDeadline(
    uint256 milestoneId,
    uint256 newDeadline
) external onlyClient inState(AgreementState.Funded);
```

Requirements:

```solidity
_checkMilestoneId(milestoneId);
Milestone storage m = milestones[milestoneId];
require(m.state == MilestoneState.RevisionRequested, "Revision not requested");
require(newDeadline > block.timestamp, "Deadline must be future");
```

Effects:

```solidity
_milestoneRevisions[milestoneId].revisionDeadline = newDeadline;
```

Important:

> The client chooses the final active revision deadline. The client may choose the provider's requested deadline, a shorter deadline, a longer deadline, or keep the original revision deadline.

---

### 4. Provider accepts the revision request

```solidity
function acceptMilestoneRevision(
    uint256 milestoneId
) external onlyProvider inState(AgreementState.Funded);
```

Requirements:

```solidity
_checkMilestoneId(milestoneId);
Milestone storage m = milestones[milestoneId];
require(m.state == MilestoneState.RevisionRequested, "Revision not requested");
RevisionInfo storage r = _milestoneRevisions[milestoneId];
require(r.exists, "No revision request");
require(r.revisionDeadline > block.timestamp, "Revision deadline expired");
```

Effects:

```solidity
m.revisionCount += 1;
m.deadline = r.revisionDeadline;
m.proof = "";
m.submittedAt = 0;
m.state = MilestoneState.Pending;
delete _milestoneSettlementProposals[milestoneId];
```

Important:

- The milestone returns to `Pending`.
- The provider can submit again before the new deadline rules allow submission.
- The old proof is cleared from the main milestone view, but the event history keeps previous proofs.

---

### 5. Provider rejects the revision request

```solidity
function rejectMilestoneRevision(
    uint256 milestoneId,
    string calldata reason
) external onlyProvider inState(AgreementState.Funded);
```

Requirements:

```solidity
_checkMilestoneId(milestoneId);
Milestone storage m = milestones[milestoneId];
require(m.state == MilestoneState.RevisionRequested, "Revision not requested");
require(bytes(reason).length > 0, "Empty reason");
```

Effects:

```solidity
m.state = MilestoneState.Disputed;
_milestoneDisputes[milestoneId] = DisputeInfo({
    exists: true,
    openedBy: msg.sender,
    reason: reason,
    openedAt: block.timestamp
});
```

Important:

> `Disputed` now means the cooperative fix path failed. This is the bad-case state for settlement and future AI-assisted resolution.

---

## Changes to Existing Functions

### `submitMilestone`

Round 16 should make late-submission behavior explicit. If Round 15 has already introduced late submission blocking and extension windows, preserve that behavior. If not, add a deadline check now:

```solidity
require(block.timestamp <= m.deadline, "Milestone deadline passed");
```

However, if Round 15 allows a short grace/extension window, use that existing helper instead of a hard deadline check.

### `disputeMilestone`

The current `disputeMilestone` should no longer be the normal “request fixes” function.

Recommended options:

1. Keep `disputeMilestone` for direct escalation only.
2. Restrict UI usage and make the frontend call `requestMilestoneRevision` first.
3. Optionally rename in a future version to `escalateMilestoneDispute`.

For Round 16, safest contract approach:

- keep `disputeMilestone` for compatibility;
- add `requestMilestoneRevision` as the preferred path;
- update the frontend so normal client feedback uses `requestMilestoneRevision`, not `disputeMilestone`.

### `claimMilestoneAfterReview`

No major change needed.

It already requires:

```solidity
m.state == MilestoneState.Submitted
```

So once a client requests a revision and the state becomes `RevisionRequested`, provider auto-claim is paused.

### `approveMilestone`

No major change needed.

It should continue to require:

```solidity
m.state == MilestoneState.Submitted
```

### `_tryCompleteAgreement`

Update terminal-state helper if enum changes.

`RevisionRequested` is not terminal.

### `_isMilestoneTerminal`

Should remain:

```solidity
return
    state == MilestoneState.Released ||
    state == MilestoneState.Refunded ||
    state == MilestoneState.Settled;
```

---

## Paid Adjustment UX Rule

Update frontend copy and button placement.

After a submitted milestone, show:

```text
Approve milestone
Request fixes
```

After a milestone is approved, show:

```text
Create paid adjustment / change order
```

Avoid showing “Create paid adjustment” as if it is the normal way to ask for fixes.

Recommended wording:

- “Request fixes” = original scope not satisfied yet.
- “Create paid adjustment” = extra scope beyond what was agreed.
- “Dispute” = provider rejected fixes or parties cannot agree.

---

## Frontend Requirements

### Milestone card

For a `Submitted` milestone, show:

- proof link;
- submitted timestamp;
- review deadline;
- approve button for client;
- request fixes button for client;
- auto-claim countdown for provider.

### Revision request state

For a `RevisionRequested` milestone, show:

- client feedback/reason;
- current revision deadline chosen by client;
- provider requested deadline, if any;
- provider deadline reason, if any;
- provider buttons:
  - accept revision request;
  - request different deadline;
  - reject and escalate dispute;
- client button:
  - update revision deadline.

### Pending after accepted revision

When provider accepts the revision request, the milestone goes back to `Pending` with the new deadline.

UI should show:

```text
Revision round N active
Deadline: <client-selected deadline>
Provider may resubmit proof
```

### Activity feed

Show events:

- revision requested;
- provider requested deadline change;
- client updated deadline;
- provider accepted revision;
- provider rejected revision.

This will be useful later for AI dispute context.

---

## Test Plan

Add tests for the new revision flow.

### 1. Client can request revision during review period

Flow:

```text
fund agreement
provider submits milestone 0
client requests revision
expect state == RevisionRequested
expect revision reason/deadline stored
```

### 2. Client cannot request revision after review period

Flow:

```text
provider submits milestone 0
time increase reviewPeriod + 1
client requests revision
expect revert "Review period expired"
```

### 3. Provider accepts revision and milestone returns to pending

Flow:

```text
provider submits milestone 0
client requests revision with new deadline
provider accepts revision
expect state == Pending
expect deadline == revisionDeadline
expect submittedAt == 0
expect revisionCount == 1
```

### 4. Provider can resubmit after accepting revision

Flow:

```text
provider accepts revision
provider submits new proof
expect state == Submitted
expect proof == new proof
```

### 5. Multiple revision rounds are possible

Flow:

```text
submit proof v1
client requests revision
provider accepts
submit proof v2
client requests revision again
provider accepts
submit proof v3
client approves
expect releasedAmount == milestone amount
expect revisionCount == 2
```

### 6. Provider can request a new deadline but cannot set it

Flow:

```text
client requests revision with deadline A
provider requests deadline B
expect stored providerRequestedDeadline == B
expect milestone deadline still unchanged
expect active revision deadline still A
```

### 7. Client can update revision deadline

Flow:

```text
client requests revision with deadline A
provider requests deadline B
client sets deadline C
provider accepts revision
expect milestone deadline == C
```

### 8. Provider rejects revision and milestone becomes disputed

Flow:

```text
client requests revision
provider rejects revision
expect milestone state == Disputed
expect dispute info exists
```

### 9. Provider cannot auto-claim while revision is requested

Flow:

```text
provider submits milestone
client requests revision
time increase reviewPeriod + 1
provider tries claimMilestoneAfterReview
expect revert "Milestone not submitted"
```

### 10. Paid adjustment remains separate from revision

Flow:

```text
provider submits milestone
client approves milestone
client requests adjustment
provider accepts adjustment
client funds adjustment
expect original milestone state == Released
expect adjustment state == Funded
```

---

## Non-Goals

Round 16 should not implement full AI arbitration yet.

Do not add:

- autonomous AI fund movement;
- external oracle-controlled settlement;
- binding AI arbitration;
- complex evidence upload format beyond events/proof/reason strings.

Round 16 should only prepare clean dispute states and history so AI-assisted settlement can be added later.

---

## Acceptance Criteria

Round 16 is complete when:

1. Client can request fixes during the review period.
2. Provider can accept fixes and return the milestone to `Pending`.
3. Provider can reject fixes and escalate the milestone to `Disputed`.
4. Multiple revision rounds are supported.
5. Provider can request a different deadline, but only the client can set the active revision deadline.
6. Provider cannot auto-claim while a revision request is active.
7. Paid adjustments are treated as extra scope after milestone approval, not as revisions.
8. Tests cover the full revision flow, deadline-request flow, and paid-adjustment separation.

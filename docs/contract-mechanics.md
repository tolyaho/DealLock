# Contract mechanics

A precise reference for how the DealLock escrow contracts behave. Everything here is drawn
from the Solidity in [`contracts/`](../contracts); where a rule differs by version it is
called out. For a narrative overview see
[`docs/project-overview.md`](./project-overview.md); for the architecture see
[`docs/architecture/`](./architecture).

> One contract instance = one agreement between one **client** and one **provider**. The
> contract custodies the payment asset and is the only thing that can move it.

## Versions at a glance

| | V4 `DealLockV4` | V5 `DealLockMultiAsset` | V6 `DealLockMultiAssetV2` |
|---|---|---|---|
| Milestone escrow, review, disputes, settlement | ✓ | ✓ | ✓ |
| `claimMilestoneAfterReview` (provider self-release) | ✓ | ✓ | ✓ |
| Payment asset | native ETH only | ETH **or** one fixed ERC-20 | ETH **or** one fixed ERC-20 |
| Refund / deadline grace | `REFUND_GRACE_PERIOD = 24s` | `24s` | `DEADLINE_GRACE_PERIOD = 30 min` |
| Submission deadline enforced | no (anytime while Pending) | no | yes (≤ deadline + 30 min) |
| Deadline-extension requests | — | — | ✓ |
| Milestone revisions | — | — | ✓ (`REVISION_RESPONSE_PERIOD = 3 days`) |

`DealLockFactoryV3` deploys V6; `DealLockFactoryV2` deploys V5; the legacy factory deploys a
V4-equivalent. New agreements should use Factory V3.

## Lifecycle & roles

Agreement state: `Proposed → Accepted → Funded → Completed`. (`Cancelled` is declared in the
enum but **no code path sets it** — there is no cancel function; copy should not promise
cancellation.)

| Action | Who | Effect |
|---|---|---|
| `acceptAgreement()` | provider | Proposed → Accepted |
| `fundAgreement()` | client | Accepted → Funded; requires the **full total** |
| `submitMilestone(id)` | provider | milestone Pending → Submitted |
| `approveMilestone(id)` | client | releases the milestone amount to the provider |
| `claimMilestoneAfterReview(id)` | provider | self-release after the review window closes with no dispute |
| `disputeMilestone(id)` | client | within the review window → Disputed |
| `refundExpiredMilestone(id)` | client | refund a still-Pending milestone after its deadline + grace |
| `requestMilestoneRevision(id)` (V6) | client | Submitted → RevisionRequested |
| `proposeMilestoneSettlement` / `acceptMilestoneSettlement` | either / counterparty | split disputed funds |

The agreement auto-completes once every milestone is terminal (Released / Refunded /
Settled).

## Funding

Funding is **all-at-once**: `fundAgreement()` requires `msg.value == totalAmount` for ETH, or
pulls the full ERC-20 total via `transferFrom`. `totalAmount` is the sum of milestone amounts
fixed at construction and is immutable. (Paid *adjustments* — optional extra scope — are
funded separately for their own amount.)

## Milestones are sequential

`submitMilestone` and `approveMilestone` both require every lower-indexed milestone to be
**Released or Settled** first (`_requirePreviousMilestonesReleased`). A later milestone can
never be worked or paid ahead of an earlier one. Refunds use a looser check (earlier
milestones only need to be *terminal*).

## Review window, disputes & settlement

- The review period is an **immutable constructor argument**, bounded `1 hour ≤ p ≤ 14 days`.
  There is **no fixed default** — each agreement sets its own.
- After submission the client may **approve** (pay now), **dispute** (within the window), or
  on V6 **request a revision**. If the client does nothing, the provider may
  `claimMilestoneAfterReview` once `block.timestamp > submittedAt + reviewPeriod`.
- A **disputed** milestone's funds are frozen. They move **only** by mutual settlement: one
  party calls `proposeMilestoneSettlement(providerAmount, note)` (with
  `providerAmount ≤ milestoneAmount`) and the **counterparty** accepts
  (`require(proposer != msg.sender)`). The accepted split pays the provider and refunds the
  remainder to the client.
- There is **no arbiter, no oracle, and no automatic/timeout resolution** of a dispute. If
  the two sides never agree, the disputed funds remain locked indefinitely. This is a
  deliberate non-goal: DealLock does not provide arbitration.

## Deadlines, grace & extensions

- **V4 / V5:** `REFUND_GRACE_PERIOD = 24 seconds` (two blocks). A client can
  `refundExpiredMilestone` only for a still-Pending milestone at or after `deadline + 24s`.
  Submission has no deadline check — the provider may submit anytime while Pending.
- **V6:** `DEADLINE_GRACE_PERIOD = 30 minutes` (and `REFUND_GRACE_PERIOD` aliases it).
  Submission must land within `deadline + 30 min`; after that the provider can no longer
  submit, and the client's refund becomes available.
- **Deadline extensions (V6 only):** the provider calls
  `requestMilestoneDeadlineExtension()`. The request alone does **not** change the deadline —
  only the client's `acceptMilestoneDeadlineExtension()` overwrites it.

## Revisions (V6 only)

On a Submitted milestone within the review window the client may
`requestMilestoneRevision()` (→ RevisionRequested). The provider can
`acceptMilestoneRevision()` (resets to Pending with a fresh deadline, clears the old proof)
or `rejectMilestoneRevision()` (→ Disputed). If the provider ignores a revision, the client
can `escalateMilestoneRevisionToDispute()` only after `REVISION_RESPONSE_PERIOD = 3 days`.

## Fees, withdrawals & assets

- **No fees anywhere.** On approval the full milestone amount transfers to the provider; a
  settlement splits the exact amount with no skim. There is no fee variable, recipient, or
  basis-points constant in any contract.
- **No unilateral withdrawal.** `receive()` and `fallback()` revert. Funds leave escrow only
  via approval, post-review claim, expired-milestone refund, or an accepted settlement —
  each gated by state and by `onlyClient` / `onlyProvider` (or counterparty) checks. There is
  no owner or admin role.
- **Payment assets.** V4 is native-ETH only. V5/V6 fix `paymentToken` at construction:
  `address(0)` = ETH, otherwise one ERC-20 (e.g. USDC, 6 decimals) for the whole agreement.
  Funding verifies the measured balance delta equals the amount, which rejects
  fee-on-transfer / rebasing tokens; `permit` is not used (funding is approve-then-transfer).

## Factory

`createAgreement(...)` deploys one escrow instance (recording `msg.sender` as the client),
registers it (`isDealLockAgreement`, per-client / per-provider lists), and emits
`AgreementCreated` for the indexer. Neither the factory nor the V6 bytecode deployer ever
holds funds, registers ownership, or controls a deployed agreement.

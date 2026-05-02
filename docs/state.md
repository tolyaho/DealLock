# DealLock — Project State

## Project Overview

DealLock is a milestone-based escrow dApp for digital freelance agreements. The product solves a specific problem in digital freelancing: clients and providers have no enforceable way to stage payments and deliveries without trusting a third-party platform. DealLock removes the platform middleman by deploying a smart contract that holds the selected payment asset in escrow and releases it only when the client explicitly approves each delivered milestone.

Every agreement is a unique deployed contract. Factory-created agreements are also recorded in a factory registry for discovery; direct legacy agreements remain standalone. There are no platform fees and no platform custody. The frontend is a React/Vite single-page app; the backend provides a wallet-signature account layer, multi-wallet account management, verified email identity, notification preferences, backend email transport, a backend-backed agreement registry that syncs across wallets and devices, and a known-contract event indexer for activity history and reliable notification emails.

**Core idea**: client and provider agree on a list of milestones off-chain, then formalize them in a deployed contract. Provider delivers sequentially; client approves (releases funds) or, if a deadline passes without delivery, claims a refund. The contract enforces the sequence — you cannot skip milestones, cherry-pick approvals, or bypass the state machine.

**Factory and on-chain registry (Rounds 8/10/15/17)**: new agreements prefer `DealLockFactoryV3` when configured. Factory V3 records every agreement in an on-chain registry, emits payment-aware `AgreementCreated` events, and deploys V6 `DealLockMultiAssetV2` contracts through a chunked bytecode deployer helper. If Factory V3 is not configured, the frontend falls back to Factory V2 for V5 multi-asset agreements, then legacy Factory V1 or direct V4 for native ETH only. Factories and deployer helpers do not hold funds, collect fees, or control any deployed agreement.

**Multi-asset payment layer (Rounds 10/15)**: Factory V2/V3 agreements support either native ETH (`paymentToken == address(0)`) or one fixed ERC-20 token per agreement. The frontend exposes only configured assets, currently native ETH and optional USDC addresses from env. ERC-20 funding uses approve + fund; ETH is still required for gas. The contract rejects fee-on-transfer/tax tokens via exact balance-delta checks and uses SafeERC20-style calls. Blockchain reads remain the source of truth for escrow state.

**Paid adjustments (V2+)**: after an agreement is funded, the client can propose extra paid work as change orders. Each adjustment has its own lifecycle, amount, deadline, and proof string. Adjustments are append-only and do not modify original milestones.

**Refund/deadline grace (V3+)**: V3-V5 use a 24-second refund grace window (`REFUND_GRACE_PERIOD = 24 seconds`) between a deadline passing and client refund availability. V6 changes the product behavior to a 30-minute `DEADLINE_GRACE_PERIOD`, keeps `REFUND_GRACE_PERIOD` as a compatibility alias, lets providers submit or request a deadline extension during the window, and allows refunds only after `deadline + DEADLINE_GRACE_PERIOD`. Extension requests do not block refund by themselves; only client acceptance updates a deadline.

**Review period, disputes, settlement, and cooperative revisions (V4/V5/V6)**: submitted milestone or adjustment work enters a review period. The client can approve or dispute during review; if the client takes no action, the provider can auto-release after review expires. Submitted work cannot be directly refunded. Disputed funds remain locked until one party proposes a provider/client split and the counterparty accepts it. Round 4 is manual/mutual only; no AI or third-party arbitration is implemented. Round 16 (V6) adds cooperative milestone revision requests: the client can request a revision during the review window, moving the milestone to `RevisionRequested` state. The provider can accept (returning the milestone to `Pending` with a new deadline and incrementing the revision count), negotiate the deadline, or reject (escalating to `Disputed`). Auto-release is blocked while a revision is pending, but Round 17 lets the client escalate an ignored revision request to `Disputed` after `REVISION_RESPONSE_PERIOD = 3 days`. Paid adjustments remain separate from the revision workflow.

**Identity model**:
```
DealLock Account = product identity and dashboard
Wallet           = blockchain authority
```
A DealLock account can have many linked wallets. A wallet can belong to only one account. All contract writes still require the exact wallet that holds the on-chain role.

**Email identity, indexed notifications, and activity (Rounds 5/7)**: accounts may add one verified email address for product notifications. Email verification tokens are hashed in the backend database, notification preferences are per-account, and agreements may store optional client/provider contact emails off-chain. Round 7 adds a backend event indexer for agreements already known to the backend registry; indexed on-chain events drive the private activity feed and become the primary notification source. The app-triggered notification endpoint remains as a fallback. Email never authorizes funds, contract actions, or account access.

**Known-contract indexing (Round 7/8/10/15/16/17)**: Round 7 added per-agreement event indexing for contracts known to the backend `Agreement` table. Round 8 added a Factory V1 indexer phase. Round 10 extends factory indexing to Factory V2 events and stores payment metadata (`paymentTokenAddress`, `paymentSymbol`, `paymentDecimals`, raw amounts) for activity and notification formatting. Round 15 adds Factory V3 discovery and V6 deadline-extension event decoding. Rounds 16/17 add V6 revision event decoding, including timeout escalation. Factory-created agreements are thus discovered without requiring the client/provider to manually sync them. Direct-deployed legacy agreements are still discovered via the Round 7 mechanism (frontend sync, signed-in manual load, localStorage migration).

**Target network**: Sepolia testnet (also supports local Hardhat for development).

**Stack**: Solidity 0.8.20 · React 19 · Vite 6 · wagmi 2 · viem 2 · TanStack Query 5 · React Router 7 · Node.js · Express 4 · Prisma 6 · PostgreSQL · GitHub Actions CI · Solhint

**Release gate (Round 13)**: GitHub Actions runs separate contracts, backend, indexer-integration, and frontend jobs on pull requests and pushes to `main`. Local public-beta verification is `npm run release:check`, which runs Solidity linting, Hardhat compile/tests, backend generation/build/PostgreSQL tests, the real indexer integration test against a Hardhat RPC, and the frontend build. PostgreSQL is required for the backend and indexer checks; blockchain reads remain the source of truth for escrow state.

---

## Smart Contracts

### Contract Versioning

| Contract | File | Version marker | Default for new agreements |
|---|---|---|---|
| DealLock | `contracts/DealLock.sol` | no `contractVersion()` (reverts) | No (legacy) |
| DealLockV2 | `contracts/DealLockV2.sol` | `contractVersion()` returns `2` | No (superseded) |
| DealLockV3 | `contracts/DealLockV3.sol` | `contractVersion()` returns `3` | No (superseded) |
| DealLockV4 | `contracts/DealLockV4.sol` | `contractVersion()` returns `4` | Legacy direct deploy |
| DealLockV5 | `contracts/DealLockV5.sol` | `contractVersion()` returns `4` | Legacy Factory V1 |
| DealLockMultiAsset | `contracts/DealLockMultiAsset.sol` | `contractVersion()` returns `5` | Factory V2 fallback |
| DealLockMultiAssetV2 | `contracts/DealLockMultiAssetV2.sol` | `contractVersion()` returns `6` | **Yes (via Factory V3)** |

V1 contracts remain fully functional and are read/written with the original ABI. The frontend calls `contractVersion()` on load — if it reverts, the contract is treated as V1. V1/V2/V3/V4 use their matching ABIs. V5 `DealLockMultiAsset` reuses `DEALLOCK_V4_ABI` for escrow workflow writes because the interface is V4-compatible. V5-specific reads use inline ABI fragments such as `paymentToken()`, and ERC-20 operations use the inline `ERC20_ABI` in `ActionPanel`. V6 `DealLockMultiAssetV2` uses `DEALLOCK_V6_ABI`, which extends the V4-compatible workflow ABI with deadline-extension reads/writes. Factory V1 agreements (`DealLockV5`) return `4` and are handled identically to direct `DealLockV4` deployments. Factory V2 agreements (`DealLockMultiAsset`) return `5`; Factory V3 agreements (`DealLockMultiAssetV2`) return `6`.

---

## Smart Contract: DealLockFactory

### File
`contracts/DealLockFactory.sol`

### Purpose
Canonical factory that deploys V4-compatible escrow agreements. Every created agreement is registered on-chain and announced via `AgreementCreated`. The backend indexer watches factory events for automatic agreement discovery.

### Event
```solidity
event AgreementCreated(
    address indexed agreement,
    address indexed client,
    address indexed provider,
    uint256 chainId,
    uint256 contractVersion,
    uint256 milestoneCount,
    uint256 totalAmount,
    uint256 reviewPeriod,
    bytes32 metadataHash
);
```

### Main write function
```solidity
function createAgreement(
    address provider,
    string[] calldata descriptions,
    uint256[] calldata amounts,
    uint256[] calldata deadlines,
    uint256 reviewPeriod,
    bytes32 metadataHash
) external returns (address agreement);
```
The caller becomes the `client` of the deployed `DealLockV5` contract.

### Registry storage
```solidity
address[] private _agreements;
mapping(address => bool) public isDealLockAgreement;
mapping(address => address[]) private _agreementsByClient;
mapping(address => address[]) private _agreementsByProvider;
```

### Read helpers
- `factoryVersion()` → `1`
- `agreementCount()`, `getAgreement(index)`, `getAgreements(offset, limit)`
- `getClientAgreementCount(client)`, `getClientAgreements(client, offset, limit)`
- `getProviderAgreementCount(provider)`, `getProviderAgreements(provider, offset, limit)`

### No admin powers
The factory has no owner, no pause, no fee recipient, no upgrade mechanism, and no ability to affect deployed agreements.

---

## Smart Contract: DealLockFactoryV2

### File
`contracts/DealLockFactoryV2.sol`

### Purpose
Payment-aware factory that deploys `DealLockMultiAsset` agreements. It preserves the Round 8 registry and discovery behavior while adding `paymentToken` to agreement creation and the `AgreementCreated` event.

### Event
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

### Main write function
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

The caller becomes the `client` of the deployed `DealLockMultiAsset` contract. `paymentToken == address(0)` means native ETH; any nonzero address means one fixed ERC-20 payment asset for that agreement.

### Read helpers
- `factoryVersion()` → `2`
- Registry helpers match Factory V1.

### No admin powers
Factory V2 has no owner, pause, token whitelist admin, fee recipient, upgrade mechanism, or ability to affect deployed agreements.

---

## Smart Contract: DealLockFactoryV3

### File
`contracts/DealLockFactoryV3.sol`

### Purpose
Preferred payment-aware factory that deploys V6 `DealLockMultiAssetV2` agreements through a `DealLockMultiAssetV2Deployer` helper. The deployer stores the V6 creation bytecode in chunk contracts so V6, the deployer, and Factory V3 stay below the 24,576-byte deployed-bytecode limit. Factory V3 keeps the Factory V2 payment metadata event shape and registry helpers while emitting `contractVersion = 6` and `factoryVersion() = 3`.

### Main write function
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

The caller becomes the `client` of the deployed V6 agreement. `paymentToken == address(0)` means native ETH; any nonzero address means one fixed ERC-20 payment asset for that agreement. Factory V3 is non-payable and rejects accidental ETH sent to `createAgreement`; escrow funding still happens on the deployed agreement contract.

### No admin powers
Factory V3 and the V6 deployer helper have no owner, pause, token whitelist admin, fee recipient, upgrade mechanism, or ability to affect deployed agreements after deployment.

---

## Smart Contract: DealLockMultiAsset (V5)

### File
`contracts/DealLockMultiAsset.sol`

### Purpose
V4-compatible escrow mechanics with a fixed payment asset per agreement. Native ETH agreements behave like V4. ERC-20 agreements require the client to approve the agreement contract before funding. `contractVersion()` returns `5`.

### Payment model
- `paymentToken == address(0)` → native ETH; funding functions require exact `msg.value`
- `paymentToken != address(0)` → ERC-20; funding functions require `msg.value == 0` and pull tokens with `transferFrom`
- Fee-on-transfer/tax tokens are rejected by exact balance-delta checks
- Transfer-bearing functions use a non-reentrancy guard
- `getContractBalance()` returns the current native/token balance held by the agreement

### Scope limits
No platform fees, ERC-20 swaps, fiat payments, gasless permit flow, admin-controlled token whitelist, proxy upgrades, backend-controlled actions, AI arbitration, or multi-party agreement support were added.

---

## Smart Contract: DealLockMultiAssetV2 (V6)

### File
`contracts/DealLockMultiAssetV2.sol`

### Purpose
V5 multi-asset escrow mechanics plus a clearer deadline model: pending milestones and funded adjustments have a 30-minute deadline grace window, providers can request client-approved deadline extensions during that window, and only client acceptance changes the deadline. `contractVersion()` returns `6`.

### Deadline model
- `DEADLINE_GRACE_PERIOD = 30 minutes`
- `REFUND_GRACE_PERIOD` remains as an alias returning the same value for frontend/indexer compatibility
- `submissionClosesAt = deadline + DEADLINE_GRACE_PERIOD`
- `refundAvailableAt = deadline + DEADLINE_GRACE_PERIOD`
- Provider extension requests do not block refund by themselves
- Only `acceptMilestoneDeadlineExtension` or `acceptAdjustmentDeadlineExtension` updates the deadline

### Extension request functions
- `requestMilestoneDeadlineExtension`
- `acceptMilestoneDeadlineExtension`
- `rejectMilestoneDeadlineExtension`
- `cancelMilestoneDeadlineExtension`
- `getMilestoneDeadlineExtensionRequest`
- `getMilestoneSubmissionClosesAt`
- `requestAdjustmentDeadlineExtension`
- `acceptAdjustmentDeadlineExtension`
- `rejectAdjustmentDeadlineExtension`
- `cancelAdjustmentDeadlineExtension`
- `getAdjustmentDeadlineExtensionRequest`
- `getAdjustmentSubmissionClosesAt`

### Revision request functions (Round 16)
- `requestMilestoneRevision` (client, during review window — moves milestone to `RevisionRequested`)
- `acceptMilestoneRevision` (provider — resets milestone to `Pending` with new deadline, increments `revisionCount`)
- `rejectMilestoneRevision` (provider — escalates to `Disputed`)
- `requestRevisionDeadline` (provider — proposes alternative revision deadline, stored only)
- `setRevisionDeadline` (client — updates active revision deadline)
- `escalateMilestoneRevisionToDispute` (client — after `REVISION_RESPONSE_PERIOD`, moves an ignored revision request to `Disputed`)
- `getMilestoneRevision` (returns `RevisionInfo` struct)
- `getMilestoneRevisionCount`
- `getMilestoneRevisionResponseDeadline`

### Milestone states (V6)
- `Pending(0)`, `Submitted(1)`, `Released(2)`, `Refunded(3)`, `Disputed(4)`, `Settled(5)`, `RevisionRequested(6)`

### Scope limits
No amounts, descriptions, milestone order, payment asset, dispute rules, settlement rules, fees, arbitration, OAuth, reputation, token swaps, proxy upgrades, or backend-controlled actions were added or changed.

---

## Smart Contract: DealLockV5 (factory deployment wrapper)

### File
`contracts/DealLockV5.sol`

### Purpose
Functionally identical to `DealLockV4` but accepts an explicit `_client` constructor argument. This allows `DealLockFactory` to deploy it without becoming the on-chain client. `contractVersion()` returns `4`; the frontend and backend indexer treat it identically to `DealLockV4`.

`DealLockV5` is **not** a new business-logic version — it is a factory-deployment wrapper. There are no new escrow mechanics, dispute flows, or protocol features compared to V4. The naming reflects the constructor difference only.

### Constructor difference from DealLockV4
```solidity
constructor(
    address _client,     // explicit client address (set by factory to msg.sender)
    address _provider,
    string[] memory descriptions,
    uint256[] memory amounts,
    uint256[] memory deadlines,
    uint256 _reviewPeriod
)
```

---

## Smart Contract: DealLock (V1)

### File
`contracts/DealLock.sol`

### Constructor
```solidity
constructor(
  address _provider,
  string[] memory descriptions,
  uint256[] memory amounts,
  uint256[] memory deadlines
)
```
The deploying address becomes the **client** (immutable). Provider address, milestone descriptions, amounts in wei, and deadlines (Unix timestamps) are fixed at deploy and cannot change. `totalAmount` is the sum of all milestone amounts; funding must match it exactly.

### State Variables

| Variable | Type | Description |
|---|---|---|
| `client` | `address immutable` | Party who deployed the contract |
| `provider` | `address immutable` | Party who receives payments |
| `totalAmount` | `uint256 immutable` | Sum of all milestone amounts |
| `fundedAmount` | `uint256` | Amount deposited by client |
| `releasedAmount` | `uint256` | Total paid out to provider so far |
| `refundedAmount` | `uint256` | Total returned to client so far |
| `agreementState` | `AgreementState` | Current phase of the agreement |
| `milestones` | `Milestone[]` | Array of milestone structs |

### Enums

**AgreementState**
- `Proposed` (0) — deployed, waiting for provider to accept
- `Accepted` (1) — provider confirmed terms, waiting for client to fund
- `Funded` (2) — client deposited total; milestone workflow active
- `Completed` (3) — all milestones resolved (released or refunded)
- `Cancelled` (4) — reserved (not triggered by current logic)

**MilestoneState**
- `Pending` (0) — not yet submitted by provider
- `Submitted` (1) — proof submitted, awaiting client approval
- `Released` (2) — client approved; funds transferred to provider
- `Refunded` (3) — deadline passed; client claimed refund

### Milestone Struct

```solidity
struct Milestone {
  string description;    // Deliverable specification
  uint256 amount;        // Payment in wei
  uint256 deadline;      // Submission deadline (Unix timestamp)
  string proof;          // On-chain evidence reference (link, hash, CID)
  uint256 submittedAt;   // Timestamp when provider submitted proof
  MilestoneState state;
}
```

### Functions

| Function | Caller | Required State | Description |
|---|---|---|---|
| `acceptAgreement()` | provider | Proposed | Transitions to Accepted |
| `fundAgreement()` | client | Accepted | Deposits exact `totalAmount` ETH; transitions to Funded |
| `submitMilestone(id, proof)` | provider | Funded | Attaches non-empty proof string; transitions milestone to Submitted |
| `approveMilestone(id)` | client | Funded | Releases that milestone's amount to provider; transitions milestone to Released |
| `refundExpiredMilestone(id)` | client | Funded | Refunds amount to client for any milestone whose deadline passed |
| `getMilestone(id)` | anyone | any | Returns full milestone struct |
| `getMilestoneCount()` | anyone | any | Returns number of milestones |
| `getContractBalance()` | anyone | any | Returns current ETH held |
| `isAgreementCompleted()` | anyone | any | Returns `true` if state == Completed |

### Sequential Enforcement

- **`_requirePreviousMilestonesReleased(id)`** — called before `submitMilestone`. Every milestone with index < `id` must be in state `Released`. Provider cannot submit milestone N until all prior milestones are approved.

- **`_requirePreviousMilestonesResolved(id)`** — called before `refundExpiredMilestone`. Every milestone with index < `id` must be in state `Released` or `Refunded`. Client cannot claim a refund on milestone N while an earlier milestone is still `Pending` or `Submitted`.

### Completion Check

After every `approveMilestone` or `refundExpiredMilestone`, `_tryCompleteAgreement()` evaluates whether `releasedAmount + refundedAmount == totalAmount`. If true, `agreementState` transitions to `Completed`.

### Events

```solidity
event AgreementAccepted(address indexed provider);
event AgreementFunded(address indexed client, uint256 amount);
event MilestoneSubmitted(uint256 indexed milestoneId, string proof);
event MilestoneReleased(uint256 indexed milestoneId, uint256 amount);
event MilestoneRefunded(uint256 indexed milestoneId, uint256 amount);
```

### Security Properties

- Role-based access via `onlyClient` and `onlyProvider` modifiers
- State machine enforced via `inState()` modifier
- ETH transfers use low-level `call` with success assertion
- State updated before external transfer (reentrancy safe)
- No admin key, no upgradeability, no platform wallet

---

## Smart Contract: DealLockV2 (V2)

### File
`contracts/DealLockV2.sol`

### V2 Additions Over V1

**New enum: `AdjustmentState`**
- `Proposed` (0) — client requested, provider has not accepted
- `Accepted` (1) — provider accepted, awaiting client funding
- `Funded` (2) — client funded, provider can submit proof
- `Submitted` (3) — provider submitted proof, awaiting client approval
- `Released` (4) — client approved, provider paid
- `Refunded` (5) — deadline passed, client refunded
- `Cancelled` (6) — unfunded adjustment cancelled by either party

**New struct: `Adjustment`**
```solidity
struct Adjustment {
  uint256 targetMilestoneId;
  string description;    // on-chain, publicly visible
  uint256 amount;
  uint256 deadline;
  string proof;          // on-chain, publicly visible
  uint256 submittedAt;
  AdjustmentState state;
}
```

**New accounting variables**: `adjustmentFundedAmount`, `adjustmentReleasedAmount`, `adjustmentRefundedAmount`

**New functions**

| Function | Caller | Description |
|---|---|---|
| `contractVersion()` | anyone | Returns `2` (pure) |
| `requestAdjustment(targetId, desc, amount, deadline)` | client | Creates Proposed adjustment |
| `acceptAdjustment(id)` | provider | Proposed → Accepted |
| `fundAdjustment(id)` | client | Accepted → Funded; msg.value must equal adjustment amount |
| `submitAdjustment(id, proof)` | provider | Funded → Submitted |
| `approveAdjustment(id)` | client | Submitted → Released; transfers amount to provider |
| `refundExpiredAdjustment(id)` | client | Funded → Refunded if deadline passed; returns amount to client |
| `cancelAdjustment(id)` | client or provider | Proposed/Accepted → Cancelled (no ETH transfer) |
| `getAdjustmentCount()` | anyone | Returns number of adjustments |
| `getAdjustment(id)` | anyone | Returns full adjustment data |

**Updated `_tryCompleteAgreement()`**: transitions to Completed only when `releasedAmount + refundedAmount == totalAmount` AND every adjustment is in state Released, Refunded, or Cancelled. Loops over `_adjustments` (O(n)) — acceptable at MVP scale.

**Security**: all V1 patterns preserved. Adjustment functions use checks-effects-interactions; state updated before ETH transfers. `cancelAdjustment` has no ETH transfer (no reentrancy risk). Provider cannot be funded before accepting; client cannot fund incorrect amount; client cannot refund a submitted adjustment.

**New events**: `AdjustmentRequested`, `AdjustmentAccepted`, `AdjustmentFunded`, `AdjustmentSubmitted`, `AdjustmentReleased`, `AdjustmentRefunded`, `AdjustmentCancelled`

---

## Smart Contract: DealLockV3 (V3)

### File
`contracts/DealLockV3.sol`

### V3 Additions Over V2

**New constant**
```solidity
uint256 public constant REFUND_GRACE_PERIOD = 24 seconds;
```
Public and readable by the frontend via `REFUND_GRACE_PERIOD()`.

**`contractVersion()` returns `uint256(3)`** (V2 returned `uint8(2)`; V3 uses `uint256` to match wagmi's bigint return type more naturally).

**Changed refund eligibility**

| Version | Milestone refund condition | Adjustment refund condition |
|---|---|---|
| V1 | `block.timestamp > deadline` | n/a |
| V2 | `block.timestamp > deadline` | `block.timestamp > deadline` |
| V3 | `block.timestamp >= deadline + 24` | `block.timestamp >= deadline + 24` |

**Removed hard deadline on submission**: `submitMilestone` and `submitAdjustment` no longer check `block.timestamp <= deadline`. The provider can submit while the state is still `Pending`/`Funded`, creating a clean race after `refundAvailableAt`: the first valid transaction mined wins.

**New helper functions**
- `getMilestoneRefundAvailableAt(id)` → `deadline + REFUND_GRACE_PERIOD`
- `getAdjustmentRefundAvailableAt(id)` → `deadline + REFUND_GRACE_PERIOD`
- `_refundAvailableAt(deadline)` (internal pure)

All other V2 behavior (adjustment lifecycle, completion logic, accounting variables, events, modifiers) is preserved unchanged.

---

## Smart Contract: DealLockV4 (V4)

### File
`contracts/DealLockV4.sol`

### V4 Additions Over V3

**`contractVersion()` returns `uint256(4)`**.

**Review period**
```solidity
uint256 public immutable reviewPeriod;
```
The constructor accepts `_reviewPeriod` and validates `1 hours <= _reviewPeriod <= 14 days`. The frontend uses a default review period of 3 days for new agreements, whether deployed through Factory V2 or through the legacy direct V4 fallback.

**Milestone states**
- V1/V2/V3 states remain: `Pending`, `Submitted`, `Released`, `Refunded`
- V4 adds `Disputed` and `Settled`
- Terminal states: `Released`, `Refunded`, `Settled`

**Adjustment states**
- V2/V3 states remain: `Proposed`, `Accepted`, `Funded`, `Submitted`, `Released`, `Refunded`, `Cancelled`
- V4 adds `Disputed` and `Settled`
- Terminal states: `Released`, `Refunded`, `Cancelled`, `Settled`

**Submitted work rule**
Submitted milestone or adjustment work cannot be directly refunded. The client can approve or dispute during the review period. If the review period expires with no dispute, the provider can call `claimMilestoneAfterReview(id)` or `claimAdjustmentAfterReview(id)`.

**Dispute and settlement state**
V4 stores public on-chain `DisputeInfo` and `SettlementProposal` records for milestones and adjustments. Either party can propose a settlement split while an item is disputed. The proposer cannot accept their own proposal. The counterparty acceptance transfers `providerAmount` to the provider and refunds the remainder to the client, then marks the item `Settled`.

**New milestone functions**
- `disputeMilestone(id, reason)`
- `claimMilestoneAfterReview(id)`
- `proposeMilestoneSettlement(id, providerAmount, note)`
- `acceptMilestoneSettlement(id)`
- `cancelMilestoneSettlement(id)`
- `getMilestoneReviewDeadline(id)`
- `getMilestoneDispute(id)`
- `getMilestoneSettlementProposal(id)`
- `canClaimMilestoneAfterReview(id)`

**New adjustment functions**
- `disputeAdjustment(id, reason)`
- `claimAdjustmentAfterReview(id)`
- `proposeAdjustmentSettlement(id, providerAmount, note)`
- `acceptAdjustmentSettlement(id)`
- `cancelAdjustmentSettlement(id)`
- `getAdjustmentReviewDeadline(id)`
- `getAdjustmentDispute(id)`
- `getAdjustmentSettlementProposal(id)`
- `canClaimAdjustmentAfterReview(id)`

**Completion logic**
V4 completes only when all original milestone value is resolved, every milestone is terminal, every adjustment is terminal, and all funded adjustment value is resolved. Proposed or accepted unfunded adjustments must be cancelled before completion.

---

## Test Suites

### V1: `test/DealLock.ts`
**Framework**: Mocha + Hardhat Toolbox (ethers.js) | **Tests**: 11  

Setup deploys a 3-milestone contract (1 ETH / 2 ETH / 3 ETH) with deadlines at current block + 100/200/300 seconds. Tests cover:

1. Initial deployment values are correct
2. Only provider can call `acceptAgreement`
3. Funding requires correct state and exact ETH amount
4. Provider can submit first milestone after funding
5. Sequential enforcement blocks submitting milestone 1 before milestone 0 is approved
6. Client approval releases the correct ETH to provider
7. Cannot approve a milestone that was not submitted
8. Client can refund an expired pending milestone
9. Cannot refund before deadline passes
10. Cannot refund milestone N while milestone N-1 is unresolved
11. Agreement reaches Completed state when all milestones are resolved

### V2: `test/DealLockV2.ts`
**Framework**: Mocha + Hardhat Toolbox (ethers.js) | **Tests**: 23

1. Preserves original V1 fields and milestone workflow
2. `contractVersion()` returns `2`
3. Client can request a paid adjustment attached to a submitted milestone
4. Non-client cannot request adjustment
5. Cannot request adjustment with invalid milestone id
6. Cannot request adjustment with zero amount
7. Cannot request adjustment with past deadline
8. Provider can accept a proposed adjustment
9. Non-provider cannot accept adjustment
10. Client can fund an accepted adjustment with exact ETH amount
11. Cannot fund adjustment before provider acceptance
12. Cannot fund adjustment with incorrect ETH amount
13. Provider can submit proof for a funded adjustment
14. Cannot submit adjustment before funding
15. Client can approve submitted adjustment and provider receives extra payment
16. Client can refund a funded adjustment that expired without submission
17. Cannot refund funded adjustment before deadline
18. Cannot refund adjustment after provider submitted proof
19. Either party can cancel a proposed or accepted unfunded adjustment
20. Cannot cancel a funded, submitted, released, or refunded adjustment
21. Multiple adjustments can exist and resolve independently
22. Agreement completes only after original milestones and all adjustments are terminal
23. DealLockV1 tests are unaffected (V1 contract still deploys and works)

### V3: `test/DealLockV3.ts`
**Framework**: Mocha + Hardhat Toolbox (ethers.js) | **Tests**: 16

1. `contractVersion()` returns `3`
2. `REFUND_GRACE_PERIOD` returns `24`
3. `getMilestoneRefundAvailableAt(id)` returns `deadline + 24`
4. Client cannot refund a pending milestone before the deadline
5. Client cannot refund a pending milestone exactly at the deadline
6. Client cannot refund during the 24-second grace period
7. Client can refund a pending milestone at `deadline + 24`
8. Provider can submit a milestone during the grace period
9. If provider submits during grace, client can no longer refund the milestone as pending
10. `getAdjustmentRefundAvailableAt(id)` returns `adjustment.deadline + 24`
11. Client cannot refund a funded adjustment during the grace period
12. Client can refund a funded adjustment at `deadline + 24`
13. Provider can submit a funded adjustment during the grace period
14. If provider submits during grace, client cannot refund the adjustment
15. DealLockV2 milestone and adjustment workflow still works unchanged (V2 has no grace period)
16. DealLockV1 contract still deploys and completes unchanged

### V4: `test/DealLockV4.ts`
**Framework**: Mocha + Hardhat Toolbox (ethers.js) | **Tests**: 29

1. `contractVersion()` returns `4`
2. Constructor stores and validates `reviewPeriod`
3. Original milestone workflow still works
4. Client can approve submitted work during review
5. Client can dispute submitted milestone or adjustment during review
6. Client cannot dispute pending work or dispute after review expires
7. Provider cannot auto-release before review expires
8. Provider can auto-release milestone or adjustment after review expires
9. Client cannot directly refund submitted work
10. Either party can propose settlement for disputed work
11. Settlement provider amount cannot exceed locked item amount
12. Proposal creator cannot accept their own proposal
13. Counterparty can accept settlement and split funds between provider/client
14. Settlement updates milestone and adjustment accounting
15. Proposal creator can cancel a settlement proposal
16. Settled items cannot be settled twice
17. Disputed items block completion until settled
18. Agreement completion requires all milestones and adjustments to be terminal
19. V1/V2/V3 contracts still deploy and work unchanged

**Total V1/V2/V3/V4: 79 tests pass** (11 V1 + 23 V2 + 16 V3 + 29 V4)

### Factory: `test/DealLockFactory.ts`
**Framework**: Mocha + Hardhat Toolbox (ethers.js) | **Tests**: 20

1. Factory deploys successfully
2. `factoryVersion()` returns `1`
3. `createAgreement` deploys a V4-compatible agreement
4. Created agreement has `client == caller`, not factory
5. Created agreement has correct provider
6. Created agreement has correct total amount and milestones
7. Created agreement has correct review period
8. `AgreementCreated` emits correct agreement, client, provider, chainId, version, milestoneCount, totalAmount, reviewPeriod, metadataHash
9. Factory records agreement in global registry
10. Factory records agreement by client
11. Factory records agreement by provider
12. Pagination helpers work
13. `isDealLockAgreement[agreement] == true`
14. Cannot create with zero provider
15. Cannot create with provider equal to client
16. Cannot create with empty milestones
17. Cannot create with mismatched milestone arrays
18. Cannot send ETH to factory `createAgreement` (non-payable)
19. Deployed agreement full workflow: provider accepts, client funds, provider submits, client approves
20. `DealLockV4` direct deployment still works and is not registered in factory

### Multi-Asset Payment: `test/DealLockMultiAsset.ts`
**Framework**: Mocha + Hardhat Toolbox (ethers.js) | **Tests**: 45

Covers native and ERC-20 funding, release, refund, review auto-release, mutual settlement, paid adjustments, accounting invariants, fee-on-transfer rejection, false-return ERC-20 rejection, and reentrancy resistance. Tests 44 and 45 were added in Round 10's post-implementation review: SafeERC20 false-return rejection on `_sendPayment`, and `fundAdjustment` rejection of insufficient ERC-20 allowance.

### Factory V2: `test/DealLockFactoryV2.ts`
**Framework**: Mocha + Hardhat Toolbox (ethers.js) | **Tests**: 17

Covers `factoryVersion() == 2`, native and ERC-20 agreement creation, payment-token event data, registry pagination/client/provider views, validation failures, no-ETH factory calls, fundable deployed agreements, and legacy Factory V1 regression.

### Security: `test/DealLockMultiAsset_Security.ts`
**Framework**: Mocha + Hardhat Toolbox (ethers.js) | **Tests**: 39

Added in Round 11. Covers seven categories: reentrancy attacks on ETH and ERC-20 payment paths (`MaliciousETHReceiver`), CEI ordering and failed-transfer full rollback (`BadReturnERC20`), double-action prevention on terminal items, settlement split invariants (0%/25%/50%/75%/100% for ETH and ERC-20), balance accounting invariants (`released + refunded + held == total` at every step), wrong-asset rejection (unrelated token, missing `msg.value`, overfunding, ERC-20 agreement with `msg.value`, fee-on-transfer in adjustment, wrong-token funding), and adjustment accounting invariants.

**Grand total through Round 11: 200 Solidity tests pass** (11 V1 + 23 V2 + 16 V3 + 29 V4 + 20 Factory V1 + 45 MultiAsset + 17 Factory V2 + 39 Security)

### V6 Deadline Extensions: `test/DealLockMultiAssetV2_DeadlineExtensions.ts`
**Framework**: Mocha + Hardhat Toolbox (ethers.js) | **Tests**: 15

Added in Round 15 and extended in Round 17. Covers `DEADLINE_GRACE_PERIOD = 30 minutes`, provider submission cutoff after grace period, client refund availability, milestone and adjustment deadline extension lifecycle (request, accept, reject, cancel), Factory V3 payment metadata, Factory V3 accidental-ETH rejection, ETH/ERC-20 payment regressions, and Factory V2 regression.

### V6 Revision Requests: `test/DealLockMultiAssetV2_RevisionRequests.ts`
**Framework**: Mocha + Hardhat Toolbox (ethers.js) | **Tests**: 16

Added in Round 16 and extended in Round 17. Covers the full cooperative revision lifecycle: client revision request during review; request blocked after review; provider accept (milestone returns to Pending with new deadline); resubmission after revision; multiple revision rounds with `revisionCount` tracking; provider alternative deadline request (stored only); client deadline update; provider rejection (escalates to Disputed); ignored-request timeout escalation by the client; direct dispute during V6 review; auto-claim blocked while revision active; settlement after rejection/escalation; paid adjustment separation; guards (empty reason, wrong state, provider-only deadline, bad deadline).

**Grand total: 231 Solidity tests pass** (11 V1 + 23 V2 + 16 V3 + 29 V4 + 20 Factory V1 + 45 MultiAsset + 17 Factory V2 + 39 Security + 15 V6 DeadlineExtensions + 16 V6 RevisionRequests)

### Static Analysis and Release Gates

- `npm run lint:contracts` runs Solhint against `contracts/**/*.sol` with a practical recommended-rule baseline.
- `npm run check:bytecode` reports deployed bytecode sizes for `DealLockMultiAssetV2`, `DealLockBytecodeChunk`, `DealLockMultiAssetV2Deployer`, `DealLockFactoryV3`, and the actual V6 creation-code chunks, failing if any exceed 24,576 bytes.
- `.solhintignore` excludes artifacts, cache, coverage, node modules, generated types, and archived files.
- `.github/workflows/ci.yml` runs contracts, backend, indexer integration, and frontend jobs.
- `npm run release:check` runs the full local public-beta gate: Solhint, Hardhat compile/tests, backend Prisma generation/build/PostgreSQL tests, indexer integration against a Hardhat RPC, and frontend build.
- `DATABASE_URL_TEST` should point to a dedicated PostgreSQL test database. The backend test reset refuses URLs that do not identify a test database.
- If PostgreSQL is not reachable, backend tests fail with a clear setup message instead of falling through to production or an unrelated database.

---

## Deployment Scripts

### Factory deployment: `scripts/deploy-factory-sepolia.ts`

Deploys legacy `DealLockFactory` to Sepolia and prints the factory address plus the env var suggestions for frontend and backend.

### Factory V2 deployment: `scripts/deploy-factory-v2-sepolia.ts`

Deploys payment-aware `DealLockFactoryV2` to Sepolia and prints `VITE_DEALLOCK_FACTORY_V2_SEPOLIA`, `FACTORY_V2_CONTRACTS`, and `FACTORY_INDEXER_ENABLED=true`.

Required environment variables:
- `SEPOLIA_RPC_URL`
- `PRIVATE_KEY`

### Factory V3 deployment: `scripts/deploy-factory-v3-sepolia.ts`

Deploys the chunked V6 bytecode helper and preferred `DealLockFactoryV3` to Sepolia. It prints the deployed helper/factory addresses and the frontend/backend env vars to set: `VITE_DEALLOCK_FACTORY_V3_SEPOLIA`, `FACTORY_V3_CONTRACTS`, and `FACTORY_INDEXER_ENABLED=true`.

Required environment variables:
- `SEPOLIA_RPC_URL`
- `PRIVATE_KEY`

### Direct V4 deployment: `scripts/deploy-sepolia.ts`

Hardcoded V4 example deployment with 3 milestones ("Wireframe", "Functional frontend", "Final deployment") at 0.01 / 0.02 / 0.01 ETH with 7/14/21-day deadlines and a 3-day review period. Provider address read from `PROVIDER_ADDRESS` env var (defaults to deployer). Outputs contract address and Etherscan link. Used for direct legacy deployments without the factory.

Required environment variables:
- `SEPOLIA_RPC_URL`
- `PRIVATE_KEY`
- `PROVIDER_ADDRESS` (optional)

---

## Backend

### Location
`backend/`

### Purpose
Provides a wallet-signature authentication layer, multi-wallet account model, verified email identity, notification preferences, optional agreement contact emails, backend email transport, a backend-backed agreement registry, a known-contract event indexer, reliable indexed notification dispatch, and an agreement activity feed API. The backend does not hold funds and never authorizes on-chain operations. It is a product identity, discovery, persistence, indexing, and notification layer. Blockchain reads remain the source of truth for escrow funds, contract permissions, milestones, adjustments, disputes, settlements, and state transitions.

### Stack
- Node.js + TypeScript + Express 4
- Prisma ORM with PostgreSQL
- Production-oriented Prisma migrations in `backend/prisma/migrations/`
- HTTP-only cookie sessions (`express-session`) stored in PostgreSQL via `connect-pg-simple` when `SESSION_STORE=postgres`
- viem for address validation, signature verification, RPC reads, and event decoding
- CORS configured for the frontend dev origin
- Console email provider for local development; minimal SMTP transport for configured SMTP servers

`backend/prisma/dev.db` is legacy pre-Round-6 disposable local data. It is no longer the current backend database. Local and production persistence use PostgreSQL via `DATABASE_URL`.

### Database Models

**User** — DealLock product account
- `id` (cuid), `email` (unique nullable), `emailVerifiedAt`, `createdAt`, `updatedAt`

**Wallet** — wallet linked to a user
- `id`, `userId`, `address` (unique, lowercase), `label`, `isPrimary`, `createdAt`, `updatedAt`
- One user → many wallets; one wallet → one user

**AuthNonce** — one-time challenge for wallet signature flows
- `id`, `address`, `nonce`, `purpose` (`signin` | `link_wallet`), `message`, `expiresAt`, `usedAt`, `createdAt`
- Expire after 10 minutes; single-use enforced

**Agreement** — backend-side registry entry for known DealLock contracts
- `id`, `contractAddress`, `chainId`, `clientAddress`, `providerAddress`, `clientEmail`, `providerEmail`, `projectTitle`, `serviceTemplate`, `metadataJson`, `contractVersion` (1, 2, 3, 4, 5, or 6; default 1), payment metadata (`paymentAssetKind`, `paymentTokenAddress`, `paymentSymbol`, `paymentDecimals`), indexer metadata (`deploymentTxHash`, `deploymentBlockNumber`, `indexingStartBlock`, `lastIndexedBlock`, `lastIndexedAt`, `indexerStatus`, `indexerError`), factory metadata (`creationSource` `"direct"|"factory"`, `factoryVersion`, `factoryAddress`, `factoryTxHash`, `factoryLogIndex`, `metadataHash`), `createdByUserId`, `createdAt`, `updatedAt`, `lastAccessedAt`, `lastSyncedAt`
- Unique per `(chainId, contractAddress)`
- Addresses stored lowercase
- Contact emails are optional off-chain notification/contact fields, not authorization fields
- This registry is not authority over escrow state; the smart contract remains source of truth for funds and workflow state

**EmailVerificationToken** — hashed email verification token
- `id`, `userId`, `email`, `tokenHash` (unique), `expiresAt`, `usedAt`, `createdAt`
- Raw token is sent by email only; only SHA-256 hash is stored
- Tokens expire after 30 minutes and are single-use

**NotificationPreference** — per-account notification toggles
- `userId` unique plus boolean toggles for agreement, milestone, adjustment, dispute, settlement, and review-claim events
- Defaults to enabled for all event types

**EmailNotificationLog** — best-effort notification audit/dedupe log
- `agreementId`, `recipientUserId`, `chainEventId`, `contractAddress`, `chainId`, `eventType`, `txHash`, `logIndex`, `recipientEmail`, `status`, `source` (`app` | `indexer`), `error`, `createdAt`, `sentAt`
- Unique per `(eventType, txHash, recipientEmail)` and per `(chainEventId, recipientEmail)` to avoid duplicate app/indexer emails

**FactoryContract** — configuration and indexing state for each configured factory
- `id`, `chainId`, `address`, `contractVersion` (4 for Factory V1, 5 for Factory V2, 6 for Factory V3), `factoryVersion` (1, 2, or 3), `deploymentBlock`, `lastIndexedBlock`, `lastIndexedAt`, `indexerStatus`, `indexerError`, `createdAt`, `updatedAt`
- Unique per `(chainId, address)`
- Populated by the indexer on first tick for each `FACTORY_CONTRACTS`, `FACTORY_V2_CONTRACTS`, or `FACTORY_V3_CONTRACTS` entry

**ChainEvent** — idempotent event index for known DealLock contracts
- `agreementId`, `chainId`, `contractAddress`, `contractVersion`, `blockNumber`, `blockHash`, `txHash`, `logIndex`, `eventName`, `itemType`, `itemId`, `actorAddress`, `counterpartyAddress`, `amountWei` (legacy name), `amountRaw`, payment metadata (`paymentTokenAddress`, `paymentSymbol`, `paymentDecimals`), `payloadJson`, `occurredAt`, `createdAt`, `notificationsProcessedAt`
- Unique per `(chainId, txHash, logIndex)`
- Used for activity and notifications only; not used as escrow authority

**IndexerRun** — operational record for indexer ticks
- `startedAt`, `finishedAt`, `status`, `chainId`, `agreementsSeen`, `eventsFound`, `error`

### API Endpoints

**Auth**
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/nonce` | none | Issue a sign-in nonce + message for a wallet address |
| POST | `/auth/verify` | none | Verify wallet signature, create or restore account, set session cookie |
| POST | `/auth/logout` | none | Destroy session |
| GET | `/me` | session | Return current user and linked wallets |

**Wallets** (all require session)
| Method | Path | Description |
|---|---|---|
| GET | `/wallets` | List wallets linked to current account |
| POST | `/wallets/link/nonce` | Issue a link-wallet nonce for a new wallet |
| POST | `/wallets/link/verify` | Verify link signature and attach wallet to account |
| PATCH | `/wallets/:address` | Update wallet label or primary status |
| DELETE | `/wallets/:address` | Remove wallet (not allowed if it is the only or primary wallet) |

**Agreements** (all require session)
| Method | Path | Description |
|---|---|---|
| GET | `/agreements` | List agreements involving any linked wallet; supports `?chainId=&role=` |
| POST | `/agreements` | Create or upsert agreement registry entry |
| GET | `/agreements/:contractAddress/activity` | Private indexed activity feed for involved linked-wallet accounts |
| PATCH | `/agreements/:contractAddress` | Update project title, template, metadata, or lastAccessedAt |
| PATCH | `/agreements/:contractAddress/contacts` | Update optional client/provider contact emails |

**Email and notification preferences** (all require session)
| Method | Path | Description |
|---|---|---|
| GET | `/email` | Return current account email, verification status, and preferences |
| POST | `/email/start-verification` | Send a verification email with a 30-minute token |
| POST | `/email/confirm` | Confirm email using the raw token from the email link |
| DELETE | `/email` | Remove current account email |
| GET | `/notification-preferences` | Return notification preferences |
| PATCH | `/notification-preferences` | Update boolean notification preference fields |

**Notifications** (all require session)
| Method | Path | Description |
|---|---|---|
| POST | `/notifications/contract-action` | Best-effort email notification after a frontend-confirmed transaction |

Round 7 makes indexed events the primary notification source when `INDEXER_ENABLED=true`; `/notifications/contract-action` remains a fallback and is deduped against indexer-sent logs.

**Factory**
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/factory/contracts` | none | Configured factory contracts and their current indexer status |

**Health**
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | none | Basic service status |
| GET | `/health/db` | none | Lightweight PostgreSQL reachability check through Prisma |
| GET | `/health/indexer` | none | Indexer enabled flag, factory indexer status, configured factory contracts, latest run summary, pending agreement count, and error agreement count |

### Signature Messages

Sign-in message:
```
Sign in to DealLock

This signature proves that you control this wallet.
It does not trigger a blockchain transaction and does not cost gas.

Wallet: 0x...
Chain ID: 11155111
Purpose: signin
Nonce: ...
Issued At: ...
Expires At: ...
```

Link-wallet message:
```
Link wallet to DealLock account

This signature links this wallet to your currently signed-in DealLock account.
It does not trigger a blockchain transaction and does not cost gas.

Wallet: 0x...
Chain ID: 11155111
Purpose: link_wallet
Nonce: ...
Issued At: ...
Expires At: ...
```

---

## Frontend Architecture

### Entry Point & Routing

**`frontend/src/main.tsx`** — mounts React root with:
- `WagmiProvider` (wagmi config)
- `QueryClientProvider` (TanStack Query)
- `AccountProvider` (DealLock session context)
- `BrowserRouter` (React Router)

**Routes**:
- `/` → `LandingPage`
- `/app` → `DashboardPage`

### Account Layer

**`account/AccountProvider.tsx`** — React context that holds the backend session state
- `sessionStatus`: `"loading"` | `"signed-in"` | `"signed-out"`
- `user`: `{ id: string; email: string | null; emailVerifiedAt: string | null } | null`
- `wallets`: `LinkedWallet[]` (all wallets linked to the account)
- `signIn(address, chainId, signFn)` — requests nonce, calls `signFn` with the message, verifies signature
- `signOut()` — calls `/auth/logout`, clears state
- `linkWallet(address, chainId, label, signFn)` — issues link nonce, verifies signature, updates wallet list
- `refreshSession()` — calls `/me`, restores state from existing cookie

**`account/useAccountSession.ts`** — thin re-export of `useAccountContext()` for ergonomic imports

### API Layer

**`api/client.ts`** — base fetch wrapper
- `API_BASE`: `VITE_API_URL` env var or `http://localhost:4000`
- `apiFetch<T>(path, init)` — always sends `credentials: "include"`, throws `ApiError` on non-2xx

**`api/auth.ts`** — `fetchSignInNonce`, `verifySignIn`, `logout`, `getMe`

**`api/wallets.ts`** — `getWallets`, `fetchLinkNonce`, `verifyLinkWallet`, `updateWallet`, `removeWallet`

**`api/agreements.ts`** — `getAgreements`, `saveAgreementToBackend`, `patchAgreement`; exports `BackendAgreement` type

**`api/email.ts`** — `getEmailState`, `startEmailVerification`, `confirmEmail`, `removeEmail`, `getNotificationPreferences`, `patchNotificationPreferences`

**`api/notifications.ts`** — `notifyContractAction` for app-triggered notification emails after confirmed transactions

**`api/activity.ts`** — `getAgreementActivity(contractAddress, chainId)` for the private indexed activity feed

### Utility Modules

**`wagmi.ts`** — wagmi client config; chains: Sepolia + Hardhat; Hardhat proxied via Vite dev server

**`network.ts`** — chain constants, `isSupportedChain`, `chainName`, `explorerTxUrl`, `explorerAddressUrl`, `explorerContractUrl`, `switchToSepolia`

**`contract.ts`** — `DEALLOCK_ABI` — V1 ABI for reading/writing V1 agreements

**`contractV2.ts`** — `DEALLOCK_V2_ABI` — V2 ABI

**`contractV3.ts`** — `DEALLOCK_V3_ABI` — V3 ABI including `REFUND_GRACE_PERIOD`, `getMilestoneRefundAvailableAt`, `getAdjustmentRefundAvailableAt`

**`contractV4.ts`** — `DEALLOCK_V4_ABI` — V4 ABI including review-period, dispute, auto-release, and settlement functions. V5 `DealLockMultiAsset` reuses `DEALLOCK_V4_ABI` for escrow workflow writes because the interface is V4-compatible.

**V5 / multi-asset ABI note**: there is no separate `contractV5.ts`. V1/V2/V3/V4 use their matching ABIs; V5 `DealLockMultiAsset` reuses `DEALLOCK_V4_ABI` for escrow workflow writes because the interface is V4-compatible. V5-specific reads use inline ABI fragments such as `paymentToken()`, and ERC-20 operations use the inline `ERC20_ABI` in `ActionPanel`.

**`bytecode.ts`** — `DEALLOCK_BYTECODE` — V1 bytecode (kept for reference)

**`bytecodeV2.ts`** — `DEALLOCK_V2_BYTECODE` — V2 bytecode (kept for reference)

**`bytecodeV3.ts`** — `DEALLOCK_V3_BYTECODE` — V3 bytecode (kept for reference)

**`bytecodeV4.ts`** — `DEALLOCK_V4_BYTECODE` — V4 bytecode; used for legacy/direct agreement deployments

**`contractFactory.ts`** — Factory V1/V2/V3 ABIs plus env-backed address helpers (`getFactoryAddress`, `getFactoryV2Address`, `getFactoryV3Address`, `isFactoryConfigured`, `isFactoryV2Configured`, `isFactoryV3Configured`)

**`tokens.ts`** — Round 10 payment asset config and helpers: `PaymentAsset`, `paymentAssetsForChain`, `parseAssetAmount`, `formatAssetAmount`, `nativePaymentAsset`

**`contractVersion.ts`** — `detectContractVersion(address, chainId)` → `ContractVersion = 1 | 2 | 3 | 4 | 5 | 6`
- Calls `contractVersion()` via public client; uses `Number(raw)` to handle version return types
- `reverts` → 1, `2` → 2, `3` → 3, `4` → 4, `5` → 5, `6` → 6, unknown future value > 6 → 6 (latest known).

**`types.ts`** — `MilestoneData`, `AdjustmentData`, `Role`, `AgreementSidebarFilter`, `ADJUSTMENT_STATES`, enum labels (`agreementLabel`, `milestoneLabel`, `adjustmentLabel`), `formatEth`, `shortAddress`, `formatTimestamp`, `deriveRole`

**`storage.ts`** — all localStorage interaction (metadata + registry); kept as fallback when backend is unavailable; `AgreementMetadata`, `AgreementRegistryEntry`
- Agreement metadata includes optional payment asset fields for legacy/local fallback: `paymentAssetKind`, `paymentTokenAddress`, `paymentSymbol`, `paymentDecimals`

**`templates.ts`** — four built-in service templates (Website, UI/UX, Branding, Custom) with milestone descriptions, evidence guidance, and acceptance notes

### Pages

#### LandingPage (`pages/LandingPage.tsx`)

Public marketing page with hero, how-it-works steps, feature cards, service template cards, scope comparison, and CTA. Includes a static `DashboardHeroPreview` mockup in the hero.

#### DashboardPage (`pages/DashboardPage.tsx`)

Main application workspace. Manages all state: contract reads, session, backend agreements, local registry, sidebar, and indexed activity.

**Key additions in Round 10**:

- Detects `contractVersion === 5` and treats it as V4-compatible escrow mechanics with payment-asset-aware funding/display
- Reads `paymentToken()` for multi-asset agreements and merges on-chain/backend/local metadata into a `PaymentAsset`
- Passes `paymentAsset` to overview, header, action panel, milestone list, adjustment list, and activity feed
- Backend sync sends payment metadata and Factory V2 metadata
- Keeps blockchain reads as the source of truth for escrow state; backend payment metadata is display/indexing context only

**Key additions in Round 7**:

- Captures deployment transaction hash and block number from the V4 deployment receipt and syncs them to the backend agreement registry
- Fetches `/agreements/:contractAddress/activity` for signed-in users with a loaded agreement
- Renders `AgreementActivityFeed` for indexed events
- Refreshes the activity feed alongside contract reads after successful app transactions
- Keeps contract reads as the source of truth for escrow state; activity is a timeline/notification surface only

**Key additions in Round 5** (on top of Round 4):

- `backendAgreements` state keeps full backend agreement records so optional client/provider contact emails can be shown alongside local metadata
- Create flow stores optional `clientEmail` / `providerEmail` in local metadata and sends them to the backend registry when signed in
- Loaded agreements show a `Notification contacts` panel; involved accounts can edit client/provider contact emails
- Backend sync and localStorage migration preserve contact email metadata
- Query-string `contractAddress` can load an agreement from notification email links
- `ActionPanel` sends non-blocking `/notifications/contract-action` calls after frontend-confirmed transactions

**Key additions in Round 4** (on top of Round 3):

- `isV4` flag derived from `contractVersion === 4`
- `DEALLOCK_V4_ABI` used for V4 reads/writes; `CreateAgreementForm` deploys V4 by default
- `reviewPeriodSeconds` read from `reviewPeriod()`
- V4 batch reads for milestone/adjustment review deadlines, dispute records, and settlement proposals
- `ActionPanel` receives V4 dispute/settlement data and exposes dispute, auto-release, propose settlement, accept settlement, and cancel settlement actions
- `MilestoneList` and `AdjustmentList` show review deadlines, dispute reasons, and active settlement proposals
- Backend sync accepts and persists `contractVersion = 4`

**Key additions in Round 3** (on top of Round 2):

- `isV3` flag derived from `contractVersion === 3`
- `gracePeriodSeconds` state: reads `REFUND_GRACE_PERIOD()` from V3+ contracts (defaults to `24n` if unread); `0n` for V1/V2
- `DEALLOCK_V3_ABI` used for all reads/writes when `isV3`
- `gracePeriodSeconds` passed to `ActionPanel`, `MilestoneList`, `AdjustmentList`
- `rGrace` included in `refetchAll` for V3

**Key additions in Round 2** (on top of Round 1):

- `contractVersion` state: detected via `detectContractVersion()` on load; switches ABI and enables/disables V2 features
- `adjustments`: V2-only — reads `getAdjustmentCount()` + batch `getAdjustment(id)` calls
- `adjustmentFundedAmount`, `adjustmentReleasedAmount`, `adjustmentRefundedAmount`: V2 accounting reads
- `isV2`: derived boolean that gates all V2 UI
- `AdjustmentList` rendered when V2 + adjustments present
- `ActionPanel` receives `contractVersion` and `adjustments` props
- Backend `saveAgreementToBackend` now sends `contractVersion`

**Key additions in Round 1**:

- `backendEntries` state: backend agreements mapped to `AgreementRegistryEntry[]`, merged with localStorage-only entries and passed to `AgreementSidebar`
- `fetchBackendAgreements()`: calls `GET /agreements`, maps response, merges with localStorage
- **localStorage migration** (runs once per sign-in): for each local entry involving a linked wallet, POSTs to backend
- **Backend sync** (per agreement per session): after chain data is first read for a contract, POSTs to backend so it's registered
- `accountRole`: derived from all linked wallets, not just the connected one
- `requiredWallet`: the specific linked wallet that has the required on-chain role when the connected wallet is "other" — passed to `ActionPanel` to show a switch-wallet message

**Wagmi reads** (version-aware, grown from MVP):
- Multiple `useReadContract()` calls for scalar agreement state (agreementState, totalAmount, fundedAmount, releasedAmount, refundedAmount, client, provider, milestoneCount)
- V3/V4/V5/V6: additional `useReadContract()` reads for `REFUND_GRACE_PERIOD`
- V4/V5/V6: additional `useReadContract()` reads for `reviewPeriod`
- V4/V5/V6: batched `useReadContracts()` for per-milestone review deadlines, dispute records, and settlement proposals; additional batched reads for adjustment review deadlines, disputes, and settlements
- V5/V6: `useReadContract()` for `paymentToken()` (inline ABI fragment in DashboardPage); `ERC20_ABI` reads for `allowance` and `balanceOf` on the token contract (inline in ActionPanel)
- V6: batched reads for milestone/adjustment deadline extension requests, `getMilestoneRevision`, and `getMilestoneRevisionResponseDeadline`
- `useReadContracts()` for batch milestone and adjustment reads

### Components

#### Layout

**`AppShell.tsx`** — top-level layout
- Topbar additions:
  - **Sign in** button when wallet is connected but no session (`sessionStatus === "signed-out"`)
  - **Session indicator** when signed in: wallet count, "Sign out" button, wallet panel toggle
  - **Email** settings toggle for verified email and notification preferences
  - `LinkedWalletsPanel` rendered as a dropdown from the session indicator

#### Dashboard Layout

**`DashboardHeader.tsx`** — welcome hero shown when no contract loaded

**`WorkspaceHeader.tsx`** — header shown when a contract is active; shows progress bar, role chip, contract address, refresh button

**`AgreementSidebar.tsx`** — left sidebar
- Now accepts `entries?: AgreementRegistryEntry[]` prop — when provided, replaces localStorage registry (used when backend entries are available)
- Accepts `sessionStatus?: SessionStatus` — changes hint text: "Synced across your linked wallets." when signed in, "Stored only in this browser — sign in to sync." otherwise

**`LinkedWalletsPanel.tsx`** — dropdown panel rendered from the topbar session indicator
- Lists all linked wallets with labels and primary badge
- Inline rename: click pencil icon → edit input → save
- Remove button (not shown for primary or only wallet)
- Link current wallet button (shown when the currently connected wallet is not already linked)
- Calls wagmi `useSignMessage` for the link-wallet signature flow

**`EmailSettingsPanel.tsx`** — dropdown panel rendered from the topbar Email button
- Shows current verified email status
- Starts or restarts verification by calling `/email/start-verification`
- Confirms `?verifyEmail=` links when opened from a verification email
- Removes email from the current account
- Edits notification preference checkboxes

#### Agreement Display

**`AgreementOverview.tsx`** — party cards + escrow metrics; payment-asset-aware in Round 10

**`AgreementActivityFeed.tsx`** — private indexed event feed
- Shows human-readable event names, item type/id, amount, actor short address, timestamp, block, and transaction link
- Shows loading, error, signed-out, and empty-indexer states
- Does not expose raw notification logs or email fields

**`MilestoneList.tsx`** — milestone timeline
- Shows refund-open timing for V3+ pending milestones
- Shows submission/refund timing for V6 pending milestones
- Shows V4/V5/V6 review deadlines, dispute reasons, settlement proposals, and V6 extension requests

**`ActionPanel.tsx`** — interactive contract write panel
- Props: `requiredWallet`, `accountRole` (Round 1), `contractVersion`, `adjustments` (Round 2), `gracePeriodSeconds` (Round 3), V4/V5/V6 review/dispute/settlement data, V6 deadline extension requests, `paymentAsset` (Round 10)
- V2+ client actions: Request Adjustment, Fund Accepted Adjustments, Approve Submitted Adjustments, Refund Expired Adjustments, Cancel Pending Adjustments
- V2+ provider actions: Accept Proposed Adjustments, Submit Funded Adjustment Proof, Cancel Pending Adjustments
- V3-V5 grace period: milestone and adjustment refund buttons only appear after `deadline + 24s`; during the window a "Deadline passed. Refund opens after the grace window" notice is shown
- V6 deadline grace: provider can request/cancel milestone or adjustment deadline extensions during the 30-minute window; client can accept/reject; requests do not block refund unless accepted
- V4/V5/V6 client actions: dispute submitted milestones/adjustments during review, propose/accept/cancel settlements
- V4/V5/V6 provider actions: claim milestone/adjustment after review period, propose/accept/cancel settlements
- V5 (`DealLockMultiAsset`): payment-aware ETH and ERC-20 funding, ERC-20 allowance check + approve step, amount and symbol formatting by payment asset
- V6 (`DealLockMultiAssetV2`): V5 payment behavior plus deadline extension request/accept/reject/cancel UI, cooperative revision requests, and ignored-revision timeout escalation
- V1 note: shows banner when `contractVersion === 1`
- V1/V2/V3/V4 use their matching ABIs
- V5 (`DealLockMultiAsset`) reuses `DEALLOCK_V4_ABI` for escrow workflow writes because the interface is V4-compatible
- V6 uses `DEALLOCK_V6_ABI` for deadline extension writes while preserving V4/V5-compatible escrow writes
- V5/V6-specific reads use inline ABI fragments such as `paymentToken()`, and ERC-20 operations use the inline `ERC20_ABI` in `ActionPanel`
- After a frontend-confirmed transaction, calls `/notifications/contract-action` with action type, tx hash, actor wallet, contract address, and item id when applicable; notification failure never changes transaction success

**`AdjustmentList.tsx`** — timeline of all adjustments for V2+ agreements
- Each adjustment card: id, target milestone, state pill, description, amount, deadline, submittedAt (if set), proof (if set)
- Shows V3+ refund-open timing, V6 submit-until timing, and V4/V5/V6 review/dispute/settlement details
- Optional `targetMilestoneId` prop to show only adjustments for a specific milestone

**`CreateAgreementForm.tsx`** — contract deploy form; prefers Factory V3 when configured, then Factory V2, with a payment asset selector (ETH or configured ERC-20). Factory V3 configured means ETH or ERC-20 creation deploys V6; Factory V2 configured means ETH or ERC-20 creation deploys V5. If both payment-aware factories are missing and ETH is selected, native ETH creation can use legacy Factory V1 or direct V4 fallback. If Factory V3/V2 are missing and ERC-20/USDC is selected, creation is blocked with “ERC-20 agreements require Factory V2 or Factory V3. Configure a payment-aware factory or select ETH.” Captures optional client/provider notification emails as off-chain metadata.

**`AgreementContextSections.tsx`** — collapsible guidance panels (unchanged)

**`AgreementContactsPanel.tsx`** — editable off-chain client/provider notification contact emails for involved accounts; saves to backend when signed in and to local metadata as fallback

#### UI Utilities

**`WalletPanel.tsx`**, **`CopyButton.tsx`**, **`EmptyState.tsx`**, **`DashboardHeroPreview.tsx`** — unchanged from MVP

---

## Data Flow

### Sign-In
```
User clicks "Sign in" in AppShell topbar
  → fetchSignInNonce(address, chainId) → POST /auth/nonce
  → signMessageAsync({ message }) → MetaMask personal_sign
  → verifySignIn(address, nonceId, signature) → POST /auth/verify
  → backend verifyMessage() via viem
  → if wallet unknown: create User + primary Wallet
  → if wallet known: restore existing User
  → set session cookie (HTTP-only)
  → AccountProvider: sessionStatus = "signed-in", wallets loaded
  → DashboardPage: fetchBackendAgreements(), migration effect runs
```

### Link Wallet
```
User switches wallet in MetaMask, clicks "Link [address]" in LinkedWalletsPanel
  → fetchLinkNonce(address, chainId) → POST /wallets/link/nonce
  → if wallet already linked to another account → 409 error shown
  → signMessageAsync({ message }) → MetaMask personal_sign
  → verifyLinkWallet(address, nonceId, signature) → POST /wallets/link/verify
  → backend creates Wallet record linked to current userId
  → AccountProvider.wallets updated
```

### Email Verification
```
User opens Email settings while signed in
  → GET /email loads current email + preferences
  → POST /email/start-verification with normalized email
  → backend creates random token, stores SHA-256 hash only, expires in 30 minutes
  → console email provider prints the verification link in dev
  → user opens /app?verifyEmail=<token>
  → EmailSettingsPanel POSTs /email/confirm
  → backend verifies token, prevents reuse/expiry/cross-account email, stores User.email + emailVerifiedAt
```

### Deployment (Factory V3 preferred)
```
CreateAgreementForm
  → validate fields; select payment asset (ETH or configured ERC-20)
  → if Factory V3 configured for current chain:
      walletClient.writeContract(Factory V3 ABI, createAgreement(provider, paymentToken, ...))
      → wait for receipt → parse AgreementCreated event → extract contractAddress + payment metadata
  → else if Factory V2 configured for current chain:
      walletClient.writeContract(Factory V2 ABI, createAgreement(provider, paymentToken, ...))
      → wait for receipt → parse AgreementCreated event → extract contractAddress + payment metadata
  → if Factory V3/V2 not configured and payment asset is ETH:
      use legacy Factory V1 if configured, otherwise deploy direct V4 with V4 bytecode  # native ETH only
      → wait for receipt → extract contractAddress
  → if Factory V3/V2 not configured and payment asset is ERC-20:
      block creation; show "ERC-20 agreements require Factory V2 or Factory V3. Configure a payment-aware factory or select ETH." (terminal path, no deployment)
  → only after a successful deployment:
      saveAgreementMetadata(metadata + paymentAsset, contractAddress)  ← localStorage
      upsertAgreementRegistry(entry)                    ← localStorage
      parent.setContractAddress(contractAddress)
      syncRegistryFromChain effect fires on first read
      saveAgreementToBackend(..., paymentMetadata, factoryMetadata)     ← backend (best effort)
```

### App-Triggered Notification Email
```
ActionPanel waits for transaction receipt
  → onSuccess refetches contract state
  → POST /notifications/contract-action with actionType, txHash, actorAddress, contractAddress, chainId
  → backend verifies actorAddress is linked to current session and is a party to the agreement
  → recipient is counterparty verified account email, falling back to Agreement.clientEmail/providerEmail
  → recipient account preferences are respected when a verified account email exists
  → EmailNotificationLog dedupes by eventType + txHash + recipientEmail
  → email is sent, skipped, or failed without changing frontend transaction success
```

### Reading Contract State
```
DashboardPage mounts with contractAddress
  → scalar useReadContract() calls for common agreement state
  → V3/V4/V5/V6: reads REFUND_GRACE_PERIOD
  → V4/V5/V6: reads reviewPeriod
  → V4/V5/V6: batched reads for per-milestone and per-adjustment review deadlines,
            dispute records, and settlement proposals
  → V5/V6: reads paymentToken() via inline ABI fragment
  → V5/V6: resolves PaymentAsset from on-chain token address + backend/local config
  → V6 only: batched reads for per-milestone and per-adjustment deadline extension requests
  → V6 only: batched reads for milestone revision info and revision response deadlines
  → data flows into child components as props (incl. paymentAsset)
  → syncRegistryFromChain() merges on-chain addresses/state into localStorage
  → saveAgreementToBackend() (once per session per agreement) → backend
  → refetchAll() called after every successful write
```

### Writing to Contract
```
ActionPanel action button clicked
  → for ETH funding: writeContractAsync({ ..., value: totalAmount })
  → for ERC-20 funding (V5/V6):
      reads allowance from token contract (ERC20_ABI, inline in ActionPanel)
      if allowance < required: writeContractAsync(ERC20_ABI, approve, [agreement, amount])
        → wait for receipt, refetch allowance
      then: writeContractAsync({ fundAgreement/fundAdjustment, value: 0 })
  → for all other writes: writeContractAsync({ address, abi, functionName, args, value? })
  → wallet prompts signature (TxState: pending)
  → tx hash received (TxState: confirming)
  → waitForTransactionReceipt(hash) polls chain
  → confirmed → onSuccess() → parent.refetchAll() (TxState: success)
  → error at any step → humanizeContractError(err) → TxState: error
```

### Agreement Registry (hybrid)
```
localStorage["deallock_agreement_meta_${addr}"]    — per-contract metadata
localStorage["deallock_agreement_registry_v1"]     — fallback registry
backend  /agreements                               — primary when signed in

On sign-in:
  → GET /agreements → backendEntries set → merged with localStorage-only entries
  → localStorage migration: local entries involving linked wallets → POST /agreements

On sidebar render:
  → if backendEntries: use merged (backend + localStorage-only)
  → if not signed in: use localStorage registry directly
```

---

## Configuration

### Hardhat (`hardhat.config.ts`)
- Solidity: 0.8.20, optimizer enabled (200 runs)
- Test framework: Mocha + Ethers (Hardhat Toolbox Mocha)
- Networks: Sepolia (RPC + private key from env), Hardhat (default)
- Test timeout: 20 000 ms

### Vite (`frontend/vite.config.ts`)
- React plugin
- Custom `hardhatRpcProxyPlugin`: proxies `/rpc-hardhat/*` → `http://localhost:8545` in dev

### Environment Variables

Root (Hardhat):
```
SEPOLIA_RPC_URL      # required for deployment and tests on Sepolia
PRIVATE_KEY          # deployer private key
PROVIDER_ADDRESS     # optional; defaults to deployer
```

Frontend (`frontend/.env`):
```
VITE_SEPOLIA_RPC_URL      # optional; uses wagmi public default if blank
VITE_SEPOLIA_EXPLORER     # https://sepolia.etherscan.io
VITE_API_URL              # http://localhost:4000
VITE_DEALLOCK_FACTORY_V3_SEPOLIA # preferred V6 factory address on Sepolia
VITE_DEALLOCK_FACTORY_V3_HARDHAT # preferred V6 factory address on local Hardhat
VITE_DEALLOCK_FACTORY_V2_SEPOLIA # preferred payment-aware factory address on Sepolia
VITE_DEALLOCK_FACTORY_V2_HARDHAT # preferred payment-aware factory address on local Hardhat
VITE_USDC_SEPOLIA_ADDRESS        # optional configured Sepolia USDC payment token
VITE_USDC_HARDHAT_ADDRESS        # optional configured local MockUSDC payment token
VITE_DEALLOCK_FACTORY_SEPOLIA    # legacy Factory V1 address on Sepolia
VITE_DEALLOCK_FACTORY_HARDHAT    # legacy Factory V1 address on local Hardhat
```

Backend (`backend/.env`):
```
DATABASE_URL          # postgresql://deallock:deallock@localhost:5432/deallock?schema=public
DATABASE_URL_TEST     # dedicated PostgreSQL test database URL
SESSION_SECRET        # long random string
SESSION_STORE         # postgres for normal operation; memory only as explicit fallback
SESSION_DATABASE_URL  # optional separate PostgreSQL URL for session storage
TRUST_PROXY           # true only behind a known reverse proxy
SESSION_COOKIE_SECURE # true in production HTTPS deployments
SESSION_COOKIE_SAME_SITE # lax | strict | none
NODE_ENV              # development | production
FRONTEND_ORIGIN       # http://localhost:5173
PORT                  # 4000
APP_URL               # http://localhost:5173; used in email links
EMAIL_PROVIDER        # console | smtp
EMAIL_FROM            # sender header
SMTP_HOST             # SMTP host when EMAIL_PROVIDER=smtp
SMTP_PORT             # SMTP port
SMTP_USER             # optional SMTP username
SMTP_PASS             # optional SMTP password
SMTP_SECURE           # true for direct TLS
SEPOLIA_RPC_URL       # Sepolia RPC used by the event indexer
HARDHAT_RPC_URL       # local Hardhat RPC used by the event indexer
INDEXER_ENABLED       # false locally by default; true starts integrated polling
INDEXER_POLL_MS       # polling interval
INDEXER_CONFIRMATIONS # confirmed-block depth before indexing
INDEXER_BLOCK_BATCH_SIZE # max block span per getLogs query
INDEXER_LOOKBACK_BLOCKS  # fallback range when deployment block is unknown
INDEXER_MAX_AGREEMENTS_PER_TICK # agreement processing cap per tick
INDEXER_LOG_LEVEL     # silent | error | info | debug
FACTORY_CONTRACTS     # comma-separated chainId:address pairs, e.g. 11155111:0x...
FACTORY_V2_CONTRACTS  # comma-separated Factory V2 chainId:address pairs
FACTORY_V3_CONTRACTS  # comma-separated Factory V3 chainId:address pairs
FACTORY_INDEXER_ENABLED # false locally; true starts factory event indexing
USDC_SEPOLIA_ADDRESS  # optional backend metadata label for Sepolia USDC
USDC_HARDHAT_ADDRESS  # optional backend metadata label for local MockUSDC
```

### Local PostgreSQL Setup

Round 6 uses PostgreSQL for backend application data and sessions. The local development path is:

```
docker compose up -d postgres
cd backend
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

For production or persistent shared environments, set `DATABASE_URL` to the managed PostgreSQL database and apply checked-in migrations with `npm run db:deploy`.

---

## File Structure

```
DealLock/
├── docker-compose.yml                        # Local PostgreSQL service
├── contracts/
│   ├── DealLock.sol                          # V1 escrow contract (~262 lines)
│   ├── DealLockV2.sol                        # V2 with paid adjustments (~340 lines)
│   ├── DealLockV3.sol                        # V3 with paid adjustments + grace period (~360 lines)
│   ├── DealLockV4.sol                        # V4 with review, disputes, and settlement
│   ├── DealLockV5.sol          # V4 variant with explicit _client arg (factory deployed)
│   ├── DealLockMultiAsset.sol                # V5 multi-asset payment-layer escrow
│   ├── DealLockMultiAssetV2.sol              # V6 deadline grace + extension escrow
│   ├── DealLockMultiAssetV2Deployer.sol      # Chunked V6 deployment helper for Factory V3
│   ├── DealLockFactory.sol                   # Legacy Factory V1 + on-chain registry
│   ├── DealLockFactoryV2.sol                 # Payment-aware Factory V2 + registry
│   └── DealLockFactoryV3.sol                 # Payment-aware Factory V3 + registry
├── test/
│   ├── DealLock.ts                           # 11 V1 Mocha tests
│   ├── DealLockV2.ts                         # 23 V2 Mocha tests
│   ├── DealLockV3.ts                         # 16 V3 Mocha tests
│   ├── DealLockV4.ts                         # 29 V4 Mocha tests
│   ├── DealLockFactory.ts                    # 20 Factory V1 Mocha tests
│   ├── DealLockMultiAsset.ts                 # 45 multi-asset payment tests
│   ├── DealLockFactoryV2.ts                  # 17 Factory V2 tests
│   ├── DealLockMultiAssetV2_DeadlineExtensions.ts # 15 V6 deadline extension and Factory V3 tests
│   ├── DealLockMultiAssetV2_RevisionRequests.ts   # 16 V6 revision request lifecycle tests
│   └── DealLockMultiAsset_Security.ts        # 39 payment-layer security and invariant tests
├── scripts/
│   ├── bootstrap-local-rc.ts                 # Local RC bootstrap: deploys MockUSDC + Factory V2/V3, mints USDC, writes env files
│   ├── deploy-factory-sepolia.ts             # Deploy DealLockFactory to Sepolia
│   ├── deploy-factory-v2-sepolia.ts          # Deploy DealLockFactoryV2 to Sepolia
│   ├── deploy-factory-v3-sepolia.ts          # Deploy chunked V6 deployer + DealLockFactoryV3 to Sepolia
│   ├── release-check.sh                      # Shell public-beta release gate runner
│   ├── release-check.mjs                     # Local public-beta release gate runner
│   ├── check-bytecode-size.mjs               # V6/Factory V3 deployed-bytecode size check
│   └── deploy-sepolia.ts                     # Direct V4 deploy (legacy/dev fallback)
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma                     # PostgreSQL Prisma schema
│   │   └── migrations/
│   │       ├── 20260430000000_round6_postgresql/
│   │       │   └── migration.sql             # Backend tables + session table
│   │       ├── 20260430010000_round7_event_indexer/
│   │       │   └── migration.sql             # ChainEvent, IndexerRun, indexer metadata
│   │       ├── 20260430020000_round8_factory/
│   │       │   └── migration.sql             # FactoryContract + Agreement factory fields
│   │       └── 20260430030000_round10_multi_asset/
│   │           └── migration.sql             # payment metadata + Factory V2 fields
│   ├── src/
│   │   ├── index.ts                          # Express app, CORS, session, routes
│   │   ├── loadLocalEnv.ts                   # Node --import preload: loads .env.local before db.ts/Prisma
│   │   ├── db.ts                             # Prisma client singleton
│   │   ├── auth.ts                           # Message builders, NONCE_TTL_MS
│   │   ├── utils.ts                          # generateNonce, asyncRoute
│   │   ├── sessionStore.ts                   # PostgreSQL-backed session store config
│   │   ├── testDatabase.ts                   # Dedicated PostgreSQL test DB reset/setup
│   │   ├── contractActions.ts                # notification action labels/preference mapping
│   │   ├── notificationPreferences.ts        # preference defaults/update parsing
│   │   ├── indexerCli.ts                     # Standalone indexer command entry
│   │   ├── email/
│   │   │   ├── sendEmail.ts                  # email service entry point
│   │   │   ├── templates.ts                  # verification + contract action templates
│   │   │   ├── transport.ts                  # console + SMTP transport
│   │   │   └── validation.ts                 # email normalization/validation
│   │   ├── middleware/
│   │   │   └── requireAuth.ts                # Auth middleware + session type augmentation
│   │   ├── indexer/
│   │   │   ├── abis.ts                       # V1-V6 and Factory V1/V2/V3 event ABI fragments
│   │   │   ├── clients.ts                    # viem public client factory
│   │   │   ├── config.ts                     # indexer env parsing
│   │   │   ├── decode.ts                     # log decoding + normalized ChainEvent shape
│   │   │   ├── decode.test.ts                # pure event decoding tests
│   │   │   ├── indexer.integration.test.ts   # end-to-end factory + agreement indexing tests (requires Hardhat + test DB)
│   │   │   ├── eventMap.ts                   # event labels and notification mapping
│   │   │   ├── notify.ts                     # indexer-driven notification dispatch
│   │   │   ├── runner.ts                     # runIndexerOnce + polling loop
│   │   │   ├── status.ts                     # /health/indexer status helper
│   │   │   ├── store.ts                      # idempotent ChainEvent inserts
│   │   │   ├── syncAgreement.ts              # per-agreement range indexing
│   │   │   ├── syncFactory.ts                # factory AgreementCreated event indexing
│   │   │   └── timestamp.ts                  # block timestamp lookup/cache
│   │   ├── routes/
│   │   │   ├── auth.ts                       # /auth/nonce, /auth/verify, /auth/logout, /auth/me
│   │   │   ├── wallets.ts                    # /wallets CRUD + link flow
│   │   │   ├── agreements.ts                 # /agreements CRUD + contact emails
│   │   │   ├── email.ts                      # /email verification flow
│   │   │   ├── notificationPreferences.ts    # /notification-preferences
│   │   │   ├── notifications.ts              # /notifications/contract-action
│   │   │   └── factory.ts                    # /factory/contracts
│   │   └── round5.test.ts                    # Backend integration tests on PostgreSQL
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── src/
│       ├── main.tsx                          # React root + providers (incl. AccountProvider)
│       ├── App.tsx
│       ├── index.css
│       ├── wagmi.ts
│       ├── network.ts
│       ├── contract.ts                       # V1 ABI
│       ├── contractV2.ts                     # V2 ABI (generated from artifact)
│       ├── contractV3.ts                     # V3 ABI (generated from artifact)
│       ├── contractV4.ts                     # V4 ABI (generated from artifact)
│       ├── contractV6.ts                     # V6 extension ABI (deadline extension + revision request functions)
│       ├── bytecode.ts                       # V1 bytecode
│       ├── bytecodeV2.ts                     # V2 bytecode
│       ├── bytecodeV3.ts                     # V3 bytecode
│       ├── bytecodeV4.ts                     # V4 bytecode (legacy direct deploy fallback)
│       ├── contractVersion.ts                # detectContractVersion() → 1|2|3|4|5|6
│       ├── contractFactory.ts                # Factory V1/V2/V3 ABIs and address helpers
│       ├── types.ts                          # milestones, adjustments, disputes, settlement types; RevisionInfo
│       ├── storage.ts                        # localStorage: metadata + registry (fallback)
│       ├── templates.ts
│       ├── api/
│       │   ├── client.ts                     # Base fetch + ApiError
│       │   ├── auth.ts                       # fetchSignInNonce, verifySignIn, logout, getMe
│       │   ├── wallets.ts                    # getWallets, link flow, updateWallet, removeWallet
│       │   ├── agreements.ts                 # agreement registry + contact email API
│       │   ├── activity.ts                   # indexed agreement activity API
│       │   ├── email.ts                      # email state, verification, preferences
│       │   └── notifications.ts              # app-triggered notification API
│       ├── account/
│       │   ├── AccountProvider.tsx           # Session context + signIn/signOut/linkWallet
│       │   └── useAccountSession.ts          # Hook re-export
│       ├── pages/
│       │   ├── LandingPage.tsx
│       │   └── DashboardPage.tsx             # Backend agreements + migration + account role gating
│       └── components/
│           ├── ActionPanel.tsx               # V2+: adjustments; V4 review/dispute/settlement; V5/V6 payment-aware funding; V6 deadline extension request/accept/reject/cancel; V6 revision request/accept/reject, client deadline update, and timeout escalation
│           ├── AdjustmentList.tsx            # V2+: adjustment cards + V3+ timing/state details
│           ├── AgreementContextSections.tsx
│           ├── AgreementContactsPanel.tsx    # client/provider notification contacts
│           ├── AgreementActivityFeed.tsx     # indexed activity timeline
│           ├── AgreementOverview.tsx
│           ├── CreateAgreementForm.tsx       # Factory V3 preferred, Factory V2 fallback; ETH-only V4 direct deploy fallback; contact emails
│           ├── MilestoneList.tsx             # V3+ timing + V4/V5/V6 dispute/settlement details; V6 extension request display; V6 RevisionRequested state glyph
│           ├── WalletPanel.tsx
│           ├── dashboard/
│           │   ├── AgreementSidebar.tsx      # + entries / sessionStatus props
│           │   ├── DashboardHeader.tsx
│           │   ├── EmailSettingsPanel.tsx    # verified email + notification preferences
│           │   ├── LinkedWalletsPanel.tsx    # Linked wallets UI + link flow
│           │   └── WorkspaceHeader.tsx
│           ├── landing/
│           │   └── DashboardHeroPreview.tsx
│           ├── layout/
│           │   └── AppShell.tsx              # + sign-in button + session indicator
│           └── ui/
│               ├── CopyButton.tsx
│               └── EmptyState.tsx
├── docs/
│   ├── state.md                              # This file
│   ├── public_beta_checklist.md              # Part A: local RC smoke test; Part B: Sepolia smoke test
│   ├── round_1.md                            # Round 1 spec
│   ├── round_2.md                            # Round 2 spec
│   ├── round_3.md                            # Round 3 spec
│   ├── round_4.md                            # Round 4 spec
│   ├── round_5.md                            # Round 5 spec
│   ├── round_6.md                            # Round 6 spec
│   ├── round_7.md                            # Round 7 spec
│   ├── round_8.md                            # Round 8 spec
│   ├── round_9.md                            # Round 9 spec
│   ├── round_10.md                           # Round 10 spec
│   ├── round_11.md                           # Round 11 spec
│   ├── round_12.md                           # Round 12 spec
│   ├── round_13.md                           # Round 13 spec
│   ├── round_14.md                           # Round 14 review/cleanup spec
│   ├── round_15.md                           # Round 15 spec
│   ├── round_16.md                           # Round 16 spec
│   └── round_17.md                           # Round 17 release-blocker cleanup spec/results
├── .github/
│   └── workflows/
│       └── ci.yml                            # CI: contracts, backend, indexer integration, frontend
├── .solhint.json                             # Solidity lint rules
├── .solhintignore                            # Solidity lint ignore list
├── hardhat.config.ts
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

---

## Intentional Scope Limits

The following are deliberate constraints, not missing features:

- **No AI or third-party arbitration** — V4 supports mutual settlement only; it does not judge quality or correctness of deliverables
- **No unilateral partial approval** — normal milestone approval is all-or-nothing; partial fund splits are only possible through mutual settlement of a disputed milestone or adjustment (V4/V5/V6)
- **No ERC-20 swaps or arbitrary token discovery** — Round 10 supports only one fixed payment asset per agreement, and the frontend exposes only configured tokens
- **No fee-on-transfer/rebasing token support** — standard ERC-20 transfer behavior only
- **No platform fees** — the factory and escrow contracts collect no fees and have no fee recipient
- **No upgradeable proxy system** — factory-deployed agreements are fully independent; no admin can upgrade or replace them
- **No Google OAuth** — wallet-signature auth only (Round 1 explicit out-of-scope)
- **No email authority** — verified email is for notifications only; it is not a login method and cannot authorize contract actions
- **Factory indexer added in Round 8** — the backend now discovers factory-created agreements automatically; direct-deployed legacy agreements still require frontend sync
- **No reputation system** — no scoring, history, or identity layer
- **No multi-party** — strictly one client and one provider per contract
- **No backend escrow authority** — indexed events power activity and notifications, but chain reads remain the source of truth

What the contract guarantees: sequence, custody, timestamps, and payment flow. Everything else (quality, scope, communication) is off-chain and the responsibility of the parties.

---

## Implementation Rounds

### Round 1 — Multi-Wallet Account Foundation

**Status**: Implemented

**Goal**: Move DealLock from a purely browser-local MVP toward a public-service architecture by adding a minimal backend account layer and multi-wallet support.

**Changes**:
- Added `backend/` with Express + Prisma and an initial local database setup, superseded by Round 6 PostgreSQL
- Added wallet-signature sign-in (no password, no OAuth) via EIP-191 personal_sign
- Added account creation from first wallet sign-in; account restoration on repeat sign-in
- Added linked wallets: a signed `link_wallet` message attaches additional wallets to the same account
- Added backend agreement registry (`Agreement` model) synced from frontend on sign-in and on contract load
- Added localStorage migration: on first sign-in, local registry entries involving linked wallets are pushed to backend
- Added `AccountProvider` React context for session state management
- Added `LinkedWalletsPanel` component for wallet management in the topbar
- Updated `AgreementSidebar` to show backend-sourced entries (merged with localStorage) when signed in
- Updated `DashboardPage` to compute `accountRole` and `requiredWallet` from all linked wallets
- Updated `ActionPanel` to show "Switch wallet to take action" when a linked wallet (but not the connected wallet) has the required on-chain role
- Updated `AppShell` with sign-in/sign-out controls and session indicator
- `DealLock.sol` unchanged

**Out of scope** (deferred to later rounds):
- Google OAuth
- Email notifications
- Contract changes
- Event watcher / chain indexer
- Factory contract
- Platform fees
- ERC-20 payments
- Arbitration / dispute resolution
- Reputation system

---

### Round 2 — Paid Adjustments / Change Orders

**Status**: Implemented

**Goal**: Add support for multiple paid adjustments (change orders) inside a V2 DealLock agreement. Each adjustment is append-only extra work with its own lifecycle, amount, deadline, and proof. Original milestones are unchanged.

**Contract changes**:
- Added `contracts/DealLockV2.sol` — V1 milestone workflow preserved + `AdjustmentState` enum, `Adjustment` struct, adjustment accounting vars, 7 adjustment functions, `contractVersion()` returning 2, updated `_tryCompleteAgreement()` that considers adjustment terminal state
- `contracts/DealLock.sol` unchanged

**Tests**:
- Added `test/DealLockV2.ts` with 23 tests covering full adjustment lifecycle, security edge cases, multiplicity, completion logic, and V1 regression
- All 34 tests pass (11 V1 + 23 V2)

**Frontend changes**:
- `frontend/src/contractV2.ts` — V2 ABI generated from artifact
- `frontend/src/bytecodeV2.ts` — V2 bytecode generated from artifact
- `frontend/src/contractVersion.ts` — `detectContractVersion()` utility
- `frontend/src/types.ts` — `AdjustmentData`, `ADJUSTMENT_STATES`, `adjustmentLabel`
- `frontend/src/components/AdjustmentList.tsx` — adjustment card timeline
- `frontend/src/components/ActionPanel.tsx` — V2 adjustment actions (all 7), request-adjustment form with on-chain data warning, V1 compatibility note
- `frontend/src/components/CreateAgreementForm.tsx` — deploys V2 by default
- `frontend/src/pages/DashboardPage.tsx` — version detection, V2 adjustment reads, `AdjustmentList` render, V2 props to ActionPanel

**Backend changes**:
- `backend/prisma/schema.prisma` — `contractVersion Int @default(1)` added to `Agreement` model
- `backend/src/routes/agreements.ts` — POST/PATCH/GET now handle `contractVersion` field

**Out of scope** (deferred to later rounds):
- Free revision requests
- Editing existing milestones or adjustment terms after creation
- Arbitration or dispute resolution
- ERC-20 payments
- Factory contract
- Event indexer
- Google OAuth
- Email notifications
- Reputation system

---

### Round 3 — Fair Refund Window / Deadline Grace Period

**Status**: Implemented

**Goal**: Add a 24-second grace period before any client refund becomes available after a milestone or adjustment deadline. This protects providers from normal Ethereum block inclusion latency — a provider who broadcasts a submission just before the deadline should not be punished if the transaction is mined 1–2 slots later.

**Contract changes**:
- Added `contracts/DealLockV3.sol`
  - `REFUND_GRACE_PERIOD = 24 seconds` (public constant; equals 2 × 12-second PoS slot time)
  - `contractVersion()` returns `uint256(3)`
  - `refundExpiredMilestone`: eligibility changed from `> deadline` to `>= deadline + 24`
  - `refundExpiredAdjustment`: same change
  - `submitMilestone` / `submitAdjustment`: deadline check removed — provider can submit while state is still Pending/Funded; the race after `refundAvailableAt` is decided by which transaction is mined first
  - `getMilestoneRefundAvailableAt(id)` and `getAdjustmentRefundAvailableAt(id)` helper view functions
  - `_refundAvailableAt(deadline)` internal pure helper
- `contracts/DealLock.sol` and `contracts/DealLockV2.sol` unchanged

**Tests**:
- Added `test/DealLockV3.ts` with 16 tests covering constant values, grace period blocking, refund at exact `deadline+24`, provider submit during grace, race model (submitted → client cannot refund), V2 and V1 regression
- All 50 tests pass (11 V1 + 23 V2 + 16 V3)

**Frontend changes**:
- `frontend/src/contractV3.ts` — V3 ABI generated from artifact
- `frontend/src/bytecodeV3.ts` — V3 bytecode; new agreements deployed V3 during Round 3 (superseded by V4)
- `frontend/src/contractVersion.ts` — `ContractVersion = 1 | 2 | 3`; uses `Number()` to handle both `uint8` (V2) and `uint256` (V3) return types; unknown future version treated as latest known
- `frontend/src/components/CreateAgreementForm.tsx` — deployed V3 by default during Round 3 (superseded by V4)
- `frontend/src/pages/DashboardPage.tsx` — `isV3`, `gracePeriodSeconds` read from `REFUND_GRACE_PERIOD()`, V3 ABI for reads/writes, `gracePeriodSeconds` passed to ActionPanel/MilestoneList/AdjustmentList
- `frontend/src/components/ActionPanel.tsx` — V3 refund buttons only enabled after `deadline + grace`; "Deadline passed. Refund opens after the grace window" notice during grace window; supports V3 for all adjustment actions
- `frontend/src/components/MilestoneList.tsx` — "Refund opens:" line for V3 Pending milestones
- `frontend/src/components/AdjustmentList.tsx` — "Refund opens:" line for V3 Funded adjustments

**Backend changes**:
- `backend/src/routes/agreements.ts` — `contractVersion` validation updated to allow `1 | 2 | 3`

**Out of scope** (deferred):
- Dynamic/custom grace period per contract
- Using mempool arrival time as proof of timely submission
- Google OAuth, email notifications, event indexer (added in Round 7), factory contract, ERC-20, arbitration, reputation

---

### Round 4 — Review Period, Disputes, and Mutual Settlement

**Status**: Implemented

**Goal**: Add provider protection after submitted work by introducing a review period, client dispute option, provider auto-release after review expiry, and mutual settlement for disputed milestones and paid adjustments.

**Contract changes**:
- Added `contracts/DealLockV4.sol`
  - `contractVersion()` returns `uint256(4)`
  - Constructor accepts `reviewPeriod` and validates 1 hour to 14 days
  - Milestones add `Disputed` and `Settled`
  - Adjustments add `Disputed` and `Settled`
  - Submitted work cannot be directly refunded by the client
  - Client can dispute submitted milestone/adjustment during review
  - Provider can claim submitted milestone/adjustment after review expires
  - Either party can propose settlement for disputed work; only the counterparty can accept
  - Settlement splits funds between provider and client and updates accounting
  - Completion requires all milestones and adjustments to be terminal
- `contracts/DealLock.sol`, `contracts/DealLockV2.sol`, and `contracts/DealLockV3.sol` remain compatible

**Tests**:
- Added `test/DealLockV4.ts` with 29 tests covering review-period validation, milestone and adjustment disputes, auto-release, settlement proposal/accept/cancel flows, settlement accounting, completion blocking, and V1/V2/V3 regression
- All 79 tests pass (11 V1 + 23 V2 + 16 V3 + 29 V4)

**Frontend changes**:
- `frontend/src/contractV4.ts` — V4 ABI generated from artifact
- `frontend/src/bytecodeV4.ts` — V4 bytecode; new agreements now deploy V4
- `frontend/src/contractVersion.ts` — `ContractVersion = 1 | 2 | 3 | 4`; unknown future versions use V4 UI
- `frontend/src/components/CreateAgreementForm.tsx` — deploys V4 by default with a 3-day review period
- `frontend/src/pages/DashboardPage.tsx` — reads V4 review period, review deadlines, dispute records, and settlement proposals using batched calls
- `frontend/src/components/ActionPanel.tsx` — adds V4 dispute, auto-release, propose settlement, accept settlement, and cancel settlement actions for milestones and adjustments; shows public on-chain text warnings
- `frontend/src/components/MilestoneList.tsx` and `frontend/src/components/AdjustmentList.tsx` — show V4 review deadlines, dispute reasons, and settlement proposal split details

**Backend changes**:
- `backend/src/routes/agreements.ts` — `contractVersion` validation updated to allow `1 | 2 | 3 | 4`
- No dispute storage added; the contract remains the source of truth for dispute and settlement state

**Out of scope** (deferred):
- AI dispute analysis or binding AI arbitration
- Human arbiter or third-party arbitrator address
- Court/legal workflow
- Editing original milestone terms
- Free revision workflow
- ERC-20 payments, factory contract, platform fees, reputation, event indexer (added in Round 7), notifications, OAuth

---

### Round 5 — Verified Email Identity and App-Triggered Notifications

**Status**: Implemented

**Goal**: Add optional verified email identity, notification preferences, agreement contact emails, backend email transport, and best-effort app-triggered notification emails without changing wallet authority or Solidity contracts.

**Contract changes**:
- None. No Solidity contracts were changed.

**Backend changes**:
- Extended `User` with `email` and `emailVerifiedAt`
- Added `EmailVerificationToken`, `NotificationPreference`, and `EmailNotificationLog`
- Extended `Agreement` with optional `clientEmail` and `providerEmail`
- Added email service files under `backend/src/email/` with console and SMTP transports
- Added `/email`, `/notification-preferences`, and `/notifications/contract-action` routes
- Added `/agreements/:contractAddress/contacts` for off-chain contact email updates
- Notification endpoint validates session, actor linked wallet, involved agreement, preferences, recipient lookup, and dedupe log

**Frontend changes**:
- Added `EmailSettingsPanel` in the account/session area for email verification and notification preferences
- Added optional client/provider notification email fields to `CreateAgreementForm`
- Added `AgreementContactsPanel` for loaded agreement contact emails
- Extended localStorage metadata with `clientEmail` and `providerEmail`
- Extended backend agreement sync to persist contact emails
- Added post-confirmation notification calls from `ActionPanel` for app actions; failures are non-blocking
- Added notification email links that can open `/app?contractAddress=...`

**Verification**:
- `backend`: `npm run db:generate`, `npm run build`
- `backend`: `npm test` covers verification token hashing/expiry/duplicate email, preferences, contact authorization, notification skip/send/preference/dedupe
- `frontend`: `npm run build`

**Out of scope** (deferred):
- Google OAuth
- AI arbitration or binding third-party arbitration
- Blockchain event indexer was deferred in Round 5 and added in Round 7; app-triggered notifications remain as fallback
- Email login or email-based authorization
- Sensitive proof/dispute/settlement content in emails

---

### Round 6 — PostgreSQL Persistence and Session Store

**Status**: Implemented

**Goal**: Move the existing Node/Express/Prisma backend from local development database storage to PostgreSQL-backed application data, migrations, tests, and sessions while keeping the backend as a product/account registry. Blockchain reads remain the source of truth for escrow state, funds, permissions, milestones, adjustments, disputes, settlements, and contract state transitions.

**Contract changes**:
- None. No Solidity contracts were changed.
- No V5 contract was added.

**Backend and database changes**:
- Changed Prisma datasource to `postgresql`
- Added checked-in Prisma migration `20260430000000_round6_postgresql`
- Added PostgreSQL indexes for auth nonce cleanup/lookups, agreement party queries, email verification tokens, and email notification logs
- Added migration-managed `session` table for `connect-pg-simple`
- Added `pg` and `connect-pg-simple` session storage with `SESSION_STORE=postgres` as normal operation
- Kept Express `MemoryStore` only as an explicit `SESSION_STORE=memory` local/test fallback
- Added `docker-compose.yml` with a local `postgres:16-alpine` service
- Added `/health` and `/health/db`
- Added `DATABASE_URL_TEST` and `backend/src/testDatabase.ts` so backend tests reset a dedicated PostgreSQL test database before running migrations
- Updated backend scripts to use `db:migrate`, `db:deploy`, `db:reset`, and PostgreSQL-backed tests
- Marked `backend/prisma/dev.db` as legacy pre-Round-6 data; current persistence uses PostgreSQL via `DATABASE_URL`

**Frontend changes**:
- None required. Existing Round 5 API behavior remains unchanged.

**Verification**:
- `backend`: `DATABASE_URL=postgresql://deallock:deallock@localhost:5432/deallock?schema=public prisma validate`
- `backend`: `npm run db:generate`
- `backend`: `npm run build`
- `frontend`: `npm run build`
- PostgreSQL runtime tests require a running local PostgreSQL instance. In this environment, `docker compose up -d postgres` could not start because the Docker daemon was unavailable.

**Out of scope** (deferred):
- Python/Peewee migration
- Solidity changes or V5
- Google OAuth
- AI arbitration
- Blockchain event indexer was added in Round 7

---

### Round 7 — Event Indexer and Reliable Notifications

**Status**: Implemented

**Goal**: Add backend indexing for known DealLock contracts so notifications and activity history are driven by confirmed on-chain events even when users interact outside the DealLock frontend. The backend remains a product/account/notification layer; blockchain reads remain the source of truth for escrow state and permissions.

**Contract changes**:
- None. No Solidity contracts were changed.
- No DealLockV5 and no factory contract were added.

**Backend and database changes**:
- Extended `Agreement` with deployment/indexer metadata: deployment tx/block, indexing start block, last indexed block/time, status, and error
- Added `ChainEvent` for idempotent event storage keyed by `(chainId, txHash, logIndex)`
- Added `IndexerRun` for `/health/indexer` diagnostics
- Extended `EmailNotificationLog` with `source`, `chainEventId`, and `logIndex` so app-triggered and indexer-triggered emails dedupe
- Added `backend/src/indexer/*` modules for config, viem clients, V1-V4 event ABIs, decoding, timestamp lookup, event storage, notifications, per-agreement sync, runner, and status
- Added `runIndexerOnce()` plus integrated polling when `INDEXER_ENABLED=true`
- Added `npm run indexer` for standalone polling; `INDEXER_ONCE=true npm run indexer` runs one tick
- Added `GET /agreements/:contractAddress/activity` for involved linked-wallet accounts only
- Added `GET /health/indexer`
- Added Round 7 indexer env vars for RPC URLs, polling, confirmations, batch size, lookback, max agreements per tick, and log level

**Frontend changes**:
- Added `frontend/src/api/activity.ts`
- Added `AgreementActivityFeed` with loading, error, signed-out, empty, and event-list states
- `DashboardPage` now fetches activity for signed-in loaded agreements and refreshes it after successful app transactions
- `CreateAgreementForm` passes deployment transaction hash and block number from the receipt into backend agreement sync

**Notification behavior**:
- Indexed events are the primary notification source when the indexer is enabled
- `/notifications/contract-action` remains a fallback for app-confirmed transactions
- Deduplication prevents duplicate emails when both the app fallback and indexer see the same transaction
- Emails still avoid sensitive proof/dispute/settlement text and never authorize account or contract actions

**Verification**:
- `backend`: `npm run db:generate`
- `backend`: `npm run build`
- `backend`: `tsx --test src/indexer/decode.test.ts`
- `frontend`: `npm run build`
- Full PostgreSQL-backed backend tests require local PostgreSQL. In this environment, `docker compose up -d postgres` could not start because the Docker daemon was unavailable.

**Out of scope** (deferred):
- Solidity changes
- DealLockV5
- Factory contract or global on-chain discovery (added in Round 8)
- AI arbitration or binding third-party arbitration
- Google OAuth

---

### Round 8 — Factory Contract + On-Chain Agreement Registry

**Status**: Implemented

**Goal**: Add a canonical `DealLockFactory` contract so all new DealLock agreements are created through one known factory address per network. The factory deploys independent V4-compatible escrow contracts, records them in an on-chain registry, and emits `AgreementCreated` events that the backend indexer watches for automatic discovery. This fixes the Round 7 limitation: the backend no longer requires the frontend to manually sync newly deployed agreements.

**Contract changes**:
- Added `contracts/DealLockV5.sol` — V4 with explicit `_client` constructor arg; `contractVersion()` returns `4`
- Added `contracts/DealLockFactory.sol` — deploys `DealLockV5`, registers agreements on-chain, emits `AgreementCreated`
- No new business-logic V5 (`DealLockV5.sol` is a factory-deployment wrapper only); no proxy upgradeability; no admin powers over deployed agreements; no fees
- `DealLockV4.sol` remains for legacy direct deployments

**Tests**:
- Added `test/DealLockFactory.ts` with 20 tests covering factory deploy, version, client correctness, event emission, registry, pagination, `isDealLockAgreement`, all validation reverts, ETH send rejection, end-to-end workflow, and V4 direct deployment regression
- All 99 tests pass (11 V1 + 23 V2 + 16 V3 + 29 V4 + 20 Factory)

**Backend and database changes**:
- Extended `Agreement` schema with `creationSource` (`"direct" | "factory"`), `factoryAddress`, `factoryTxHash`, `factoryLogIndex`, `metadataHash`
- Added `FactoryContract` model for per-factory indexer tracking
- Added migration `20260430020000_round8_factory`
- Added `DEALLOCK_FACTORY_EVENTS` ABI in `indexer/abis.ts`
- Added `indexer/syncFactory.ts` — scans factory blocks for `AgreementCreated`, upserts `Agreement` records (merge-safe, idempotent), stores `ChainEvent`
- Updated `indexer/runner.ts` — Phase 1 indexes factory contracts (when `FACTORY_INDEXER_ENABLED=true`), Phase 2 indexes agreements (unchanged)
- Updated `indexer/config.ts` — parses `FACTORY_CONTRACTS` and `FACTORY_INDEXER_ENABLED` env vars
- Updated `indexer/status.ts` — includes `factoryContracts` status in `/health/indexer`
- Added `routes/factory.ts` — `GET /factory/contracts`; public, no auth required
- Updated `routes/agreements.ts` — POST and PATCH accept factory fields
- Added factory route to Express app

**Frontend changes**:
- Added `frontend/src/contractFactory.ts` — `DEALLOCK_FACTORY_ABI`, `getFactoryAddress(chainId)`, `isFactoryConfigured(chainId)`
- Updated `CreateAgreementForm.tsx` — Round 8 native ETH-only path: if legacy Factory V1 (`DealLockFactory`) is configured for the current chain, calls `DealLockFactory.createAgreement(...)` and parses the Factory V1 `AgreementCreated` event to get the agreement address; otherwise falls back to direct V4 deployment for native ETH only. Round 10+ ERC-20/USDC creation requires Factory V2 and must not use direct V4 fallback.
- Updated `api/agreements.ts` — `BackendAgreement` type and `saveAgreementToBackend` include factory fields
- Updated `DashboardPage.tsx` — `deploymentReceipts` includes factory fields; `handleDeployed` signature extended; shows "Created via DealLock Factory" / "Direct legacy deployment" indicator
- Added `VITE_DEALLOCK_FACTORY_SEPOLIA` and `VITE_DEALLOCK_FACTORY_HARDHAT` to `frontend/.env.example`

**Deployment scripts**:
- Added `scripts/deploy-factory-sepolia.ts` — deploys `DealLockFactory` and prints env var suggestions

**Verification**:
- `npx hardhat compile` — 6 contracts compiled cleanly
- `npx hardhat test` — 99/99 tests pass
- `backend`: `npm run db:generate && npm run build` — clean TypeScript compile
- `frontend`: `npx tsc --noEmit && npm run build` — zero TypeScript errors, clean bundle

**Note on DealLockV5 naming**: `DealLockV5.sol` is the factory-deployed V4-compatible escrow wrapper, not a new business-logic version. It is identical to `DealLockV4` except that the constructor accepts an explicit `_client` argument, so the factory is never set as the client. `contractVersion()` returns `4`; the frontend and indexer treat it identically to a direct `DealLockV4` deployment. There is no new escrow feature version in Round 8 — `DealLockV5` is purely a deployment-time distinction.

**Out of scope** (as specified):
- No new escrow business-logic version (DealLockV5 is a wrapper, not a new version)
- No platform fees or fee recipient
- No upgradeable proxy pattern
- No factory admin control over agreements
- No ERC-20 payments
- No AI arbitration
- No Google OAuth
- No migration of old direct-deployed agreements into the factory

---

### Round 9 — Public Beta Deployment Hardening

**Status**: Implemented

**Goal**: Harden the backend, frontend, email delivery, indexer operation, environment configuration, and documentation for a public beta deployment on Sepolia. No new escrow logic, contract versions, or protocol changes.

**Contract changes**:
- None. All Solidity contracts are unchanged.

**DealLockV5 naming clarification**: Resolved the inconsistency introduced in Round 8. `DealLockV5.sol` is now clearly documented as a factory-created V4-compatible deployment wrapper, not a new business-logic version. `contractVersion()` returns `4`; the frontend and indexer treat it identically to `DealLockV4`. Round 8's "Out of scope" list incorrectly said "No DealLockV5" — this is corrected in docs only.

**Backend changes**:
- Added `backend/src/config/env.ts` — centralized env validation module that:
  - Requires `DATABASE_URL`, `SESSION_SECRET`, `FRONTEND_ORIGIN`, `APP_URL` at startup
  - Rejects unsafe production configs: short `SESSION_SECRET`, `SESSION_STORE=memory`, `EMAIL_PROVIDER=console`, missing CORS origin, `SESSION_COOKIE_SECURE=false`
  - Requires RPC URLs when indexer is enabled; requires `FACTORY_CONTRACTS` when factory indexer is enabled
  - Throws in production on config errors; warns in development
- Added `backend/src/logger.ts` — structured JSON logger for production, human-readable for development; never logs secrets
- Updated `backend/src/index.ts`:
  - Added `helmet` for security headers
  - Added `express-rate-limit` with separate limiters for auth, email, and notification endpoints
  - Added JSON/URL-encoded body size limits (64 KB / 16 KB)
  - Production error handler no longer leaks stack traces
  - Uses `validateEnv()` at startup for fail-fast config checks
  - Logs startup config summary (no secrets)
- Updated `backend/src/indexer/runner.ts`:
  - Added PostgreSQL advisory lock (`pg_try_advisory_lock`) to prevent concurrent indexer processes from running simultaneously
  - Added `withRetry` helper with exponential backoff for RPC calls (3 attempts, 1s/2s/4s)
  - Uses structured logger instead of `console.log`
- Updated `backend/src/indexer/status.ts`:
  - `/health/indexer` now returns `latestSuccessfulRun`, `latestFailedRun` (separate), and `staleAgreements` count
- Updated `backend/src/email/transport.ts`:
  - Uses structured logger for email send success/failure
  - Structured failure logging visible in `EmailNotificationLog`
- Added `backend/Dockerfile` — multi-stage Node 20 Alpine image
- Added `docker-compose.production.example.yml` — production compose example with backend, PostgreSQL
- Updated `backend/.env.example` — complete documentation of all env vars with examples, SMTP provider guidance, and production notes
- Installed `helmet` and `express-rate-limit` packages

**Frontend changes**:
- Added testnet beta banner in `AppShell.tsx` — always-visible "Testnet Beta" notice
- Added `backendUnavailable` state in `DashboardPage.tsx` — shows "Backend unavailable" banner when API calls fail while signed in; contract interactions still work
- Added factory not configured notice in create mode — originally for legacy Factory V1/direct fallback; Round 10 later made Factory V2 the preferred path and ERC-20 requirement.
- Imported `isFactoryConfigured` in `DashboardPage.tsx`; Round 14 later switched the current create-mode notice to check Factory V2 first.

**Docs changes**:
- Added `docs/public_beta_checklist.md` — 15-step smoke test checklist for Sepolia public beta
- Updated `docs/state.md` — Round 9 section, V5 naming clarification, Round 8 correction
- Updated `README.md` — security middleware, deployment config, public beta checklist, V5 naming

**Verification**:
- `npx hardhat compile` — 6 contracts compiled cleanly (unchanged)
- `npx hardhat test` — 99/99 tests pass (unchanged)
- `backend`: `npm run build` — clean TypeScript compile
- `frontend`: `npx tsc --noEmit && npm run build` — zero TypeScript errors, clean bundle

**Out of scope** (as specified):
- No new escrow contract version or business logic
- No ERC-20 payments
- No platform fees
- No AI arbitration
- No Google OAuth
- No reputation system
- No upgradeable proxy system
- No backend custody or backend-controlled contract actions

---

### Round 10 — Stablecoin / ERC-20 Payments

**Status**: Implemented

**Goal**: Add a payment-layer upgrade that supports native ETH and standard ERC-20 payment assets, especially USDC-style stablecoins, without changing the V4 escrow workflow or adding fees/admin custody.

**Contract changes**:
- Added `contracts/DealLockMultiAsset.sol` — V4-compatible escrow mechanics with immutable `paymentToken`; `contractVersion()` returns `5`
- Added `contracts/DealLockFactoryV2.sol` — deploys `DealLockMultiAsset`, emits payment-aware `AgreementCreated`, and keeps the Round 8 registry helpers
- Added ERC-20 mocks: `MockUSDC`, `FeeOnTransferToken`, `BadReturnERC20`, and `ReentrantERC20`
- Native ETH path still requires exact `msg.value`
- ERC-20 path requires approve + fund and rejects direct ETH value
- Fee-on-transfer/tax tokens are rejected by exact balance-delta checks
- Transfer functions use non-reentrancy protection
- Existing Solidity contracts remain unchanged

**Frontend changes**:
- Added `frontend/src/tokens.ts` with `PaymentAsset`, `parseAssetAmount`, `formatAssetAmount`, configured ETH/USDC assets, and env-backed token addresses
- Added Factory V2 ABI/address helpers in `frontend/src/contractFactory.ts`
- Updated create flow with a payment asset selector, Factory V2 deployment, ERC-20-only Factory V2 requirement, and payment metadata persistence
- Updated dashboard version handling for `contractVersion() == 5`
- Updated funding and paid-adjustment funding UX for ERC-20 approve + fund, allowance/balance checks, and gas copy
- Updated overview, header, milestone list, adjustment list, and activity feed to format by payment asset rather than hardcoded ETH

**Backend/database/indexer changes**:
- Added migration `20260430030000_round10_multi_asset`
- Extended `Agreement` with `paymentAssetKind`, `paymentTokenAddress`, `paymentSymbol`, `paymentDecimals`, and `factoryVersion`
- Extended `ChainEvent` with `amountRaw`, `paymentTokenAddress`, `paymentSymbol`, and `paymentDecimals`
- Extended `FactoryContract` with `factoryVersion`
- Factory indexer now parses `FACTORY_V2_CONTRACTS`, decodes Factory V2 `AgreementCreated`, stores `paymentToken`, and labels configured USDC addresses
- Agreement event decoding treats version 5 as V4-compatible event ABI with payment metadata attached
- Activity API returns raw amount and payment metadata
- Notification templates can include formatted ETH/USDC amount labels

**Env/config changes**:
- Frontend: `VITE_DEALLOCK_FACTORY_V2_SEPOLIA`, `VITE_DEALLOCK_FACTORY_V2_HARDHAT`, `VITE_USDC_SEPOLIA_ADDRESS`, `VITE_USDC_HARDHAT_ADDRESS`
- Backend: `FACTORY_V2_CONTRACTS`, `USDC_SEPOLIA_ADDRESS`, `USDC_HARDHAT_ADDRESS`
- `FACTORY_CONTRACTS` remains for legacy Factory V1; `FACTORY_V2_CONTRACTS` is preferred for new agreements

**Deployment scripts**:
- Added `scripts/deploy-factory-v2-sepolia.ts`

**Post-implementation patches (review pass)**:
- Fixed logic bug in `CreateAgreementForm.tsx` hint text: first condition was `factoryConfigured` (dead-code second branch) instead of `factoryV2Configured`, so the V1-factory-only hint was never shown
- Added test 44: SafeERC20 rejects false return on `token.transfer` during `_sendPayment` (BadReturnERC20 path)
- Added test 45: `fundAdjustment` rejects insufficient ERC-20 allowance

**Verification**:
- `npx hardhat test test/DealLockMultiAsset.ts test/DealLockFactoryV2.ts` — 62/62 payment-layer tests passed
- `npx hardhat test` — 161/161 Solidity tests passed
- `cd backend && npx prisma generate` — Prisma client generated
- `cd backend && npm run build` — TypeScript build passed
- `cd backend && ./node_modules/.bin/tsx --test src/indexer/decode.test.ts` — 3/3 pure indexer decode tests passed, including Factory V2 payment-token event decode
- `cd frontend && npm run build` — TypeScript and production build passed
- `cd backend && npm test` did not complete in this environment; the PostgreSQL-backed test command requires an accessible local PostgreSQL test database and exited before migrations/tests ran

**Out of scope** (as specified):
- No platform fees
- No AI arbitration
- No Google OAuth
- No reputation system
- No multi-party agreements
- No cross-chain support
- No fiat payments
- No token swaps
- No gasless permit flow
- No admin-controlled token whitelist
- No upgradeable proxy system
- No backend-controlled contract actions

---

### Round 11 — Payment Layer Security Review and Invariant Testing

**Status**: Implemented

**Goal**: Security-focused validation of the Round 10 multi-asset payment layer. No new product features added.

**Contract changes**: None. Review confirmed no patches needed.

**New mock contract**:
- `contracts/mocks/MaliciousETHReceiver.sol` — configurable ETH receiver that attempts a reentrant call during `receive()`, silently absorbing the inner revert so the outer ETH transfer still completes. Used to verify the reentrancy guard blocks ETH-path reentrancy attacks.

**Security review findings**:
- CEI ordering verified in all outgoing-payment functions (`approveMilestone`, `refundExpiredMilestone`, `claimMilestoneAfterReview`, `acceptMilestoneSettlement`, `approveAdjustment`, `refundExpiredAdjustment`, `claimAdjustmentAfterReview`, `acceptAdjustmentSettlement`): state and accounting are updated to terminal values before any external call.
- `nonReentrant` guard on all fund-moving functions confirmed effective via ETH and ERC-20 reentrancy tests.
- `_collectPayment` exact balance-delta check confirmed to reject fee-on-transfer tokens for both `fundAgreement` and `fundAdjustment`.
- `SafeERC20.safeTransfer` confirmed to reject false-return tokens in both `transferFrom` (collect) and `transfer` (send) paths.
- Failed ETH transfer causes full transaction revert — no partial state persists.
- Unrelated token transfers to an agreement do not affect `getContractBalance()`.
- Settlement splits verified across 0%/25%/50%/75%/100% provider-share configurations for both ETH and ERC-20.
- Double-release, double-refund, and double-settlement acceptance all blocked by state checks.
- `releasedAmount + refundedAmount + getContractBalance() == totalAmount` invariant holds at every step for ETH and ERC-20.
- `adjustmentReleasedAmount + adjustmentRefundedAmount == adjustmentFundedAmount` invariant holds after all adjustments resolve.
- Factory V2 events decoded correctly; payment metadata stored for indexer/activity/notifications.

**New test file**: `test/DealLockMultiAsset_Security.ts` — 39 new tests across 7 categories:
- **A. Reentrancy** (4 tests): ETH `approveMilestone` + `refundExpiredMilestone` with `MaliciousETHReceiver`; ERC-20 token-hook reentrancy blocked by guard + "Only client" access control; duplicate `fundAgreement` blocked by state check.
- **B. CEI + Failed Transfer Rollback** (5 tests): Non-payable provider → `Transfer failed` → state unchanged; `BadReturnERC20` on `approveMilestone`, `claimMilestoneAfterReview`, `refundExpiredMilestone`, and `acceptMilestoneSettlement` all cause full rollback.
- **C. Double-Action Prevention** (8 tests): Each fund-moving function rejects re-entry on already-terminal items; settlement accepts own-proposal and cancelled-proposal rejection.
- **D. Settlement Split Invariants** (8 tests): ETH 0%/50%/100%; ERC-20 0%/75%/100%; adjustment settlement; overflow revert; own-proposal and cancelled-proposal rejection.
- **E. Balance Accounting Invariants** (4 tests): Full-lifecycle balance tracking (ETH + ERC-20) and step-by-step `released + refunded + held == total` assertion.
- **F. Wrong-Asset Rejection** (7 tests): Unrelated ERC-20 to ETH/ERC-20 agreements; missing `msg.value`; overfunding; ERC-20 agreement with `msg.value`; fee-on-transfer in adjustment; wrong-token funding.
- **G. Adjustment Accounting** (3 tests): `adjustmentFundedAmount` sum; released + refunded == funded invariant; completion blocked while funded adjustment is non-terminal.

**Verification**:
- `npx hardhat compile` — no new contract compilation needed (only `MaliciousETHReceiver` mock)
- `npx hardhat test` — 200/200 tests pass (161 prior + 39 Round 11)
- `cd backend && npm run build` — clean TypeScript compile
- `cd backend && ./node_modules/.bin/tsx --test src/indexer/decode.test.ts` — 3/3 decode tests pass
- `cd frontend && npm run build` — clean production build

**Known limitations**:
- `npm test` (PostgreSQL-backed integration tests) was not run in this environment. Requires a local PostgreSQL instance at `DATABASE_URL_TEST`. Run `cd backend && npm test` after starting PostgreSQL locally or in CI.
- At the time of Round 11, Solidity static analysis tools such as Slither and Solhint were not configured; Solhint was later added in Round 13.

**Out of scope** (as specified):
- No platform fees, AI arbitration, Google OAuth, reputation, multi-party, cross-chain, fiat, token swaps, gasless permit, admin whitelist, proxy upgrades, or backend-controlled contract actions.

---

### Round 12 — End-to-End Public Beta Release Candidate

**Status**: Implemented

**Goal**: Turn the system into a testable public-beta release candidate by validating the full product flow end-to-end across local setup, Factory V2, MockUSDC, multi-asset agreements, PostgreSQL, indexer discovery, activity feed, and notification logs. No new escrow logic was added.

**Changes**:

- **Bootstrap script** (`scripts/bootstrap-local-rc.ts`): Hardhat script that deploys `MockUSDC` and `DealLockFactoryV2` to a running local Hardhat node, mints 10,000 test USDC to accounts 0 and 1, writes `frontend/.env.local` (`VITE_DEALLOCK_FACTORY_V2_HARDHAT`, `VITE_USDC_HARDHAT_ADDRESS`) and `backend/.env.local` (`FACTORY_V2_CONTRACTS`, `USDC_HARDHAT_ADDRESS`, `INDEXER_ENABLED`, `FACTORY_INDEXER_ENABLED`, `HARDHAT_RPC_URL`), and prints next steps. Does not overwrite existing unrelated env keys.
- **Root package.json rc:* scripts**: `rc:hardhat`, `rc:bootstrap`, `rc:test:contracts`, `rc:test:backend`, `rc:test:indexer`, `rc:test:frontend`, `rc:check` for one-command local RC setup and verification.
- **Backend `test:indexer` script**: `npm run test:indexer` resets the test DB, applies migrations, and runs `src/indexer/indexer.integration.test.ts`.
- **Backend `db:test:reset` script**: Standalone script to reset/create the test database without running the full test suite.
- **Indexer integration test** (`backend/src/indexer/indexer.integration.test.ts`): End-to-end test that deploys `MockUSDC` and `DealLockFactoryV2` on a local Hardhat node via viem, creates ETH and USDC agreements, runs `syncFactory`, asserts Agreement rows have correct `factoryVersion`, `contractVersion`, and payment metadata, performs `fundAgreement`, runs `syncAgreement`, asserts `ChainEvent` rows, and verifies idempotency on a second run. Skips automatically if Hardhat is unreachable or the test DB is unavailable.
- **Frontend error messages** (`frontend/src/network.ts`): Added `humanizeContractError(err)` utility that converts raw wallet/contract errors to human-readable messages: user rejection, insufficient gas ETH, insufficient ERC-20 allowance, wrong network, contract reverts, RPC failures. Used in both `CreateAgreementForm.tsx` and `ActionPanel.tsx`.
- **`docs/public_beta_checklist.md`**: Replaced with a two-part checklist — Part A (local RC smoke test, 23 steps) and Part B (Sepolia public beta smoke test, 15 steps). Covers the full ETH and USDC agreement flows, indexer idempotency, and production hardening.
- **`README.md`**: Added local RC setup section with five-step quickstart, bootstrap script description, quick verification commands, ETH vs USDC payment assets table, and updated public beta checklist reference.

**Verification**:
- `npx hardhat compile` — clean, no new contracts
- `npx hardhat test` — 200/200 Solidity tests pass (unchanged from Round 11)
- `cd backend && npm run build` — clean TypeScript compile
- `cd backend && ./node_modules/.bin/tsx --test src/indexer/decode.test.ts` — 3/3 decode tests pass
- `cd frontend && npm run build` — clean production build

**Known limitations**:
- `npm test` (PostgreSQL-backed integration tests) was not run in the Round 12 implementation environment. Requires a local PostgreSQL instance at `DATABASE_URL_TEST`. Run `cd backend && npm test` after starting PostgreSQL locally or in CI. Round 13 later added CI/release-gate automation for this PostgreSQL-backed backend test path.
- `npm run test:indexer` (indexer integration test) was not run in the Round 12 implementation environment. Requires a running Hardhat node at `HARDHAT_RPC_URL` and a test PostgreSQL DB. Run after `npm run rc:hardhat` and `npm run db:test:reset`. Round 13 later added CI/release-gate automation for the real indexer integration test.

**Out of scope** (as specified):
- No new production escrow business logic or contract version was added; the bootstrap script deploys `MockUSDC` and `DealLockFactoryV2` to the local Hardhat node for RC testing only — these are not new protocol contracts
- No platform fees, AI arbitration, Google OAuth, reputation, multi-party, cross-chain, fiat, token swaps, gasless permit, admin whitelist, proxy upgrades, or backend-controlled contract actions

---

### Round 13 — CI, Static Analysis, and Public Beta Release Gate

**Status**: Implemented locally; pending CI confirmation

**Goal**: Add automated CI, practical Solidity linting, and a repeatable local public-beta release gate. This closes the Round 11/12 gap where PostgreSQL-backed backend tests and the real indexer integration test required local services and were not part of an automated gate. No escrow logic or new product feature was added.

**Changes**:
- Added `.github/workflows/ci.yml` with separate jobs for contracts, backend, indexer integration, and frontend.
- Contracts CI installs root dependencies, runs `npm run lint:contracts`, `npx hardhat compile`, and `npx hardhat test`.
- Backend CI runs against a PostgreSQL service, generates Prisma client, resets/deploys migrations to the dedicated test DB, builds, and runs `npm test`.
- Indexer integration CI runs against PostgreSQL plus a background local Hardhat node and executes `cd backend && npm run test:indexer`.
- Frontend CI installs frontend dependencies and runs `npm run build`.
- Added Solhint dev dependency plus `.solhint.json`, `.solhintignore`, and root `lint:contracts` script.
- Added `scripts/release-check.mjs` and root `release:check` script. The local gate runs Solhint, Hardhat compile/tests, backend Prisma generation/build/PostgreSQL tests, starts or reuses a Hardhat RPC for `test:indexer`, and runs the frontend build.
- Improved `backend/src/testDatabase.ts` so missing PostgreSQL produces an explicit test database setup message.
- Updated `README.md`, `docs/public_beta_checklist.md`, and this state file with CI/release-gate instructions.

**Verification commands**:
- `npm run lint:contracts`
- `npx hardhat compile`
- `npx hardhat test`
- `cd backend && npm run build`
- `cd backend && npm test`
- `cd backend && npm run test:indexer`
- `cd frontend && npm run build`
- `npm run release:check`

**Verification during implementation**:
- `npm run lint:contracts` — passed
- `npx hardhat compile` — passed
- `npx hardhat test` — 200/200 Solidity tests passed
- `cd backend && npx prisma generate` — passed
- `cd backend && npm run build` — passed
- `cd frontend && npm run build` — passed
- `cd backend && npm test` — could not complete because PostgreSQL was not reachable at `localhost:5432`
- `cd backend && npm run test:indexer` — could not complete because PostgreSQL was not reachable at `localhost:5432`
- `npm run release:check` — not run because Docker/PostgreSQL was unavailable in this environment

**Out of scope** (as specified):
- No new contract version
- No escrow business logic changes
- No milestone, adjustment, dispute, settlement, funding, refund, or payment behavior changes
- No platform fees, arbitration, AI arbitration, Google OAuth, reputation, proxy upgrades, token swaps, gasless permit, or backend-controlled contract actions

---

### Round 14 — Full Project Review, Cleanup, and Release-Readiness Pass

**Status**: Implemented locally; pending full PostgreSQL release-gate run

**Goal**: Review the complete repository after Rounds 1-13 and clean up safe inconsistencies without changing escrow business logic, contract versions, or product scope.

**Changes**:
- Fixed Hardhat 3 deployment scripts (`deploy-factory-sepolia.ts`, `deploy-factory-v2-sepolia.ts`, `bootstrap-local-rc.ts`) to use `hre.network.create()` instead of the old `hre.ethers` runtime shape.
- Updated local RC bootstrap output so it matches backend `.env.local` auto-loading and prints correct next steps.
- Fixed the create-mode dashboard notice to check Factory V2 first: Factory V2 missing means ERC-20 creation is unavailable; native ETH can use legacy Factory V1 or direct V4 fallback.
- Cleaned up current docs and comments to describe V2+, V3+, and V4/V5-compatible paths instead of stale V4-only wording.
- Updated `README.md`, `docs/round_12.md`, and this state file for script and versioning consistency.
- Normalized root `package.json` `private` to a boolean.

**Verification commands**:
- `npm run lint:contracts`
- `npx hardhat compile`
- `npx hardhat test`
- `cd backend && npm run build`
- `cd backend && npm test`
- `cd backend && npm run test:indexer`
- `cd frontend && npm run build`
- `npm run release:check`

**Out of scope**:
- No Solidity behavior changes
- No new escrow business logic or contract version
- No platform fees, arbitration, AI arbitration, Google OAuth, reputation, proxy upgrades, token swaps, gasless permit, or backend-controlled contract actions

### Round 15 — Deadline Grace Window and Client-Approved Deadline Extensions

**Status**: Implemented locally; pending full PostgreSQL release-gate run

**Goal**: Add V6 deadline behavior without changing old deployed versions: a 30-minute deadline grace window, provider deadline extension requests, and Factory V3 as the preferred new-agreement path.

**Changes**:
- Added `contracts/DealLockMultiAssetV2.sol` with `contractVersion() == 6`, `DEADLINE_GRACE_PERIOD = 30 minutes`, and `REFUND_GRACE_PERIOD` as a compatibility alias.
- Added milestone and adjustment deadline extension request flows: provider request/cancel, client accept/reject, and only acceptance updates the deadline.
- Added post-grace submission cutoffs for pending milestones and funded adjustments; client refunds remain unavailable until `deadline + DEADLINE_GRACE_PERIOD`.
- Added `contracts/DealLockMultiAssetV2Deployer.sol` as a V6 deployment helper so Factory V3 stays under the EVM contract-size limit; Round 17 later changed it to chunked bytecode deployment.
- Added `contracts/DealLockFactoryV3.sol` with Factory V2-style payment metadata and `factoryVersion() == 3`; Factory V3 deploys V6 agreements through the helper and remains deployment/discovery only.
- Updated frontend version handling, Factory V3 preference, V6 ABI, V6 extension reads/writes, milestone/adjustment timing display, and extension request/accept/reject/cancel UI.
- Updated backend agreement validation, factory/indexer config, event ABIs, notification/action labels, activity mapping, and indexer integration coverage for `contractVersion = 6` and Factory V3.
- Updated local RC bootstrap to deploy MockUSDC, Factory V2, the V6 deployer, and Factory V3 while writing safe local env files.
- Added `test/DealLockMultiAssetV2_DeadlineExtensions.ts` covering V6 deadline behavior, extension lifecycle, payment regressions, Factory V3 metadata, and Factory V2 regression.

**Configuration additions**:
- Frontend: `VITE_DEALLOCK_FACTORY_V3_SEPOLIA`, `VITE_DEALLOCK_FACTORY_V3_HARDHAT`
- Backend: `FACTORY_V3_CONTRACTS`

**Verification commands**:
- `npm run lint:contracts`
- `npx hardhat compile`
- `npx hardhat test`
- `cd backend && npm run build`
- `cd backend && npm test`
- `cd backend && npm run test:indexer`
- `cd frontend && npm run build`
- `npm run release:check`

**Out of scope**:
- No changes to V1-V5 deployed behavior
- No platform fees, arbitration, AI arbitration, Google OAuth, reputation, proxy upgrades, token swaps, gasless permit, or backend-controlled contract actions

---

### Round 16 — Cooperative Milestone Revision Requests

**Status**: Implemented locally; pending full PostgreSQL release-gate run

**Goal**: Add a cooperative revision workflow to V6 (`DealLockMultiAssetV2`) so the client can request fixes during the review period and the provider can accept, negotiate, or reject — without touching escrow payment behavior, ERC-20 logic, fees, factory behavior, or arbitration.

**Contract changes** (`contracts/DealLockMultiAssetV2.sol`):
- Added `MilestoneState.RevisionRequested = 6` (appended at end — all prior numeric state values preserved)
- Added `revisionCount uint256` to `Milestone` struct
- Added `RevisionInfo` struct: `exists`, `providerDeadlineRequestExists`, `requestedBy`, `revisionRound`, `requestedAt`, `revisionDeadline`, `providerRequestedDeadline`, `providerDeadlineRequestedAt`, `reason`, `providerDeadlineReason`
- Added `mapping(uint256 => RevisionInfo) private _milestoneRevisions`
- New events: `MilestoneRevisionRequested`, `MilestoneRevisionDeadlineRequested`, `MilestoneRevisionDeadlineUpdated`, `MilestoneRevisionAccepted`, `MilestoneRevisionRejected`
- New write functions: `requestMilestoneRevision` (client, during review window), `acceptMilestoneRevision` (provider — resets to Pending, increments revisionCount, deletes RevisionInfo), `rejectMilestoneRevision` (provider — creates DisputeInfo, deletes RevisionInfo), `requestRevisionDeadline` (provider — stores alternative proposal only), `setRevisionDeadline` (client — updates active deadline)
- New read functions: `getMilestoneRevision`, `getMilestoneRevisionCount`
- `claimMilestoneAfterReview` blocked while `RevisionRequested` is active

**Tests**:
- Added `test/DealLockMultiAssetV2_RevisionRequests.ts` with 12 tests
- The Round 16 Solidity suite passed; Round 17 later expands current coverage to 231 total Solidity tests

**Hardhat config note**:
- Round 16 temporarily used `allowUnlimitedContractSize` on the Hardhat v3 `"default"` EDR network while the V6 deployer-size issue was still open. Round 17 removed that workaround by switching the V6 deployer to chunked bytecode storage and adding an explicit bytecode-size check.

**Frontend changes**:
- `types.ts` — added `"RevisionRequested"` at index 6 in `MILESTONE_STATES`; added `RevisionInfo` interface
- `contractV6.ts` — extended `DEALLOCK_V6_EXTENSION_ABI` with 9 revision read/write entries
- `MilestoneList.tsx` — added `"?"` glyph for `RevisionRequested` state
- `DashboardPage.tsx` — batch `getMilestoneRevision` and `getMilestoneRevisionResponseDeadline` reads for V6 agreements; passes revision data to `ActionPanel`
- `ActionPanel.tsx` — three new V6 action groups: client "Request fixes" form; provider "Respond to revision" (accept / request deadline / reject); client "Update revision deadline"; Round 17 later restored direct dispute for V6 submitted milestones as the emergency/manual path

**Backend/indexer changes**:
- `contractActions.ts` — 5 new revision action types
- `indexer/abis.ts` — `V6_REVISION_EVENTS` merged into `DEALLOCK_V6_EVENTS`
- `indexer/eventMap.ts` — notification routing rules for all 5 revision events
- `api/notifications.ts` — 5 revision action type strings added to `ContractActionType`

**Verification commands**:
- `npm run lint:contracts`
- `npx hardhat compile`
- `npx hardhat test`
- `cd backend && npm run build`
- `cd backend && npm test`
- `cd backend && npm run test:indexer`
- `cd frontend && npm run build`
- `npm run release:check`

**Out of scope**:
- No changes to V1-V5 deployed behavior
- No escrow payment behavior, ERC-20 logic, fees, factory behavior, or arbitration changes
- No platform fees, AI arbitration, Google OAuth, reputation, proxy upgrades, token swaps, gasless permit, or backend-controlled contract actions

---

### Round 17 — V6 Release Blocker Cleanup and Consistency Pass

**Status**: Implemented locally; pending full PostgreSQL release-gate run

**Goal**: Remove V6/Factory V3 release blockers before public beta by making deployed bytecode and tests production-realistic, preventing accidental ETH from being sent to Factory V3, adding a liveness path for ignored revision requests, and cleaning stale docs.

**Contract/deployment changes**:
- Reworked `DealLockMultiAssetV2Deployer` so V6 creation bytecode is split into deployable code chunks instead of being embedded in Factory V3 or stored as a single expensive storage blob.
- Removed the Hardhat `allowUnlimitedContractSize` workaround from `hardhat.config.ts`.
- Added `scripts/check-bytecode-size.mjs` and `npm run check:bytecode`; current deployed-bytecode sizes are below 24,576 bytes for V6, the chunk helper/template, the deployer, Factory V3, and the actual V6 creation-code chunks.
- Confirmed `DealLockFactoryV3.createAgreement(...)` is non-payable and added a regression test proving accidental ETH is rejected.

**V6 revision liveness**:
- Added `REVISION_RESPONSE_PERIOD = 3 days` liveness behavior via `escalateMilestoneRevisionToDispute`.
- Added `getMilestoneRevisionResponseDeadline` and `MilestoneRevisionEscalated`.
- Ignored revision requests can now become `Disputed` after the response period; extension/deadline negotiation alone still does not block refund or settlement paths.
- Direct client dispute during the V6 review window remains available as the manual/emergency path; Request fixes is the cooperative path.

**Frontend/backend changes**:
- `contractV6.ts` includes the revision response-deadline read and escalation write.
- `ActionPanel.tsx` shows direct dispute copy for V6 review, displays the provider response deadline, and exposes client escalation after timeout.
- Backend/indexer ABIs, activity mapping, notification labels, and frontend notification action types now include `revision_escalated`.
- Local RC, Sepolia Factory V3 deployment, and indexer integration deployment paths pass the V6 creation bytecode chunks to the deployer.

**Tests**:
- Added revision liveness tests for response deadline, blocked early escalation, successful timeout escalation, settlement after escalation, and direct V6 dispute during review.
- Added Factory V3 accidental-ETH rejection coverage.

**Verification commands**:
- `npm run lint:contracts`
- `npx hardhat compile`
- `npm run check:bytecode`
- `npx hardhat test`
- `cd backend && npm run build`
- `cd backend && npm test`
- `cd backend && npm run test:indexer`
- `cd frontend && npm run build`
- `npm run release:check`

**Out of scope**:
- No changes to V1-V5 deployed behavior
- No new escrow product features beyond the V6 revision liveness path required for funds not to remain stuck
- No platform fees, arbitration, AI arbitration, Google OAuth, reputation, proxy upgrades, token swaps, gasless permit, or backend-controlled contract actions

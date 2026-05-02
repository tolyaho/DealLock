# Round 17 — V6 Release Blocker Cleanup and Consistency Pass

## Status
Implemented locally; pending full PostgreSQL release-gate run

## Goal
Fix the release-blocking issues introduced around Round 15 and Round 16 before public beta. This round must make V6/Factory V3 production-deployable, prevent revision requests from locking funds forever, and clean up documentation/state inconsistencies.

This is a cleanup and release-readiness round. Do **not** add unrelated product scope.

## Non-goals
- No changes to V1-V5 deployed behavior
- No platform fees
- No arbitration or AI arbitration
- No Google OAuth
- No reputation system
- No proxy upgrade system
- No token swaps
- No gasless permit flow
- No backend-controlled contract actions
- No backend escrow authority

---

## 1. Verify and fix V6 deployed bytecode size

Round 16 enabled `allowUnlimitedContractSize` locally because V6/deployer size became large. This is a release blocker.

Check deployed bytecode size for:

- `DealLockMultiAssetV2`
- `DealLockMultiAssetV2Deployer`
- `DealLockFactoryV3`

Add a script or command that reports deployed bytecode size in bytes and compares it against the EVM limit:

```text
24576 bytes
```

If any deployed contract exceeds the limit, refactor so it is deployable on Sepolia/mainnet. Do **not** rely on `allowUnlimitedContractSize` as the production solution.

Preferred fixes:
- reduce duplicated code
- avoid embedding huge creation bytecode if it makes the deployer too large
- move deployment-only logic out of oversized contracts
- simplify V6 where possible without changing intended behavior

Acceptance:
- `DealLockMultiAssetV2`, deployer, and Factory V3 deployed bytecode are all below 24,576 bytes
- tests do not hide a production deployment issue behind `allowUnlimitedContractSize`
- V6 behavior remains compatible with the intended Round 15/16 design

---

## 2. Fix Factory V3 accidental ETH acceptance

`DealLockFactoryV3.createAgreement(...)` must be non-payable:

```solidity
external returns (address agreement)
```

Factories must not hold funds, collect fees, or accidentally accept ETH.

Preferred fix:

```solidity
external returns (address agreement)
```

If `payable` is technically required for some reason, add:

```solidity
require(msg.value == 0, "Factory does not accept ETH");
```

Add or update tests proving that accidental ETH sent to Factory V3 agreement creation is rejected.

---

## 3. Fix V6 revision liveness

Round 16 blocks provider auto-release while a milestone is in `RevisionRequested`. That is good, but there must be a liveness path if the provider ignores the revision request forever.

Preferred design:

- client requests revision during the review window
- milestone moves to `RevisionRequested`
- provider can accept revision, reject into dispute, or request an alternative deadline
- if provider does not respond before a response deadline, the client can escalate the milestone to `Disputed`

Add a clear constant, for example:

```solidity
uint256 public constant REVISION_RESPONSE_PERIOD = 3 days;
```

or reuse a sensible existing period if cleaner.

Add:
- a read helper if useful
- an event for timeout/escalation if useful
- tests that ignored revision requests can become disputed after timeout
- tests that auto-release remains blocked while revision is active
- tests that funds cannot be stuck forever because of an unanswered revision request

Do not allow revision requests to silently lock funds forever.

---

## 4. Make V6 direct dispute behavior consistent

Docs say the client can approve or dispute during review, but Round 16 documentation said the V6 raw dispute action was hidden for submitted milestones.

Make this consistent.

Preferred product behavior:

- direct dispute remains available during review as an emergency/manual path
- cooperative revision request is the softer recommended path
- UI copy should explain the difference:
  - `Request fixes` = cooperative revision flow
  - `Dispute` = locks funds for mutual settlement

If direct dispute is kept:
- restore or keep the V6 client dispute action for submitted milestones during review
- make UI copy clear
- update docs accordingly

If direct dispute is intentionally removed:
- update all docs to say V6 uses revision-first escalation
- ensure timeout/escalation prevents stuck funds

Preferred outcome: keep direct dispute available.

---

## 5. Fix stale docs and state descriptions

Update all relevant docs so Round 15/16 state is internally consistent.

At minimum update:

### Backend `Agreement` model docs

Change:

```text
contractVersion (1, 2, 3, 4, or 5; default 1)
```

To:

```text
contractVersion (1, 2, 3, 4, 5, or 6; default 1)
```

### Backend `FactoryContract` model docs

Use wording like:

```text
contractVersion: 4 for Factory V1, 5 for Factory V2, 6 for Factory V3
factoryVersion: 1, 2, or 3
```

### Frontend env docs

Add:

```env
VITE_DEALLOCK_FACTORY_V3_SEPOLIA=
VITE_DEALLOCK_FACTORY_V3_HARDHAT=
```

### Backend env docs

Document:

```env
FACTORY_V3_CONTRACTS=
```

### Frontend utility docs

Update:

```text
contractFactory.ts — Factory V1/V2/V3 ABIs and address helpers
contractVersion.ts — detectContractVersion() → 1 | 2 | 3 | 4 | 5 | 6
unknown future value > 6 → 6
```

### Reading data flow

Update stale V5-only wording to include V6:

```text
V3/V4/V5/V6: reads REFUND_GRACE_PERIOD
V4/V5/V6: reads reviewPeriod
V4/V5/V6: reads review/dispute/settlement data
V5/V6: reads paymentToken()
V6: reads deadline extension and revision request data
```

### Intentional scope limits

If the old docs still say `No milestone revision`, replace that with:

```text
No unilateral milestone editing — V6 supports cooperative revision requests only. Original amount, payment asset, milestone order, and settlement rules are unchanged.
```

---

## 6. Update tests

Add or update tests for:

- Factory V3 rejects accidental ETH
- V6 deployed bytecode size is below the EVM limit, or a script/check documents it clearly
- revision requests cannot lock funds forever
- timeout/escalation behavior works
- direct dispute behavior is consistent with the chosen design
- V1-V5 regressions remain unchanged

Implemented result: Solidity coverage increased from 226 to 231 tests.

---

## 7. Verification commands

Run and report results:

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

If PostgreSQL is unavailable locally, say that clearly and still run every command that does not require PostgreSQL.

---

## 8. Files to update

Likely affected files:

- `contracts/DealLockMultiAssetV2.sol`
- `contracts/DealLockMultiAssetV2Deployer.sol`
- `contracts/DealLockFactoryV3.sol`
- `test/DealLockMultiAssetV2_DeadlineExtensions.ts`
- `test/DealLockMultiAssetV2_RevisionRequests.ts`
- new bytecode-size script or test if useful
- `frontend/src/contractV6.ts`
- `frontend/src/types.ts`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/components/ActionPanel.tsx`
- `frontend/src/components/MilestoneList.tsx`
- `backend/src/contractActions.ts`
- `backend/src/indexer/abis.ts`
- `backend/src/indexer/eventMap.ts`
- `frontend/src/api/notifications.ts`
- `docs/state.md`
- `docs/round_15.md`
- `docs/round_16.md`
- `README.md`
- `docs/public_beta_checklist.md`

---

## Final response format

When done, summarize:

1. What was fixed
2. Whether V6/Factory V3 are deployable under the 24,576-byte EVM limit
3. What tests were added
4. Exact verification commands run and results
5. Any remaining known limitations

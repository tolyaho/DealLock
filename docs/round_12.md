# Round 12 — End-to-End Public Beta Release Candidate

## Status

Planned

## Goal

Turn the current DealLock system into a testable public-beta release candidate by validating the full product flow end-to-end:

frontend → wallet → Factory V2 → DealLockMultiAsset → backend registry → PostgreSQL → indexer → activity feed → notification logs/email

Round 12 must not add new escrow business logic. The purpose is release confidence, integration reliability, repeatable local setup, and beta-readiness.

The main risk after Round 10/11 is no longer only the smart contract. The main risk is whether the full product works reliably across multiple moving parts.

---

## Context

DealLock currently has:

- Wallet-signature accounts
- Multi-wallet accounts
- PostgreSQL backend persistence
- Verified email identity and notification preferences
- App-triggered notifications
- Event indexer
- Factory V2 deployment path
- Multi-asset ETH/ERC-20 escrow via `DealLockMultiAsset`
- Heavy payment-layer security tests from Round 11

However, the system still needs a proper release-candidate workflow:

- One-command local setup
- Full local environment bootstrapping
- MockUSDC deployment and configuration
- Factory V2 deployment and configuration
- Real PostgreSQL-backed backend tests
- Indexer end-to-end test, not only decode tests
- Frontend beta UX checks for ETH vs USDC flows
- Updated public beta smoke checklist

---

## Non-Goals

Do not add:

- New Solidity escrow business logic
- New contract version
- Platform fees
- AI arbitration
- Google OAuth
- Reputation
- Multi-party agreements
- Cross-chain support
- Fiat payments
- Token swaps
- Gasless permit flow
- Upgradeable proxy system
- Backend-controlled contract actions

Round 12 is a release-candidate hardening and integration round.

---

## Required Outcomes

By the end of Round 12, a developer should be able to:

1. Start the full local stack from a clean checkout.
2. Deploy local Factory V2 and MockUSDC.
3. Automatically configure frontend/backend env files for local testing.
4. Create ETH and USDC agreements through the frontend.
5. Complete a full client/provider workflow.
6. See backend agreement records created.
7. Run the indexer and see ChainEvent rows created.
8. See activity feed entries in the frontend.
9. See notification logs created without duplicate emails.
10. Run Solidity, backend, indexer, and frontend checks with clear commands.
11. Follow a public beta checklist before deploying to Sepolia.

---

## Part 1 — Local Release Candidate Bootstrap

### Add a local bootstrap script

Create a script that prepares a complete local release-candidate environment.

Suggested file:

```txt
scripts/bootstrap-local-rc.ts
```

The script should:

1. Check that local Hardhat RPC is reachable at `http://127.0.0.1:8545`.
2. Deploy `MockUSDC`.
3. Deploy `DealLockFactoryV2`.
4. Print the deployed addresses.
5. Write or update local env files:
   - `frontend/.env.local`
   - `backend/.env.local` or clear instructions for copying into `backend/.env`
6. Set:
   - `VITE_DEALLOCK_FACTORY_V2_HARDHAT`
   - `VITE_USDC_HARDHAT_ADDRESS`
   - `FACTORY_V2_CONTRACTS`
   - `FACTORY_INDEXER_ENABLED=true`
   - `INDEXER_ENABLED=true`
   - `USDC_HARDHAT_ADDRESS`
   - `HARDHAT_RPC_URL`
7. Optionally mint MockUSDC to the default local client wallet.
8. Print the next commands to run.

Do not overwrite user secrets accidentally. If env files already exist, either update only known DealLock local keys or create `.env.local.generated`.

### Add package scripts

At root level, add convenient scripts if missing:

```json
{
  "scripts": {
    "rc:hardhat": "npx hardhat node",
    "rc:bootstrap": "npx hardhat run scripts/bootstrap-local-rc.ts --network localhost",
    "rc:test:contracts": "npx hardhat test",
    "rc:test:backend": "cd backend && npm test",
    "rc:test:indexer": "cd backend && npm run test:indexer",
    "rc:test:frontend": "cd frontend && npm run build",
    "rc:check": "npm run rc:test:contracts && npm run rc:test:indexer && cd backend && npm run build && cd ../frontend && npm run build"
  }
}
```

Adjust to the actual project package structure.

---

## Part 2 — PostgreSQL-Backed Backend Test Reliability

### Goal

Remove the Round 10/11 limitation where backend tests could not run without a PostgreSQL test database.

### Requirements

Backend tests must have a clear and repeatable path:

1. Start PostgreSQL with Docker Compose.
2. Create/use `DATABASE_URL_TEST`.
3. Reset test DB.
4. Apply migrations.
5. Run backend tests.

Update or add:

```txt
backend/src/testDatabase.ts
backend/package.json
backend/README.md or root README.md
```

### Required scripts

Add or verify:

```json
{
  "scripts": {
    "db:test:reset": "...",
    "test": "..."
  }
}
```

The backend test command should fail clearly if `DATABASE_URL_TEST` is missing or unreachable.

### Required tests

Backend tests should verify at least:

- wallet sign-in nonce creation
- wallet sign-in verification
- linked wallet uniqueness
- agreement upsert with payment metadata
- Factory V2 metadata persistence
- email verification token hashing/reuse prevention
- notification preference updates
- notification log dedupe

---

## Part 3 — Indexer End-to-End Test

### Current limitation

Round 7/10 has pure decode tests, but Round 12 should add an end-to-end indexer test that uses an actual local deployed factory and agreement.

### Add an indexer integration test

Suggested file:

```txt
backend/src/indexer/indexer.integration.test.ts
```

The test should:

1. Use a local Hardhat chain.
2. Deploy `MockUSDC`.
3. Deploy `DealLockFactoryV2`.
4. Create an ETH agreement through Factory V2.
5. Create a USDC agreement through Factory V2.
6. Insert or configure Factory V2 in `FactoryContract` or test config.
7. Run indexer once.
8. Assert:
   - Agreement rows are created.
   - `creationSource == "factory"`.
   - `factoryVersion == 2`.
   - `contractVersion == 5`.
   - payment metadata is stored correctly.
9. Perform at least one agreement action:
   - provider accepts
   - client funds
   - provider submits
   - client approves
10. Run indexer once again.
11. Assert:
   - `ChainEvent` rows exist.
   - event names are correct.
   - `amountRaw` is correct.
   - payment metadata is attached.
   - duplicate second indexer run does not duplicate rows.

### Important

The indexer integration test must be idempotent and safe to run repeatedly.

Use unique test DB state per run or clear relevant tables before the test.

---

## Part 4 — Frontend Beta UX Hardening

### Goal

Make the ETH vs USDC flow extremely clear and difficult to misuse.

### Required frontend checks

Improve the create/fund UI so that:

1. Payment asset selector clearly shows:
   - ETH
   - USDC, if configured
2. If USDC is selected:
   - show "USDC is used for escrow payment"
   - show "ETH is still required for gas"
   - show token address in a compact/copyable format
3. If Factory V2 is missing:
   - prevent ERC-20 agreement creation
   - show a clear setup message
4. If the user lacks ERC-20 balance:
   - show insufficient balance before transaction
5. If the user lacks allowance:
   - show approve step first
6. After approval:
   - refresh allowance before enabling fund
7. If the agreement is ETH-based:
   - never show ERC-20 approval UI
8. If the agreement is ERC-20-based:
   - never send native ETH as escrow value
9. Transaction errors should be converted into human-readable messages:
   - insufficient funds
   - insufficient allowance
   - wrong network
   - user rejected transaction
   - unsupported token/factory not configured

### Suggested files

```txt
frontend/src/components/CreateAgreementForm.tsx
frontend/src/components/ActionPanel.tsx
frontend/src/components/AgreementOverview.tsx
frontend/src/components/MilestoneList.tsx
frontend/src/components/AdjustmentList.tsx
frontend/src/tokens.ts
frontend/src/network.ts
```

---

## Part 5 — End-to-End Manual Smoke Checklist

Create or update:

```txt
docs/public_beta_checklist.md
```

The checklist must include two sections:

1. Local release-candidate smoke test
2. Sepolia public beta smoke test

### Local checklist must include

- Start PostgreSQL.
- Run migrations.
- Start Hardhat node.
- Deploy Factory V2 and MockUSDC.
- Configure frontend/backend env.
- Start backend.
- Start frontend.
- Sign in with client wallet.
- Add verified email using console provider.
- Link provider wallet or use second browser profile.
- Create ETH agreement.
- Provider accepts.
- Client funds.
- Provider submits.
- Client approves.
- Confirm activity feed updates.
- Confirm ChainEvent rows exist.
- Confirm notification log exists.
- Create USDC agreement.
- Approve USDC.
- Fund USDC agreement.
- Complete a milestone.
- Create paid adjustment.
- Fund adjustment.
- Submit and settle/approve adjustment.
- Run indexer once manually.
- Confirm no duplicate events/logs.

### Sepolia checklist must include

- Deploy Factory V2 to Sepolia.
- Configure `VITE_DEALLOCK_FACTORY_V2_SEPOLIA`.
- Configure `FACTORY_V2_CONTRACTS`.
- Configure Sepolia USDC test token address, if available.
- Run backend migrations.
- Start backend with production-safe env.
- Start indexer.
- Verify `/health`.
- Verify `/health/db`.
- Verify `/health/indexer`.
- Create ETH testnet agreement.
- Create USDC testnet agreement if token configured.
- Confirm Etherscan links work.
- Confirm indexed activity appears.
- Confirm email provider is not `console` in production.

---

## Part 6 — Documentation Updates

Update:

```txt
docs/state.md
README.md
backend/.env.example
frontend/.env.example
```

### `docs/state.md`

Add a new implementation round section:

```md
### Round 12 — End-to-End Public Beta Release Candidate

**Status**: Implemented

**Goal**: Validate the full product flow end-to-end across local setup, PostgreSQL, Factory V2, MockUSDC, multi-asset agreements, indexer discovery, activity feed, and notification logs. No new escrow logic was added.

**Changes**:
- Added local release-candidate bootstrap script
- Added repeatable local env generation for Factory V2 and MockUSDC
- Added PostgreSQL-backed backend test flow
- Added indexer integration test using real local Factory V2 events
- Added frontend beta UX hardening for ETH vs USDC flows
- Updated public beta checklist
- Updated README and env examples

**Verification**:
- `npx hardhat test`
- `cd backend && npm test`
- `cd backend && npm run build`
- `cd backend && npm run test:indexer`
- `cd frontend && npm run build`
- Local RC smoke test completed with ETH and USDC agreements

**Out of scope**:
- No Solidity business logic changes
- No new contract version
- No platform fees
- No AI arbitration
- No Google OAuth
- No mainnet deployment
```

Adjust final verification status honestly based on what actually runs.

### README

Add:

- local release-candidate setup
- public beta checklist link
- Factory V2 + MockUSDC local workflow
- explanation of ETH vs USDC payments
- commands for tests and indexer

### Env examples

Make sure `.env.example` files include all Round 10/12 env vars with comments.

---

## Part 7 — Verification Commands

At the end of Round 12, run and report:

```bash
npx hardhat compile
npx hardhat test

cd backend
npx prisma generate
npm run build
npm test
npm run test:indexer

cd ../frontend
npm run build
```

Also run the manual local release-candidate smoke flow and document whether it passed.

If any command cannot run because of the environment, state exactly why and what command should be run locally.

---

## Acceptance Criteria

Round 12 is complete only if:

- Local Factory V2 and MockUSDC can be deployed through a repeatable script.
- Frontend can create both ETH and USDC agreements locally.
- USDC flow uses approve + fund correctly.
- ETH flow never shows ERC-20 approval UI.
- ERC-20 flow never sends native ETH as escrow value.
- Backend stores payment metadata correctly.
- Factory V2 indexer discovers agreements automatically.
- Agreement event indexing creates activity feed rows.
- Re-running the indexer does not duplicate ChainEvent rows.
- Notification logs dedupe correctly.
- PostgreSQL-backed backend tests have a documented runnable path.
- Public beta checklist is updated.
- `docs/state.md` is updated with Round 12 results.

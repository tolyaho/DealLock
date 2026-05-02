# DealLock

DealLock is a milestone-based escrow dApp for digital freelance agreements. One Solidity contract represents one agreement between a client and a provider, holds the selected payment asset in escrow, and enforces acceptance, exact funding, sequential milestone submission, approval, expired-milestone refund, paid adjustments, review periods, disputes, and mutual settlement.

New agreements prefer `DealLockFactoryV3` when configured, which creates V6 `DealLockMultiAssetV2` agreements for native ETH or configured ERC-20 assets such as USDC. If Factory V3 is not configured, the frontend falls back to Factory V2, then legacy Factory V1 or direct V4 for native ETH only. ERC-20/USDC creation requires Factory V3 or Factory V2.

The frontend runs in the browser with React, Vite, TypeScript, wagmi, and viem. The backend provides wallet-signature authentication, a multi-wallet account model, verified email identity, notification preferences, indexed notification emails, a persistent agreement registry, and a known-contract activity feed. Sepolia is the main demo network; Hardhat is used for local tests and optional local development.

The backend is hardened for public beta: strict env validation, security headers (helmet), rate limiting on sensitive endpoints, body size limits, PostgreSQL advisory lock for the indexer, exponential-backoff RPC retries, and structured logging.

## Features

- Agreements deployed through the payment-aware `DealLockFactoryV3` or `DealLockFactoryV2` on-chain registry — auto-discovered by the backend indexer.
- Legacy Factory V1 agreements use `DealLockV5` (`DealLockV5` is a factory-deployment wrapper for V4; it returns `contractVersion() == 4` and is handled identically to direct `DealLockV4` deployments).
- One `DealLockMultiAsset` contract per new Factory V2 agreement (`contractVersion() == 5`) with the same V4 escrow mechanics plus a fixed payment asset.
- One `DealLockMultiAssetV2` contract per new Factory V3 agreement (`contractVersion() == 6`) with V5 payment mechanics, a 30-minute deadline grace window, client-approved deadline extension requests, and cooperative milestone revisions with timeout escalation.
- Client/provider role checks enforced on-chain.
- Sequential milestone workflow: proposed → accepted → funded → completed.
- Native ETH escrow or configured ERC-20 escrow with release or refund per milestone.
- **Paid adjustments (change orders)**: client can propose extra paid work mid-agreement; provider accepts; client funds and approves.
- **Refund/deadline grace**: V3-V5 use a short 24-second refund grace period; V6 uses a 30-minute deadline grace window for late submission and client-approved extension requests.
- **Review period and disputes (V4/V5/V6)**: submitted work can be approved, disputed during review, or auto-released to the provider after review expires.
- **Mutual settlement (V4/V5/V6)**: disputed milestone or adjustment funds can be split only after the counterparty accepts a proposal.
- Contract version detection: frontend auto-detects V1/V2/V3/V4/V5/V6 and shows the appropriate UI. V1/V2/V3/V4 use their matching ABIs; V5 reuses the V4 workflow ABI for escrow writes, and V6 uses `DEALLOCK_V6_ABI` for extension functions while preserving V4/V5-compatible escrow writes.
- Wallet-signature sign-in (no password, no Google OAuth).
- Multi-wallet account: link multiple wallets to one DealLock identity.
- Backend agreement registry synced across linked wallets.
- Verified email address for optional product notifications.
- Notification preferences and optional agreement client/provider contact emails.
- Event-indexed notification emails for known backend agreements, with app-triggered notifications as fallback.
- Factory-indexed agreement auto-discovery: `AgreementCreated` factory events add new agreements to the backend automatically.
- Private agreement activity feed from indexed contract events.
- Browser localStorage kept as fallback and migration source.
- Sepolia Etherscan links for addresses and transactions.
- **Public beta hardening**: startup env validation, Helmet security headers, rate limiting, request body limits, PostgreSQL advisory lock for indexer, RPC retry/backoff, structured logging.
- **Testnet beta UI**: always-visible testnet banner, backend-unavailable notice, factory not configured notice.

## Tech Stack

- Solidity `0.8.20`, Hardhat 3
- React 19, Vite 6, TypeScript
- wagmi 2, viem 2, TanStack Query 5
- Node.js, Express 4, Prisma 6, PostgreSQL
- helmet, express-rate-limit
- MetaMask or another injected wallet

## Contract Versions

| | DealLock (V1) | DealLockV2 (V2) | DealLockV3 (V3) | DealLockV4 (V4) | DealLockMultiAsset (V5) | DealLockMultiAssetV2 (V6) |
|---|---|---|---|---|---|---|
| Milestone escrow | Yes | Yes | Yes | Yes | Yes | Yes |
| Paid adjustments | No | Yes | Yes | Yes | Yes | Yes |
| Refund/deadline grace | No | No | **24 seconds** | **24 seconds** | **24 seconds** | **30 minutes** |
| Client-approved deadline extensions | No | No | No | No | No | **Yes** |
| Review period after submission | No | No | No | **Yes — default 3 days** | **Yes — default 3 days** | **Yes — default 3 days** |
| Disputes and mutual settlement | No | No | No | **Yes** | **Yes** | **Yes** |
| ERC-20 payment asset | No | No | No | No | **Yes — fixed per agreement** | **Yes — fixed per agreement** |
| `contractVersion()` | reverts | returns `2` | returns `3` | returns `4` | returns `5` | returns `6` |
| New deployments | No (legacy) | No (superseded) | No (superseded) | Yes (legacy/fallback) | Yes (Factory V2 fallback) | **Yes (via Factory V3)** |

Existing V1, V2, and V3 agreements remain fully readable and usable. The frontend detects the version automatically.

`DealLockV5` (`contracts/DealLockV5.sol`) is the contract legacy Factory V1 deploys. It is functionally identical to `DealLockV4` — the only difference is an explicit `_client` constructor argument so the factory is never set as the agreement's client. It returns `contractVersion() == 4` and is treated as V4 by the frontend and indexer. It is not a new business-logic version.

`DealLockMultiAsset` (`contracts/DealLockMultiAsset.sol`) is the Round 10 payment-layer version. It returns `contractVersion() == 5`, stores `paymentToken`, supports native ETH when `paymentToken == address(0)`, and supports one standard ERC-20 token when `paymentToken` is nonzero. The escrow workflow remains V4-compatible.

`DealLockMultiAssetV2` (`contracts/DealLockMultiAssetV2.sol`) is the V6 deadline/revision version. It returns `contractVersion() == 6`, keeps V5 payment behavior, uses `DEADLINE_GRACE_PERIOD = 30 minutes`, keeps `REFUND_GRACE_PERIOD` as a compatibility alias, adds provider deadline extension requests that only change deadlines when the client accepts, and supports client revision requests during review. Ignored revision requests can be escalated to `Disputed` after `REVISION_RESPONSE_PERIOD = 3 days`.

ABI note: V1/V2/V3/V4 use their matching ABIs. V5 `DealLockMultiAsset` reuses `DEALLOCK_V4_ABI` for escrow workflow writes because the escrow interface is V4-compatible. V6 uses `DEALLOCK_V6_ABI`, which extends the V4-compatible workflow ABI with deadline-extension reads/writes. V5/V6 payment-specific reads use inline ABI fragments such as `paymentToken()`, and ERC-20 balance/allowance/approve operations use the inline `ERC20_ABI` in `ActionPanel`.

## Factory Contracts

`DealLockFactoryV3` is the preferred entry point for new agreements when configured. It:

1. Deploys a V6 `DealLockMultiAssetV2` escrow contract through a chunked bytecode deployer helper where the caller becomes the client.
2. Records the agreement in an on-chain registry (`isDealLockAgreement`, `getAgreements`, `getClientAgreements`, `getProviderAgreements`).
3. Emits payment-aware `AgreementCreated`, including `paymentToken` and `contractVersion = 6`, for automatic backend discovery.

`DealLockFactoryV2` remains supported as the payment-aware fallback when Factory V3 is not configured. It:

1. Deploys a `DealLockMultiAsset` escrow contract where the caller becomes the client.
2. Records the agreement in an on-chain registry (`isDealLockAgreement`, `getAgreements`, `getClientAgreements`, `getProviderAgreements`).
3. Emits payment-aware `AgreementCreated`, including `paymentToken`, for automatic backend discovery.

`DealLockFactory` remains supported for legacy native ETH-only factory deployments. It:

1. Deploys a `DealLockV5` escrow contract where the caller becomes the client.
2. Records the agreement in an on-chain registry (`isDealLockAgreement`, `getAgreements`, `getClientAgreements`, `getProviderAgreements`).
3. Emits `AgreementCreated` for automatic backend discovery.

No factory or deployer helper holds funds, approves work, releases payments, refunds clients, arbitrates disputes, collects fees, or controls any deployed agreement. Their only purpose is deployment and discovery.

### How factory creation works

```text
Frontend calls Factory V3 createAgreement(provider, paymentToken, descriptions, amounts, deadlines, reviewPeriod, metadataHash)
  → factory deploys DealLockMultiAssetV2 (caller = client, not factory)
  → factory emits AgreementCreated with paymentToken
  → backend indexer sees AgreementCreated
  → backend upserts Agreement registry entry
  → normal agreement indexer starts watching that agreement
```

### Legacy direct deployment

When neither `VITE_DEALLOCK_FACTORY_V3_*` nor `VITE_DEALLOCK_FACTORY_V2_*` is set, ERC-20 agreement creation is disabled. Native ETH agreements can still use legacy `VITE_DEALLOCK_FACTORY_*` or direct `DealLockV4` deployment as a local fallback. Direct deployments are still synced to the backend manually after deployment.

Deployment selection is explicit:
- Factory V3 configured: ETH and configured ERC-20 assets deploy as V6 agreements.
- Factory V3 missing + Factory V2 configured: ETH and configured ERC-20 assets deploy as V5 agreements.
- Factory V3/V2 missing + ETH selected: native ETH creation can use legacy Factory V1 or direct V4 fallback.
- Factory V3/V2 missing + ERC-20 selected: creation is blocked with “ERC-20 agreements require Factory V2 or Factory V3. Configure a payment-aware factory or select ETH.”

## Payment Assets

Each Round 10 agreement has exactly one payment asset:

- Native ETH: `paymentToken == address(0)`, funding sends `msg.value` in one transaction.
- ERC-20 / USDC: `paymentToken` is the token contract address, funding is two-step: approve the agreement contract, then call `fundAgreement()` or `fundAdjustment()`.

USDC is configured by env var and displayed only when an address is provided. The frontend parses and formats amounts by token decimals, so `0.01 ETH` and `500.00 USDC` are displayed as asset amounts, not as generic wei. Users still need native ETH for gas on ERC-20 agreements.

Round 10 supports standard ERC-20 transfer behavior only. Fee-on-transfer, tax, rebasing, permit/gasless approval, swaps, fiat payments, token discovery, and admin-managed token whitelists are intentionally out of scope.

## Deadline Grace

Ethereum uses 12-second proof-of-stake slots. A provider who broadcasts a submission transaction just before the deadline may have it mined 1 or 2 slots later due to normal network latency. Without a grace period, the client could front-run that transaction with a refund the moment the deadline passes.

V3-V5 agreements use the original short refund grace period:

```
refundAvailableAt = deadline + REFUND_GRACE_PERIOD
REFUND_GRACE_PERIOD = 24 seconds  (= 2 × 12-second slot time)
```

- The client **cannot** refund before `deadline + 24`.
- The provider **can** still submit during the 24-second window.
- Whichever transaction is mined first after `refundAvailableAt` determines the outcome.

V6 agreements use a product-level 30-minute deadline grace window:

```
submissionClosesAt = deadline + DEADLINE_GRACE_PERIOD
refundAvailableAt = deadline + DEADLINE_GRACE_PERIOD
DEADLINE_GRACE_PERIOD = 30 minutes
REFUND_GRACE_PERIOD = DEADLINE_GRACE_PERIOD  // compatibility alias
```

During the V6 grace window, the provider may still submit pending work or request a deadline extension. The request itself does not block refund. Only explicit client acceptance updates the deadline. After the grace window closes, the provider can no longer submit or request an extension, and the client can refund if the item remains pending/funded.

The frontend reads the configured grace period from the contract and displays refund/submission timing on pending milestone and funded adjustment cards. V1 and V2 agreements are unaffected.

## Review, Disputes, and Settlement

V4/V5/V6 protects submitted work with a review period. New agreements default to a 3-day review window:

```text
Provider submits milestone or adjustment proof
  → Client approves and releases payment
  → Client disputes during the review period
  → If client does nothing, provider can claim after review expires
```

A submitted V4/V5/V6 item cannot be directly refunded by the client. Pending work with no submission can still be refunded only after that version's grace window; submitted work must be approved, disputed, or auto-released after review.

Disputed funds are locked. Either party can propose a provider/client split, but only the counterparty can accept it. Settlement notes and dispute reasons are public on-chain data, so use public-safe summaries, hashes, or references.

Round 4 does not include AI arbitration, a human arbiter, or binding third-party dispute resolution.

## Paid Adjustments

A paid adjustment is extra work proposed by the client after the agreement is already funded. It is not a revision of the original milestone — it is a separate change order with its own payment.

Lifecycle:

```text
Client requests adjustment (description, amount, deadline, target milestone)
  → Provider accepts
  → Client funds exact amount
  → Provider submits proof (URL, commit SHA, IPFS CID)
  → Client approves → Provider receives extra payment
```

Alternative outcomes:
- Funded adjustment whose deadline passes without submission: client can refund.
- Proposed or accepted (unfunded) adjustment: either party can cancel to unblock completion.

**On-chain data warning**: adjustment descriptions and proof strings are stored permanently on-chain and are publicly visible. Do not include private credentials, confidential client information, passwords, API keys, or sensitive business details in these fields.

## Project Structure

```text
contracts/    DealLock V1, V2, V3, V4 escrow contracts + DealLockV5 wrapper + MultiAsset V5/V6 + factories
test/         Hardhat test suite (legacy + factory + multi-asset payment and V6 deadline tests)
scripts/      Sepolia deployment scripts (agreement + Factory V1/V2/V3)
frontend/     React/Vite dApp
backend/      Express API (auth, wallets, agreements, email, notifications, indexer, factory)
              Dockerfile and .env.example included for production deployments
docs/         Project state, round specs, public beta checklist
.github/      GitHub Actions CI workflow
docker-compose.yml                    Local PostgreSQL service for backend development
docker-compose.production.example.yml Example production compose (backend + PostgreSQL)
```

## Prerequisites

- Node.js 20+
- npm
- Docker Desktop or another PostgreSQL 16-compatible local database
- MetaMask for the browser demo
- Sepolia test ETH for live testnet transactions

## Install

From the repository root:

```bash
npm install
```

Install frontend:

```bash
cd frontend
npm install
```

Install backend:

```bash
cd backend
npm install
```

## Run Tests

From the repository root:

```bash
npm test
```

This runs all Hardhat tests (legacy ETH escrow, Factory V1/V2/V3, multi-asset payment coverage, and V6 deadline extensions) against a local in-memory chain. No Sepolia RPC or wallet private key is required.

To run only the factory tests:

```bash
npx hardhat test test/DealLockFactory.ts
```

To run only the payment/deadline tests:

```bash
npx hardhat test test/DealLockMultiAsset.ts test/DealLockFactoryV2.ts test/DealLockMultiAssetV2_DeadlineExtensions.ts
```

Backend persistence/email/session tests require PostgreSQL:

```bash
docker compose up -d postgres
cd backend
npm test
```

## Deploy the Factory (Sepolia)

Factory V3 is the preferred deployment path for new agreements. The deploy script deploys the chunked V6 bytecode helper first, then `DealLockFactoryV3`:

```bash
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY \
PRIVATE_KEY=0xYOUR_PRIVATE_KEY \
npm run deploy:factory:v3:sepolia
```

The script prints the Factory V3 address and the env vars to add:

```text
VITE_DEALLOCK_FACTORY_V3_SEPOLIA=0x...   ← add to frontend/.env
FACTORY_V3_CONTRACTS=11155111:0x...      ← add to backend/.env
FACTORY_INDEXER_ENABLED=true             ← add to backend/.env
```

Deploy Factory V2 only if you need the V5 payment-aware fallback path:

```bash
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY \
PRIVATE_KEY=0xYOUR_PRIVATE_KEY \
npx hardhat run scripts/deploy-factory-v2-sepolia.ts --network sepolia
```

The script prints the Factory V2 address and the env vars to add:

```text
VITE_DEALLOCK_FACTORY_V2_SEPOLIA=0x...   ← add to frontend/.env
FACTORY_V2_CONTRACTS=11155111:0x...      ← add to backend/.env
FACTORY_INDEXER_ENABLED=true             ← add to backend/.env
```

Deploy legacy Factory V1 only if you need the old ETH-only deployment path:

```bash
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY \
PRIVATE_KEY=0xYOUR_PRIVATE_KEY \
npx hardhat run scripts/deploy-factory-sepolia.ts --network sepolia
```

The script prints the factory address and the env vars to add:

```text
VITE_DEALLOCK_FACTORY_SEPOLIA=0x...   ← add to frontend/.env
FACTORY_CONTRACTS=11155111:0x...      ← add to backend/.env
FACTORY_INDEXER_ENABLED=true          ← add to backend/.env
```

## Run the Backend

```bash
docker compose up -d postgres
cd backend
cp .env.example .env
# Edit .env and set SESSION_SECRET to a long random string
npm run db:generate
npm run db:migrate   # Applies PostgreSQL migrations locally
npm run dev          # Starts on http://localhost:4000
```

Key environment variables (`backend/.env`):

```bash
DATABASE_URL="postgresql://deallock:deallock@localhost:5432/deallock?schema=public"
SESSION_SECRET="replace-with-long-random-secret"   # min 32 chars in production
SESSION_STORE="postgres"
FRONTEND_ORIGIN="http://localhost:5173"
PORT=4000
APP_URL="http://localhost:5173"
EMAIL_PROVIDER="console"                            # or "smtp" for production
SEPOLIA_RPC_URL=
INDEXER_ENABLED=false
# Factory indexer (set after deploying the factory):
FACTORY_CONTRACTS=
FACTORY_V2_CONTRACTS=
FACTORY_V3_CONTRACTS=
FACTORY_INDEXER_ENABLED=false
USDC_SEPOLIA_ADDRESS=
LOG_LEVEL=info
```

See `backend/.env.example` for the full list including SMTP configuration and production security settings.

`EMAIL_PROVIDER=console` is the local development default. Verification and notification emails are printed in the backend terminal, including the verification link. Use `EMAIL_PROVIDER=smtp` with the SMTP variables for a real email server (Resend, Postmark, SendGrid, or any SMTP provider).

`SESSION_STORE=postgres` stores Express sessions in PostgreSQL. `SESSION_STORE=memory` is only an explicit local/test fallback and is not production-safe.

**Production safety**: the backend validates env at startup. In production (`NODE_ENV=production`) it will refuse to start if `SESSION_SECRET` is too short, `SESSION_STORE=memory`, `EMAIL_PROVIDER=console` (unless overridden), or CORS origin is missing.

## Event Indexer and Activity

The backend event indexer has two phases:

**Phase 1 — Factory indexer** (when `FACTORY_INDEXER_ENABLED=true` and `FACTORY_CONTRACTS`, `FACTORY_V2_CONTRACTS`, or `FACTORY_V3_CONTRACTS` is set):
Watches `AgreementCreated` events on configured Factory V1/V2/V3 addresses. Each discovered agreement is upserted into the backend `Agreement` table with payment metadata so phase 2 can index it immediately.

**Phase 2 — Agreement indexer** (when `INDEXER_ENABLED=true`):
Watches lifecycle events (milestone submissions, approvals, disputes, settlements, etc.) on all known agreements. Stores decoded events idempotently and dispatches notification emails from them.

```text
Factory contract
  AgreementCreated → backend upserts Agreement → agreement indexer picks it up

Agreement contract
  Lifecycle events → ChainEvent store → notification emails + activity feed
```

The indexer is disabled locally by default. To run it integrated with the backend:

```bash
INDEXER_ENABLED=true FACTORY_INDEXER_ENABLED=true npm run dev
```

To run it as a standalone worker:

```bash
npm run indexer
```

Check indexer and factory status:

```
GET /health/indexer        # indexer + factory status, latest/failed runs, stale counts
GET /factory/contracts     # configured factory contracts and indexing status
```

`/health/indexer` returns `latestSuccessfulRun`, `latestFailedRun`, `pendingAgreements`, `errorAgreements`, and `staleAgreements` for operational monitoring.

Reliable notifications require `INDEXER_ENABLED=true` and a working RPC URL for the agreement chain.

The indexer uses a **PostgreSQL advisory lock** to prevent multiple backend processes from running concurrent index ticks. Running the API and the standalone indexer worker in parallel is safe.

For production deploys, use a managed PostgreSQL `DATABASE_URL`, run `npm run db:deploy`, set a long `SESSION_SECRET`, and use secure cookie settings behind a trusted proxy:

```bash
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAME_SITE="none"  # when cross-site cookies are required
TRUST_PROXY=true                 # only behind a known reverse proxy
```

## Production Deployment (Docker)

A `backend/Dockerfile` and `docker-compose.production.example.yml` are provided as starting points.

Minimum production steps:

```bash
# 1. Deploy DealLockFactoryV3 to Sepolia:
SEPOLIA_RPC_URL=... PRIVATE_KEY=... npm run deploy:factory:v3:sepolia

# 2. Build and start the backend with PostgreSQL:
docker compose -f docker-compose.production.example.yml up -d

# 3. Apply migrations:
docker compose exec backend npx prisma migrate deploy
```

Environment checklist for production:
- `NODE_ENV=production`
- `DATABASE_URL` — managed PostgreSQL
- `SESSION_SECRET` — at least 32 random characters (`openssl rand -base64 48`)
- `SESSION_STORE=postgres`
- `SESSION_COOKIE_SECURE=true`
- `FRONTEND_ORIGIN` — your frontend domain
- `APP_URL` — your frontend domain
- `EMAIL_PROVIDER=smtp` + SMTP credentials
- `SEPOLIA_RPC_URL` — Alchemy/Infura endpoint
- `INDEXER_ENABLED=true`
- `FACTORY_V3_CONTRACTS=11155111:<factory_v3_address>` for new V6 multi-asset agreements
- `FACTORY_V2_CONTRACTS=11155111:<factory_v2_address>` only if keeping the V5 fallback path indexed
- `FACTORY_CONTRACTS=11155111:<factory_v1_address>` only if indexing legacy Factory V1 deployments
- `FACTORY_INDEXER_ENABLED=true`

See `docker-compose.production.example.yml` for a full annotated example.

## Local Release-Candidate Setup (Full Stack)

To spin up the complete local stack from scratch in under five minutes:

```bash
# 1. Start PostgreSQL
docker compose up -d postgres

# 2. Start a local Hardhat node (keep this terminal open)
npm run rc:hardhat

# 3. Deploy Factory V2, Factory V3, and MockUSDC, write env files
npm run rc:bootstrap

# 4. Start the backend — backend/.env.local (written by bootstrap) is auto-loaded
cd backend
cp .env.example .env          # edit SESSION_SECRET and DATABASE_URL at minimum
# backend/.env.local is auto-loaded by npm run dev (via --import ./src/loadLocalEnv.ts)
npm run db:generate && npm run db:migrate && npm run dev

# 5. Start the frontend (new terminal)
cd frontend && npm run dev
```

The bootstrap script (`scripts/bootstrap-local-rc.ts`):
- Deploys `MockUSDC` and `DealLockFactoryV2` to the local Hardhat node
- Deploys the chunked `DealLockMultiAssetV2Deployer` and `DealLockFactoryV3` to the local Hardhat node
- Mints 10,000 USDC to accounts 0 and 1
- Writes `frontend/.env.local` with `VITE_DEALLOCK_FACTORY_V3_HARDHAT`, `VITE_DEALLOCK_FACTORY_V2_HARDHAT`, and `VITE_USDC_HARDHAT_ADDRESS`
- Writes `backend/.env.local` with `FACTORY_V3_CONTRACTS`, `FACTORY_V2_CONTRACTS`, `USDC_HARDHAT_ADDRESS`, `INDEXER_ENABLED`, `FACTORY_INDEXER_ENABLED`

`backend/.env.local` is auto-loaded by `npm run dev` and `npm run indexer` (via a Node `--import` preload). Values already set in the system environment take priority. You do not need to merge `.env.local` into `.env` manually — only `DATABASE_URL`, `SESSION_SECRET`, and other base secrets need to be in `backend/.env`.

After setup, ETH agreements and USDC agreements can be created through the Factory V3 path from the frontend. Factory V2 remains configured as a fallback.

### Quick verification commands

```bash
npm run rc:test:contracts   # Solidity tests (200 tests)
npm run rc:test:backend     # PostgreSQL-backed backend tests
npm run rc:test:indexer     # Indexer integration test (requires PostgreSQL + Hardhat RPC)
npm run rc:test:frontend    # Frontend production build
npm run rc:check            # Solidity + backend build + frontend build
npm run lint:contracts      # Solhint over contracts/**/*.sol
```

## Release Checks / CI

GitHub Actions runs separate contracts, backend, indexer-integration, and frontend jobs on pull requests and pushes to `main`.

Run the full local public-beta release gate before deploying:

```bash
docker compose up -d postgres
npm run release:check
```

`release:check` runs Hardhat compile, `npm run check:bytecode`, Solidity tests, Solhint, backend Prisma generation/build/PostgreSQL tests, the backend indexer integration test, and the frontend production build. It uses `DATABASE_URL_TEST` when set, otherwise `postgresql://deallock:deallock@localhost:5432/deallock_test?schema=public`. The backend test reset creates/resets only a URL that clearly identifies a test database or schema and refuses non-test URLs, so it will not silently use a production database. The indexer integration test requires PostgreSQL and a local Hardhat RPC; `release:check` starts `npx hardhat node` automatically if `HARDHAT_RPC_URL` is not already reachable at `http://127.0.0.1:8545`.

`npm run check:bytecode` reports deployed bytecode sizes for `DealLockMultiAssetV2`, the bytecode chunk helper/template, `DealLockMultiAssetV2Deployer`, `DealLockFactoryV3`, and the actual V6 creation-code chunks. It fails if any exceed the 24,576-byte EVM limit.

## Payment Assets (ETH vs USDC)

Every Factory V2/V3 agreement has exactly one payment asset set at deploy time:

| | ETH agreement | USDC agreement |
|---|---|---|
| Funding | One transaction, `msg.value = totalAmount` | Two transactions: approve, then fund |
| Refunds / payouts | Native ETH sent to wallet | ERC-20 `transfer` to wallet |
| Gas | ETH | ETH (USDC is escrow only; gas is always ETH) |
| Approval UI shown | No | Yes — approve step shown before fund |
| ETH value in fund tx | Yes | No — sending ETH with ERC-20 fund reverts |
| Factory required | Factory V3 preferred; Factory V2/legacy V1/direct V4 fallback allowed when Factory V3 is missing | Factory V3 or Factory V2 only |

The payment asset is locked at agreement creation and cannot be changed. The frontend displays the correct asset symbol throughout and never shows ERC-20 approval UI for native ETH agreements.

## Public Beta Smoke Test

Before opening to users, follow the checklists in `docs/public_beta_checklist.md`:
- **Part A**: Local RC smoke test — full local stack with Factory V3/V2, MockUSDC, ETH and USDC agreement flows, V6 deadline extension checks, and indexer idempotency.
- **Part B**: Sepolia public beta smoke test — testnet deployment, health checks, email, indexer, and production hardening checklist.

## Run the Frontend

```bash
cd frontend
cp .env.example .env
npm run dev
```

Open:

```text
http://localhost:5173
```

Connect MetaMask and switch to Sepolia. The frontend can deploy a new agreement through the factory (when configured) or load an existing DealLock contract address.

Frontend environment (`frontend/.env`):

```bash
VITE_SEPOLIA_RPC_URL=        # Optional: Alchemy/Infura endpoint
VITE_SEPOLIA_EXPLORER=https://sepolia.etherscan.io
VITE_API_URL=http://localhost:4000
VITE_DEALLOCK_FACTORY_V3_SEPOLIA=  # Preferred: Factory V3 for V6 ETH + configured ERC-20
VITE_DEALLOCK_FACTORY_V3_HARDHAT=  # Local Factory V3
VITE_DEALLOCK_FACTORY_V2_SEPOLIA=  # Fallback: Factory V2 for V5 ETH + configured ERC-20
VITE_DEALLOCK_FACTORY_V2_HARDHAT=  # Local Factory V2 fallback
VITE_USDC_SEPOLIA_ADDRESS=         # Optional configured USDC address
VITE_USDC_HARDHAT_ADDRESS=         # Optional local MockUSDC address
VITE_DEALLOCK_FACTORY_SEPOLIA=  # Set after deploying the factory
VITE_DEALLOCK_FACTORY_HARDHAT=  # Set for local Hardhat development
```

When `VITE_DEALLOCK_FACTORY_V3_SEPOLIA` is set, the create form calls Factory V3 `createAgreement(provider, paymentToken, ...)` and deploys `DealLockMultiAssetV2`. If Factory V3 is missing, it falls back to Factory V2 and deploys `DealLockMultiAsset`. If both payment-aware factories are missing, native ETH can use legacy Factory V1 or direct V4 fallback; ERC-20/USDC creation is blocked with “ERC-20 agreements require Factory V2 or Factory V3. Configure a payment-aware factory or select ETH.” The agreement address is parsed from the `AgreementCreated` event in the receipt.

## Sign-In Flow

1. Connect wallet in the topbar.
2. Click **Sign in** — MetaMask signs a human-readable message (no gas, no transaction).
3. Backend creates or restores a DealLock account linked to that wallet.
4. Agreements involving any linked wallet appear in the sidebar.

## Link Additional Wallets

1. While signed in, switch to another wallet in MetaMask.
2. Open the wallet panel (click the wallet count in the topbar).
3. Click **Link [address]** — MetaMask signs a link message.
4. The new wallet is linked to your account; its agreements appear in the sidebar.

A wallet can belong to only one DealLock account. Linking only proves ownership; no funds are moved.

## Email Verification and Notifications

1. Sign in with a wallet.
2. Click **Email** in the account area.
3. Enter an email and click **Verify**.
4. With the console provider, copy the verification link printed by the backend and open it in the browser.
5. The app confirms the token and stores the verified email on the account.

Email does not control funds, login, wallet linking, or contract permissions. Wallet signatures remain the only authority for contract actions.

## Demo Flow

1. Open the frontend and connect the client wallet on Sepolia.
2. Sign in to create a DealLock account.
3. Create an agreement — it deploys through the factory when configured, or directly otherwise.
4. Share the contract address with the provider.
5. Provider connects their wallet and loads the contract address.
6. Provider signs in or loads as a viewer.
7. Provider accepts the agreement.
8. Switch back to the client wallet and fund the exact total. For USDC/ERC-20 agreements, approve the agreement contract first, then fund; approval alone does not move funds.
9. Provider submits milestone evidence (URL, commit hash, IPFS CID).
10. Client approves the submitted milestone, releasing funds to the provider, or disputes it during the review period.
11. If the client does nothing, the provider can claim payment after the review period expires.
12. If work is disputed, either party can propose a settlement split; the counterparty must accept before funds move.
13. Repeat until all milestones are released, refunded, or settled.

## Optional Sepolia CLI Deploy (Direct, no factory)

From the repository root:

This deploys `DealLockV4` directly (without factory registration):

```bash
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY \
PRIVATE_KEY=0xYOUR_PRIVATE_KEY \
PROVIDER_ADDRESS=0xPROVIDER_ADDRESS \
npx hardhat run scripts/deploy-sepolia.ts --network sepolia
```

## Build

Frontend production build:

```bash
cd frontend
npm run build
```

Hardhat build:

```bash
npm run build
```

Backend build:

```bash
cd backend
npm run build
```

## Scope

DealLock enforces payment flow, roles, milestone order, deadlines, a fair refund grace window, review finality, and mutual settlement. It supports native ETH and configured ERC-20 assets (e.g. USDC) as payment, but does not support token swaps, arbitrary token discovery, gasless permit flows, or fee-on-transfer tokens. It does not provide AI arbitration, third-party arbitration, a marketplace, reputation, or subjective quality judgement. The factory improves discovery, not authority — it does not hold funds, collect fees, or control agreements. Google OAuth is not implemented. Email and indexed activity are off-chain product features only; blockchain reads remain the source of truth.

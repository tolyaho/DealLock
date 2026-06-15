# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Three-package monorepo with a Hardhat 3 root, an Express/Prisma backend, and a Vite/React frontend. The root `package.json` orchestrates contract work and cross-package release checks; each subpackage has its own `package.json` and `node_modules`.

```
contracts/  Solidity (DealLock V1–V6, Factory V1/V2/V3, DealLockMultiAssetV2Deployer)
test/       Hardhat 3 + Mocha tests for contracts and factories
scripts/    Sepolia/local deploy + bootstrap-local-rc.ts + release-check.mjs
backend/    Express 4 API (auth, wallets, agreements, email, notifications, indexer)
frontend/   Vite 6 + React 19 marketing landing page; dApp UI planned later
docs/       Architecture, operations, design, and prompt documentation
archive/    Reference-only retired code/materials; not part of active builds
artifacts/, types/, cache/  Hardhat-generated; do not hand-edit
```

The current `frontend/` is intentionally minimal — only the marketing landing page (`src/main.tsx` mounts `components/landing/Hero.tsx`). The full dApp frontend that previously lived here was removed; do not assume App routing, wallet hooks, or dashboards still exist unless you see them in `frontend/src`. `archive/frontend/` holds the prior frontend for reference only — it is not built.

## Commands

### Contracts (run from repo root)

```bash
npm test                                # all Hardhat tests (in-memory EDR chain)
npx hardhat test test/DealLock.ts       # a single test file
npm run build                           # hardhat compile
npm run lint:contracts                  # solhint contracts/**/*.sol
npm run check:bytecode                  # enforces 24,576-byte EVM limit on V6 + deployer + Factory V3
npm run release:check                   # full local public-beta gate (see below)
```

`npm run release:check` runs hardhat compile → check:bytecode → contract tests → solhint → backend prisma generate/build → backend PostgreSQL tests → backend indexer integration test → frontend production build. It starts a local `hardhat node` automatically if `HARDHAT_RPC_URL` isn't already reachable at `127.0.0.1:8545`. PostgreSQL must already be up (`docker compose up -d postgres`).

### Backend (`cd backend`)

```bash
npm run dev          # tsx watch; auto-loads backend/.env.local via --import
npm run build        # tsc
npm run indexer      # standalone indexer worker (safe to run alongside dev — PG advisory lock)
npm test             # boots/reset test DB, runs prisma migrate deploy, then tsx --test on src/**/*.test.ts
npm run test:indexer # indexer integration test only — requires PostgreSQL + a running hardhat node
npm run db:generate  # prisma generate
npm run db:migrate   # prisma migrate dev (local)
npm run db:deploy    # prisma migrate deploy (production / CI)
```

Backend tests require PostgreSQL. `DATABASE_URL_TEST` overrides the default `postgresql://deallock:deallock@localhost:5432/deallock_test?schema=public`. `src/testDatabase.ts` refuses any URL that does not clearly identify a test DB, so you cannot accidentally wipe production by mis-setting the env.

### Frontend (`cd frontend`)

```bash
npm run dev      # vite dev server on :5173
npm run build    # tsc --noEmit && vite build
npm run preview  # vite preview
```

### Local release-candidate stack

```bash
docker compose up -d postgres
npm run rc:hardhat       # terminal 1 — keep open
npm run rc:bootstrap     # terminal 2 — deploys MockUSDC, Factory V2/V3; writes .env.local files
cd backend && npm run dev
cd frontend && npm run dev
```

`scripts/bootstrap-local-rc.ts` writes `frontend/.env.local` and `backend/.env.local`. Backend `.env.local` is auto-merged at boot via `src/loadLocalEnv.ts` (Node `--import`); system env wins over `.env.local`. You should not need to copy values from `.env.local` into `.env` manually — `.env` is only for base secrets like `SESSION_SECRET` and `DATABASE_URL`.

## Architecture you cannot infer from a single file

### Contract version axis

There are six on-chain versions and three factories, and the differences are load-bearing. Before changing escrow logic, locate which version owns it:

| Version | File | `contractVersion()` | Adds |
|---|---|---|---|
| V1 | `DealLock.sol` | reverts | base milestone escrow (legacy, read-only) |
| V2 | `DealLockV2.sol` | 2 | paid adjustments |
| V3 | `DealLockV3.sol` | 3 | 24-second refund grace |
| V4 | `DealLockV4.sol` | 4 | review period, disputes, mutual settlement |
| V5 wrapper | `DealLockV5.sol` | 4 | explicit `_client` ctor arg so factory ≠ client (still V4 logic) |
| V5 multi-asset | `DealLockMultiAsset.sol` | 5 | fixed ERC-20 payment asset, V4-compatible escrow ABI |
| V6 | `DealLockMultiAssetV2.sol` | 6 | 30-min deadline grace, deadline-extension requests, revision requests, V4/V5-compatible escrow writes |

The frontend autodetects version via `contractVersion()` and switches ABI. V5 multi-asset deliberately reuses `DEALLOCK_V4_ABI` for writes; V6 uses `DEALLOCK_V6_ABI` which extends V4 with extension/revision functions. Inline ABI fragments cover payment-token reads and ERC-20 `approve`/`balanceOf`. Do not "unify" these ABIs — the divergence is intentional.

### Factory hierarchy and deploy fallback

`DealLockFactoryV3` (preferred) → `DealLockFactoryV2` (V5 fallback) → `DealLockFactory` (V1, ETH-only legacy). The frontend picks based on which `VITE_DEALLOCK_FACTORY_V{3,2,}_*` env var is set. ERC-20/USDC agreements require V3 or V2 — never fall back to V1 or direct V4 for ERC-20.

V6 contract bytecode exceeds the 24,576-byte EVM limit, so `DealLockFactoryV3` deploys agreements through `DealLockMultiAssetV2Deployer`, which assembles the V6 creation code from on-chain bytecode chunks. This is why `npm run check:bytecode` exists and is part of `release:check` — adding code to V6 or the deployer can silently push it over the limit. Run it whenever you touch those contracts.

### Indexer

Two phases, both gated by env flags:

1. **Factory indexer** (`FACTORY_INDEXER_ENABLED=true` + at least one of `FACTORY_V{1,2,3}_CONTRACTS`): watches `AgreementCreated` on factories, upserts the `Agreement` row with payment metadata.
2. **Agreement indexer** (`INDEXER_ENABLED=true`): watches lifecycle events on every known agreement, writes `ChainEvent` rows idempotently (`@@unique([chainId, txHash, logIndex])`), and dispatches notification emails.

A PostgreSQL advisory lock (`backend/src/indexer/runner.ts`) makes it safe to run the API process and a standalone `npm run indexer` worker simultaneously — only one will hold the tick. Status is exposed at `GET /health/indexer`.

`EmailNotificationLog` has two unique indexes (`[eventType, txHash, recipientEmail]` and `[chainEventId, recipientEmail]`) so the same chain event cannot generate duplicate emails even if re-indexed.

### Backend session/email modes that block production startup

`backend/src/config/env.ts` runs at startup (`validateEnv()`). In `NODE_ENV=production` the process refuses to start if `SESSION_SECRET` is short, `SESSION_STORE=memory`, `EMAIL_PROVIDER=console`, or CORS origin is missing. Do not paper over these by tweaking the check — they catch real misconfigurations.

`SESSION_STORE=postgres` is the only production-safe value (uses `connect-pg-simple`); `memory` exists only for tests. `EMAIL_PROVIDER=console` prints verification links to the backend terminal — that is the local dev path.

### Hardhat config quirks

`hardhat.config.ts` sets `viaIR: true`. This is required for stack-too-deep on V4+ — do not disable it. Solidity is pinned to `0.8.20`. Sepolia network only loads when both `SEPOLIA_RPC_URL` and `PRIVATE_KEY` are set.

### Out of scope (do not propose)

Per `README.md` "Scope" section: no AI/third-party arbitration, no marketplace, no reputation, no Google OAuth, no token swaps/discovery, no fee-on-transfer/rebasing/permit token support, no platform fees, no admin powers, no upgradeable proxy. Email and indexed activity are off-chain conveniences — blockchain reads remain the source of truth.

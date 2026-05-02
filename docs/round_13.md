# Round 13 — CI, Static Analysis, and Public Beta Release Gate

**Status**: Implemented

## Goal

Add automated CI, a repeatable local public-beta release gate, and practical Solidity linting. This round closes the prior verification gap where PostgreSQL-backed backend tests and the indexer integration test required local services and were not part of an automated gate.

Round 13 adds verification infrastructure only. It does not add escrow logic, a new contract version, or product behavior.

## Changes

- Added GitHub Actions CI at `.github/workflows/ci.yml`.
- Added separate CI jobs for contracts, backend, indexer integration, and frontend.
- Added PostgreSQL service containers for backend and indexer CI jobs.
- Added a local `npm run release:check` gate that runs Solidity linting, Hardhat compile/tests, backend generation/build/tests, the indexer integration test, and the frontend build.
- Added `lint:contracts` with Solhint.
- Added `.solhint.json` and `.solhintignore` with a practical recommended-rule baseline.
- Improved the backend test database setup error when PostgreSQL is unreachable.

## CI Jobs

### Contracts

```bash
npm ci
npm run lint:contracts
npx hardhat compile
npx hardhat test
```

### Backend

Runs against a PostgreSQL service with `DATABASE_URL_TEST` set to a dedicated test database:

```bash
cd backend
npm ci
npm run db:generate
npm run db:test:reset
npm run db:deploy
npm run build
npm test
```

### Indexer Integration

Runs against PostgreSQL and a local Hardhat node:

```bash
npm ci
cd backend && npm ci
npx hardhat compile
npx hardhat node
cd backend && npm run test:indexer
```

### Frontend

```bash
cd frontend
npm ci
npm run build
```

## Local Release Gate

Start PostgreSQL first:

```bash
docker compose up -d postgres
npm run release:check
```

`release:check` uses `DATABASE_URL_TEST` when set, otherwise it defaults to:

```text
postgresql://deallock:deallock@localhost:5432/deallock_test?schema=public
```

The script starts a local Hardhat node for the indexer integration test when one is not already reachable at `HARDHAT_RPC_URL` (`http://127.0.0.1:8545` by default).

The backend test reset creates/resets only a database URL that clearly identifies a test database or test schema. It refuses non-test URLs and prints a setup message when PostgreSQL is not reachable.

## Solidity Linting

```bash
npm run lint:contracts
```

Solhint uses `solhint:recommended` with a small project-specific override set. It lints `contracts/**/*.sol` and ignores artifacts, cache, coverage, node modules, generated type output, and archived files.

## Verification Commands

```bash
npm run lint:contracts
npx hardhat compile
npx hardhat test
cd backend && npm run build
cd frontend && npm run build
npm run release:check
```

Backend and indexer release checks require PostgreSQL. The indexer integration test also requires a Hardhat RPC, which `release:check` starts automatically if needed.

## Local Verification During Implementation

- `npm run lint:contracts` — passed
- `npx hardhat compile` — passed
- `npx hardhat test` — 200/200 Solidity tests passed
- `cd backend && npx prisma generate` — passed
- `cd backend && npm run build` — passed
- `cd frontend && npm run build` — passed
- `cd backend && npm test` — could not complete because PostgreSQL was not reachable at `localhost:5432`
- `cd backend && npm run test:indexer` — could not complete because PostgreSQL was not reachable at `localhost:5432`
- `npm run release:check` — not run because Docker/PostgreSQL was unavailable in this environment

## Out of Scope

- No new escrow business logic
- No new contract version
- No milestone, adjustment, dispute, settlement, funding, refund, or payment behavior changes
- No platform fees
- No arbitration or AI arbitration
- No Google OAuth
- No reputation system
- No proxy upgrades
- No token swaps
- No gasless permit flow
- No backend-controlled contract actions

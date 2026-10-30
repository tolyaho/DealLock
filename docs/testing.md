# Testing

DealLock has two testable surfaces — the Solidity protocol (plus its backend/indexer) and
the frontend showcase. All of it runs in CI on every push and pull request to `main`
(`.github/workflows/ci.yml`), and locally with the commands below.

## CI jobs

| Job | What it runs |
|---|---|
| **Contracts** | `solhint` + `npx hardhat test` (in-memory EDR chain) |
| **Backend** | Prisma generate/migrate + `npm test` against a Postgres service |
| **Indexer integration** | Spins up a Hardhat node, runs `npm run test:indexer` |
| **Frontend** | `npm run build` of the full dApp |
| **Showcase** | `npm ci` → `npm test` (simulator reducer invariants) → `npm run build` |

These are local/CI checks, not a third-party audit.

## Contracts (Hardhat)

From the repo root:

```bash
npm test                               # all contract + factory + multi-asset suites
npx hardhat test test/DealLock.ts      # a single file
npm run check:bytecode                 # enforces the 24,576-byte EVM limit on V6 + deployer + Factory V3
```

The suite covers the escrow lifecycle (accept → fund → submit → approve/release), the
factory deployment paths (V1/V2/V3), multi-asset ETH + ERC-20 funding, the review/dispute/
settlement flow, and the V6 deadline-grace and extension logic.

## Backend & indexer

Requires PostgreSQL (`docker compose up -d postgres`). From `backend/`:

```bash
npm test               # persistence / auth / email / session tests (resets a dedicated test DB)
npm run test:indexer   # indexer integration — needs Postgres + a running Hardhat node
```

`src/testDatabase.ts` refuses any `DATABASE_URL` that doesn't clearly identify a test
database, so tests can't touch production data.

## Full local gate

```bash
docker compose up -d postgres
npm run release:check
```

`release:check` runs: hardhat compile → `check:bytecode` → contract tests → solhint →
backend prisma generate/build + Postgres tests → indexer integration test → frontend
production build. It starts a local Hardhat node automatically if one isn't already
reachable at `127.0.0.1:8545`.

## Showcase (interactive demo)

The demo is a deterministic reducer, so its rules are unit-tested directly — against the
real reducer and selectors in
[`demoModel.ts`](../showcase/src/components/landing/demo/demoModel.ts), not against display
strings. From `showcase/`:

```bash
npm test        # 17 invariant tests on Node's built-in runner (no test-framework dependency)
npm run build   # typecheck + production build
```

The invariants include: no funding before acceptance; funding locks the full total;
milestones are strictly sequential; escrow math stays conserved (`locked + released == total`)
through each release; the revision path (submit → revision → resubmit → release); invalid
actions are no-ops (never an impossible state); reset restores the initial scenario; and each
perspective (client vs. freelancer) exposes only its allowed actions. If a change makes the
demo diverge from the contract behaviour it claims to mirror, a test fails.

> The showcase tests use `node --test` with native TypeScript, so they add **no**
> dependencies — the showcase keeps a zero-vulnerability dependency tree. Requires Node ≥ 22.6.

## Browser / end-to-end

The deployed showcase is additionally checked with Playwright (system Chrome) across the full
simulated flow, deep-route redirects, hash anchors, mobile widths, reduced motion, and the
Spline-blocked poster fallback, asserting zero console errors and **no** backend/chain/wallet
network calls. These runs are part of the release QA rather than a committed CI job.

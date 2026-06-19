# DealLock Current State Handoff

Snapshot date: 2026-06-03

This document is the handoff for another agent or engineer taking over DealLock.
It summarizes what exists now, what is intentionally out of scope, and the
production-hardening direction already agreed.

## 1. Repository Shape

DealLock is a three-package monorepo:

- `contracts/`: Hardhat 3 Solidity contracts and tests.
- `backend/`: Express 4 + Prisma API, session auth, wallet linking, agreements,
  email notifications, and chain indexer.
- `frontend/`: Vite + React frontend. The committed baseline is a dApp-style app,
  but the product decision for the current release pass is to treat the active
  frontend as marketing-only until the dApp UI is rebuilt later.

Supporting directories:

- `scripts/`: deployment, bootstrap, release checks.
- `docs/`: architecture, operations, design, and prompt docs.
- `archive/`: reference-only retired frontend/design material.
- `artifacts/`, `cache/`, `types/`: generated Hardhat output, not hand-edited.

## 2. Product Decision

For this pass, production should be honest:

- The active frontend should not claim that users can create/load/manage live
  agreements unless the dApp flow is actually restored.
- The dApp rebuild is planned later.
- Archived frontend code is reference-only.
- The backend and contracts remain the serious production surface.

## 3. Contract Overview

There are multiple contract generations:

| Version | File | Purpose |
| --- | --- | --- |
| V1 | `DealLock.sol` | legacy base milestone escrow |
| V2 | `DealLockV2.sol` | paid adjustments |
| V3 | `DealLockV3.sol` | refund grace |
| V4 | `DealLockV4.sol` | review period, disputes, settlement |
| V5 wrapper | `DealLockV5.sol` | explicit client constructor arg |
| V5 multi-asset | `DealLockMultiAsset.sol` | one fixed ERC-20/native payment asset |
| V6 | `DealLockMultiAssetV2.sol` | current multi-asset/revision/deadline-extension contract |

Factory hierarchy:

- `DealLockFactoryV3` is preferred.
- `DealLockFactoryV2` is fallback for V5 multi-asset.
- `DealLockFactory` is legacy V1 ETH-only.

V6 bytecode uses `DealLockMultiAssetV2Deployer`; keep
`npm run check:bytecode` in release checks.

## 4. Payment Assets

Current intended EVM asset support:

- Native ETH on Sepolia, 18 decimals.
- Native ETH on Hardhat, 18 decimals.
- USDC on Sepolia, 6 decimals, configured by env.
- MockUSDC on Hardhat, 6 decimals, configured/deployed locally.

Do not add TON in this round. TON is not an EVM/Solidity asset and requires a
separate TON smart-contract/Jetton integration.

Target architecture:

- Backend config-driven payment asset registry.
- Public normalized endpoints for supported assets.
- Agreement creation validates the selected asset against the registry.
- Agreement stores asset metadata snapshot: symbol, decimals, address, chainId,
  and asset type.
- Frontend should not expose arbitrary ERC-20 address entry in the main flow.

See `docs/architecture/payment-assets.md`.

## 5. Backend Overview

Important backend modules:

- `src/index.ts`: Express app, middleware, route registration, startup.
- `src/config/env.ts`: central env validation.
- `src/routes/auth.ts`: SIWE/email/session auth.
- `src/routes/wallets.ts`: linked wallets.
- `src/routes/agreements.ts`: agreement persistence and metadata.
- `src/routes/factory.ts`: configured factory metadata.
- `src/indexer/*`: factory/agreement indexing and event persistence.
- `src/email/*`: email transport/templates/verification/notifications.
- `src/sessionStore.ts`: memory/postgres session store config.

Production startup should reject unsafe config:

- Weak/missing `SESSION_SECRET`.
- `SESSION_STORE=memory`.
- `EMAIL_PROVIDER=console`.
- Missing specific CORS origin.
- Enabled indexer without RPC/factory config.

## 6. Backend Risks Already Identified

P0 security:

- `POST /agreements` must authorize existing-row updates against stored parties,
  not request-body party addresses.
- Normal API users must not overwrite chain/factory/payment/deployment fields on
  existing rows.
- Mutating cookie-session routes need CSRF protection.
- Backend production dependency advisories should be patched and rechecked.

P1 reliability:

- SMTP must be timeout-bound.
- Notification sending should move to outbox-style flow.
- `indexerCli` should validate production env.
- HTTP/indexer/email loops need graceful shutdown.
- `SESSION_MAX_AGE_MS` must be used by session cookies.

P2 truthfulness:

- Frontend remains marketing-only until dApp rebuild.
- README/deploy docs must not claim live agreement management if not present.

P3 release hygiene:

- Keep `npm run check:bytecode` in CI/release checks.
- Production Docker examples should prefer Factory V3.
- Deploys should happen from a clean committed tree.
- Secret/local token files must stay ignored.

P4 lower risk:

- Tighten request validation: positive `chainId`, valid dates, size caps.
- Avoid leaking raw internal indexer errors publicly.
- Track Spline/external-scene frontend performance risk.

## 7. Indexer

Two phases:

1. Factory indexer: watches `AgreementCreated` events and upserts agreements.
2. Agreement indexer: watches lifecycle events on known agreements and writes
   idempotent `ChainEvent` rows.

PostgreSQL advisory locking makes it safe for API and standalone worker to run
at the same time. `GET /health/indexer` exposes status.

Notification idempotency is backed by `EmailNotificationLog` unique indexes.

## 8. Frontend Current Direction

The intended release stance is:

- Marketing landing page explains DealLock.
- dApp rebuild comes later.
- Current CTAs must not imply a live app unless `/app` is actually production-ready.
- Any Spline/visual work should not disturb layout/sections unless explicitly asked.

Prior marketing-section work included:

- Hero.
- Workflow scrollytelling.
- Security section.
- FAQ section.
- Design prompt packs for workflow/security/FAQ.

Those files may need to be reconstructed if they are missing from disk.

## 9. Release Gate

Full local gate should include:

- Contracts compile/test/lint.
- Bytecode size check.
- Backend Prisma generate/build/tests/indexer integration.
- Frontend production build.
- Backend production audit check.

## 10. Important Non-Goals

Do not propose or implement in this pass:

- TON, Solana, bridges, swaps, token discovery.
- Arbitrary public ERC-20 UI.
- Token price oracles.
- Multi-token baskets.
- Cross-chain escrow.
- AI or third-party arbitration.
- Marketplace/reputation.
- Admin powers or upgradeable proxy.

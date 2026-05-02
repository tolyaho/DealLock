# DealLock Round 14 — Full Project Review, Cleanup, and Release-Readiness Pass

Use this prompt in Cursor, Claude Code, or another coding agent from the repository root.

---

## Role

You are reviewing the full DealLock repository after 13 implementation rounds. Your task is to perform a deep project-wide cleanup, consistency audit, and release-readiness review.

This is **not** a feature round. Do **not** add new user-facing features, new contract versions, new escrow behavior, platform fees, arbitration, OAuth, reputation, token swaps, permit/gasless funding, proxy upgrades, or backend-controlled contract actions.

The goal is to make the repository coherent, clean, internally consistent, and ready for public beta verification.

---

## Project Context

DealLock is a milestone-based escrow dApp for digital freelance agreements.

Current intended architecture:

- Solidity 0.8.20 smart contracts
- React 19 + Vite 6 frontend
- wagmi 2 + viem 2
- Node.js + Express 4 backend
- Prisma 6 + PostgreSQL
- GitHub Actions CI
- Solhint
- Factory V2 is preferred for new agreements
- `DealLockMultiAsset` is the current default agreement contract via Factory V2
- `DealLockMultiAsset.contractVersion()` returns `5`
- `DealLockV5.sol` is only a Factory V1 deployment wrapper around V4 logic and returns `4`
- V5 `DealLockMultiAsset` reuses V4-compatible escrow workflow ABI on the frontend
- ERC-20 agreements require Factory V2
- Legacy Factory V1 and direct V4 deployment are still supported only for native ETH fallback
- Blockchain reads remain the source of truth for escrow state
- Backend is only identity, registry, indexing, notifications, persistence, and activity feed
- No backend custody or backend-authorized contract actions
- No platform fees
- No AI arbitration
- No Google OAuth
- No reputation system
- No upgradeable proxy pattern
- No multi-party agreements

Round 13 added:

- GitHub Actions CI
- Solhint
- `npm run lint:contracts`
- `scripts/release-check.mjs`
- `npm run release:check`
- PostgreSQL-backed backend and indexer integration checks as release gates

---

## Main Objective

Perform a **full repository consistency audit and safe cleanup pass**.

You should inspect code, docs, configs, tests, CI, scripts, and env examples, then make small safe patches that improve correctness, consistency, maintainability, and public-beta readiness.

Do not rewrite the project architecture.

---

## Part 1 — Repository Consistency Audit

Inspect the whole repository and verify that docs, code, tests, scripts, and env examples agree with the final architecture.

Check especially:

- `README.md`
- `docs/state.md`
- `docs/public_beta_checklist.md`
- `docs/round_*.md`
- `package.json`
- `backend/package.json`
- `frontend/package.json`
- `.github/workflows/ci.yml`
- `.solhint.json`
- `.solhintignore`
- `scripts/release-check.mjs`
- `scripts/bootstrap-local-rc.ts`
- `frontend/src/components/CreateAgreementForm.tsx`
- `frontend/src/components/ActionPanel.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/contractFactory.ts`
- `frontend/src/contractVersion.ts`
- `frontend/src/tokens.ts`
- `backend/src/indexer/*`
- `backend/src/routes/*`
- `backend/prisma/schema.prisma`
- Solidity contracts and tests

Fix stale wording, contradictions, outdated round references, incorrect version descriptions, incorrect factory fallback descriptions, and wrong “default deployment” statements.

Expected truth:

- New agreements should prefer Factory V2.
- Factory V2 deploys `DealLockMultiAsset`.
- `DealLockMultiAsset` is the real current V5 business/payment-layer contract.
- `DealLockV5.sol` is only a legacy Factory V1 deployment wrapper and returns contract version 4.
- Direct V4 fallback is native ETH only.
- ERC-20/USDC creation must require Factory V2.
- Factory V1 is legacy native ETH only.
- Backend registry/indexer is not escrow authority.
- Email never authorizes funds or actions.
- Activity feed and notification logs are derived surfaces, not source of truth.
- Round 13 is implemented locally but CI confirmation may still be pending unless the workflow has actually run.

---

## Part 2 — Safe Code Cleanup

Search for:

- dead code
- stale imports
- unused helpers
- duplicated logic
- misleading variable names
- obsolete comments
- old TODOs
- leftover Round 1–12 inconsistencies

Clean up only when safe.

Do **not** remove legacy compatibility unless it is obviously dead and unused.

Preserve support for:

- V1 direct contracts
- V2/V3/V4 direct contracts
- Factory V1 agreements
- Factory V2 agreements
- Direct V4 native ETH fallback
- localStorage fallback
- backend sync/migration behavior
- app-triggered notification fallback

Pay special attention to:

- frontend ABI selection logic
- Factory V1 vs Factory V2 selection logic
- ERC-20 creation blocking when Factory V2 is absent
- V5 payment asset resolution
- `contractVersion()` detection
- error handling via `humanizeContractError`
- backend env validation
- indexer config parsing
- Factory V2 event decoding
- ChainEvent amount/payment metadata handling
- test DB safety checks
- CI and local release-check scripts

---

## Part 3 — Documentation Cleanup

Make the documentation read like a coherent final project, not like a pile of incremental patches.

Fix:

- repeated paragraphs
- outdated “not yet configured” notes
- contradictions between Round 8 / Round 10 / Round 13
- misleading “V5” wording
- old verification limitations that were later addressed
- stale commands
- missing setup prerequisites
- unclear PostgreSQL / Hardhat / indexer requirements

Do not delete the historical round sections, but add short clarification notes where needed.

Examples:

- If Round 11 says Solhint was not configured, clarify that Solhint was later added in Round 13.
- If Round 12 says backend/indexer tests were not automated, clarify that Round 13 added CI/release-gate automation.
- If Round 8 says no ERC-20 payments, keep it as Round 8 scope, but clarify that ERC-20 was later added in Round 10.

---

## Part 4 — Release Gate Validation

Run or inspect these commands where possible:

```bash
npm run lint:contracts
npx hardhat compile
npx hardhat test
cd backend && npx prisma generate
cd backend && npm run build
cd backend && npm test
cd backend && npm run test:indexer
cd frontend && npm run build
npm run release:check
```

If a command cannot run because PostgreSQL, Docker, or Hardhat RPC is unavailable, do not fake success.

Instead:

- improve the error message if needed
- document the exact prerequisite
- make sure the command fails clearly and safely
- make sure it never targets production DB by accident

---

## Part 5 — Security and Public-Beta Readiness Review

Check for obvious security or public-beta readiness issues:

- committed secrets
- unsafe `.env` handling
- test DB safety
- unsafe production session config
- CORS correctness
- cookie settings
- rate limits
- logging secrets
- RPC config
- indexer duplicate processing
- notification dedupe
- event decoding idempotency
- factory event discovery
- wrong-chain handling
- ERC-20 allowance / balance UX
- incorrect amount formatting
- fee-on-transfer token assumptions
- direct ETH accidentally sent to ERC-20 agreements
- frontend showing actions for wrong wallet role

Do not perform an invasive redesign. Make small safe fixes and document larger risks as follow-up recommendations.

---

## Required Final Report

After reviewing and patching, provide a final report with:

1. Short summary of what was cleaned up.
2. List of files changed.
3. Bugs or inconsistencies found.
4. Commands run and their exact results.
5. Commands that could not be run and why.
6. Remaining risks or recommended next-round items.
7. Confirmation that no escrow business logic or protocol behavior was intentionally changed.

---

## Hard Constraints

- Do not add Round 14 product features.
- Do not change smart contract behavior unless fixing a clear bug.
- If any smart contract behavior changes, explain it explicitly.
- Do not change public contract interfaces unless absolutely necessary.
- Do not remove backwards compatibility.
- Do not fake test results.
- Prefer small, safe patches over rewrites.
- Preserve the current architecture and scope limits.
- Keep Factory V2 as the preferred path for new agreements.
- Keep ERC-20 agreements Factory V2 only.
- Keep direct V4 fallback native ETH only.
- Keep backend non-custodial and non-authoritative over escrow state.

---

## Suggested Working Order

1. Inspect project tree and package scripts.
2. Read README and docs/state.md for contradictions.
3. Check factory/version/payment wording across docs.
4. Check frontend deployment path:
   - Factory V2 preferred
   - Factory V1 native ETH fallback
   - direct V4 native ETH fallback
   - ERC-20 blocked without Factory V2
5. Check ABI/version routing:
   - V1 revert path
   - V2/V3/V4 matching ABI
   - V5 uses V4 escrow ABI plus payment-specific inline ABIs
6. Check backend/indexer env parsing and CI scripts.
7. Run available checks.
8. Patch small inconsistencies.
9. Re-run checks.
10. Produce final report.

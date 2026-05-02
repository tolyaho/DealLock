# Round 9 — Public Beta Deployment Hardening

## Status

Planned.

## Goal

Prepare DealLock for a real public beta deployment on Sepolia by hardening the backend, frontend, email delivery, indexer operation, environment configuration, deployment process, and documentation.

Round 9 is intentionally **not** a product-feature or Solidity round. It should stabilize and productionize what already exists after Rounds 1–8.

Current state before Round 9:

- V4 escrow workflow exists: paid adjustments, refund grace period, review period, disputes, auto-release, and mutual settlement.
- Factory deployment exists: `DealLockFactory` creates factory-compatible V4 agreements and emits `AgreementCreated`.
- Backend exists: Node/Express/Prisma/PostgreSQL with wallet sessions, verified email, notification preferences, activity/indexer, and factory indexing.
- Frontend exists: React/Vite/wagmi/viem app with account, dashboard, agreement creation, contract reads/writes, activity feed, email settings, and factory-based deployment.

Round 9 should make this system safe and repeatable to deploy.

---

## Non-Goals

Do **not** add new protocol features in this round.

Out of scope:

- No new escrow contract version for business logic.
- No ERC-20 / USDC support.
- No platform fees.
- No AI arbitration.
- No Google OAuth.
- No reputation system.
- No upgradeable proxy system.
- No change to wallet-based contract authority.
- No backend custody.
- No backend-controlled contract actions.

Small naming/documentation cleanup is allowed if needed, but the round should not introduce new escrow mechanics.

---

## Important Cleanup Before Hardening

The current state uses `DealLockV5` as the factory-created V4-compatible contract, while also saying there is no new V5 feature version. This is confusing.

Round 9 must resolve this naming clearly in one of two ways:

### Preferred option

Rename the factory-created contract from:

```text
DealLockV5.sol
```

to:

```text
DealLockV4FactoryCreated.sol
```

Then update:

- imports,
- artifacts usage,
- tests,
- deployment scripts,
- factory contract references,
- docs/state.md,
- README.md,
- frontend/backend references if any.

The contract should still return:

```solidity
contractVersion() == 4
```

### Acceptable option

If renaming is too invasive, keep `DealLockV5.sol`, but update docs everywhere to say:

```text
DealLockV5 is a factory-created V4-compatible deployment wrapper, not a new business-logic version.
It returns contractVersion() == 4 and is handled as V4 by the frontend and indexer.
```

Do not leave contradictory documentation such as “No DealLockV5” while the project contains `DealLockV5.sol`.

---

## Scope

### 1. Environment Validation

Add strict environment validation for backend and frontend.

Backend should validate required variables at startup based on enabled features:

```text
DATABASE_URL
SESSION_SECRET
SESSION_STORE
FRONTEND_ORIGIN
APP_URL
EMAIL_PROVIDER
SEPOLIA_RPC_URL / HARDHAT_RPC_URL when indexer is enabled
FACTORY_CONTRACTS when factory indexer is enabled
```

Requirements:

- Create a single backend config module, for example `backend/src/config/env.ts`.
- Parse booleans/numbers safely.
- Fail fast in production if required env vars are missing.
- Reject unsafe production configs, for example:
  - `SESSION_SECRET` too short,
  - `SESSION_STORE=memory` in production,
  - `EMAIL_PROVIDER=console` in production unless explicitly allowed,
  - wildcard CORS in production,
  - missing `APP_URL` for email links,
  - `SESSION_COOKIE_SECURE=false` when `NODE_ENV=production`.
- Add frontend env validation for factory addresses and API URL where practical.
- Update `.env.example` files with complete explanations.

---

### 2. Security Middleware and API Hardening

Add basic production security middleware.

Backend requirements:

- Add `helmet` or equivalent security headers.
- Add request body size limits.
- Add rate limiting for sensitive endpoints:
  - `/auth/nonce`
  - `/auth/verify`
  - `/wallets/link/nonce`
  - `/wallets/link/verify`
  - `/email/start-verification`
  - `/email/confirm`
  - `/notifications/contract-action`
- Add stricter CORS allowlist based on `FRONTEND_ORIGIN`.
- Normalize and sanitize error responses so stack traces are not leaked in production.
- Keep detailed logs server-side.
- Ensure auth nonce and email verification token endpoints are not abusable.
- Ensure all routes that require session still use `requireAuth`.

Acceptance criteria:

- Missing/invalid production env config prevents backend startup.
- Repeated auth/email requests are rate-limited.
- Production errors return safe messages.
- Local development still works with reasonable defaults.

---

### 3. Session and Cookie Hardening

Improve session behavior for public beta.

Requirements:

- Ensure PostgreSQL-backed sessions are the default for non-test environments.
- Add clear session TTL configuration.
- Ensure cookie options are environment-aware:
  - `httpOnly: true`
  - `secure: true` in production
  - `sameSite` configured via env
  - sensible max age
- Add logout behavior that fully destroys the session.
- Ensure session store table/migration is documented.

Acceptance criteria:

- Production cannot accidentally use Express MemoryStore.
- Session cookies are secure under production HTTPS.
- Logout invalidates the session.

---

### 4. Real Email Provider Readiness

Round 5 added console and SMTP transport. Round 9 should make email ready for real public beta.

Requirements:

- Keep `EMAIL_PROVIDER=console` for local development.
- Production should require a real provider unless explicitly overridden.
- Harden SMTP configuration and validation.
- Add at least one production-ready provider option if desired, for example:
  - SMTP only, or
  - Resend/Postmark provider module, or
  - provider abstraction prepared for one of them.
- Add retry policy or at least structured failure logging for failed emails.
- Keep email content safe:
  - do not include sensitive proof strings,
  - do not include full dispute details,
  - link users back to app dashboard instead.
- Make verification emails and notification emails clearly branded.
- Add docs for configuring the sender/domain.

Acceptance criteria:

- Local console email flow still works.
- Production email config is documented.
- Failed email sends are visible in logs and `EmailNotificationLog`.
- Email remains notification-only and never grants authority.

---

### 5. Indexer Production Reliability

Round 7/8 added known-contract and factory indexing. Round 9 should make the indexer safer to operate.

Requirements:

- Add retry/backoff around RPC failures.
- Add clear handling for provider rate limits.
- Add an indexer lock to reduce accidental duplicate indexing if multiple backend processes run.
  - This can be a PostgreSQL advisory lock or a database-backed lock row.
- Make the indexer idempotent and restart-safe.
- Improve `/health/indexer` with:
  - latest successful run,
  - latest failed run,
  - factory indexer status,
  - stale agreement count,
  - failed agreement count,
  - last indexed block per factory/agreement where useful.
- Add a manual `INDEXER_ONCE=true npm run indexer` verification path.
- Add docs explaining integrated vs standalone indexer operation.

Acceptance criteria:

- Running two indexer processes does not duplicate events or spam emails.
- RPC errors do not crash the server permanently.
- Indexer health endpoint is useful for deployment monitoring.
- Factory-created agreements are still discovered automatically.

---

### 6. Observability and Logging

Add structured logging suitable for public beta.

Requirements:

- Use a consistent logger module instead of scattered `console.log` for backend runtime logs.
- Log key events:
  - backend startup config summary without secrets,
  - auth failures/rate limits,
  - email delivery success/failure,
  - indexer run summaries,
  - factory discovery events,
  - unexpected route errors.
- Do not log private secrets, raw verification tokens, private keys, SMTP passwords, or full session cookies.
- Add request logging in development and optionally production.

Acceptance criteria:

- Logs are useful for debugging public beta issues.
- Logs do not leak secrets.

---

### 7. Deployment Configuration

Add production/staging deployment artifacts.

Possible implementation options:

- `Dockerfile` for backend.
- `Dockerfile` or static build instructions for frontend.
- `docker-compose.production.example.yml` for backend + frontend + PostgreSQL + indexer.
- Render/Fly/Railway/Vercel deployment notes if using one provider.
- Separate indexer worker command documented.

Minimum requirements:

- Document how to deploy:
  - PostgreSQL,
  - backend API,
  - frontend,
  - indexer worker,
  - factory contract,
  - email provider.
- Include Sepolia factory deployment steps.
- Include env var checklist.
- Include database migration command for production:

```text
npm run db:deploy
```

Acceptance criteria:

- A developer can follow README to deploy a public beta on Sepolia.
- Local development still remains simple.

---

### 8. Public Beta Smoke Test Script / Checklist

Add a repeatable public beta smoke test.

It can be either:

- a markdown checklist, or
- a small script where practical.

Required manual smoke test flow:

```text
1. Deploy DealLockFactory to Sepolia.
2. Configure frontend factory address.
3. Configure backend FACTORY_CONTRACTS.
4. Start backend, frontend, PostgreSQL, and indexer.
5. Create account with wallet A.
6. Verify email.
7. Create agreement through factory with wallet A as client and wallet B as provider.
8. Confirm backend discovers the agreement through factory indexer.
9. Sign in/link wallet B or use second account/wallet as provider.
10. Provider accepts agreement.
11. Client funds agreement.
12. Provider submits milestone.
13. Client approves milestone.
14. Activity feed shows indexed events.
15. Email notifications are sent/deduped.
16. /health, /health/db, and /health/indexer are green.
```

Acceptance criteria:

- Add `docs/public_beta_checklist.md` or equivalent.
- Add clear expected result for each step.

---

### 9. Frontend Public Beta Polish

Do only focused UX polish required for public beta stability.

Requirements:

- Show clear banners for:
  - wrong network,
  - missing factory config,
  - backend unavailable,
  - indexer/activity unavailable,
  - email not verified.
- Improve error messages for failed deployments, failed wallet signatures, failed backend sync, and indexer delay.
- Ensure transaction success is not blocked by notification failure.
- Add clear “testnet beta” language where appropriate.
- Ensure factory-created vs direct-deployed agreement source is shown clearly.

Acceptance criteria:

- Users understand when something is a beta/testnet limitation.
- Backend/indexer/email failures do not make successful contract transactions look failed.

---

### 10. Documentation Updates

Update docs carefully.

Required docs:

- `docs/state.md`
- `README.md`
- `docs/round_9.md`
- `docs/public_beta_checklist.md`
- `.env.example` files

`docs/state.md` must be updated to include:

- Round 9 status and changes.
- Production env validation.
- Security middleware/rate limiting.
- PostgreSQL session hardening.
- Real email provider readiness.
- Indexer reliability improvements.
- Deployment instructions.
- Public beta smoke test.

Also fix any stale or contradictory Round 8 naming around `DealLockV5` / factory-created V4 variant.

---

## Acceptance Criteria

Round 9 is complete when:

1. Backend starts only with valid production-safe env config.
2. Backend has security headers, body limits, CORS allowlist, safe production errors, and rate limiting for sensitive endpoints.
3. Sessions use PostgreSQL by default outside explicit local/test fallback.
4. Email delivery is production-configurable and documented.
5. Indexer is restart-safe, idempotent, has retry/backoff, and exposes useful health.
6. Deployment docs explain frontend, backend, PostgreSQL, indexer, factory, and email setup.
7. Public beta smoke test checklist exists.
8. Frontend shows clear public beta/factory/backend/indexer/email status messages.
9. No Solidity escrow behavior changes were introduced.
10. Existing test suites still pass.
11. `docs/state.md` and `README.md` are fully updated.

---

## Verification Commands

At minimum, run:

```bash
npx hardhat compile
npx hardhat test

cd backend
npm run db:generate
npm run build
npm test

cd ../frontend
npx tsc --noEmit
npm run build
```

If PostgreSQL and Docker are available:

```bash
docker compose up -d postgres
cd backend
npm run db:migrate
npm test
INDEXER_ONCE=true npm run indexer
```

If Sepolia credentials are available, also run the public beta smoke test manually.

---

## Notes for Claude/Cursor

Preserve the core DealLock trust model:

```text
Wallet = authority
Smart contract = escrow source of truth
Backend = product/account/indexing/notification layer
Email = notifications only
Factory = discovery/creation registry only
```

Do not introduce backend authority over funds or contract actions.

# DealLock Round 6 — Production Database and Backend Persistence

## Status
Planned

## Goal
Move DealLock's backend from a local development SQLite database to a production-ready PostgreSQL setup while keeping the existing Node.js + Express + Prisma backend architecture.

Round 6 is an infrastructure hardening round. It should not change Solidity contracts, wallet authority, agreement logic, notification semantics, or frontend product behavior except where needed to support PostgreSQL-backed persistence.

Current backend state before this round:

- Backend uses Node.js + Express + TypeScript.
- ORM is Prisma.
- Database is SQLite at `backend/prisma/dev.db`.
- Sessions use `express-session` with a development MemoryStore.
- Backend stores users, linked wallets, auth nonces, agreement registry, verified email identity, notification preferences, email verification tokens, and email notification logs.

Target backend state after this round:

- Backend uses PostgreSQL as the main database.
- Prisma remains the ORM.
- Local development can run PostgreSQL through Docker Compose.
- Production deployment can use a managed PostgreSQL database.
- Sessions are stored in PostgreSQL instead of MemoryStore.
- Prisma migrations are production-oriented and reproducible.
- Database indexes and constraints are explicit.
- README and `docs/state.md` clearly describe the new database setup.

---

## High-Level Decision

Use:

```text
Node.js + Express + Prisma + PostgreSQL
```

Do **not** migrate the backend to Python or Peewee in this round.

Peewee may be considered later only if the entire backend is intentionally migrated to a Python-first architecture. Round 6 keeps the current TypeScript backend and upgrades the database layer.

---

## In Scope

### 1. Switch Prisma datasource from SQLite to PostgreSQL

Update `backend/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Replace the old SQLite-style `DATABASE_URL`:

```env
DATABASE_URL="file:./dev.db"
```

with PostgreSQL-style configuration:

```env
DATABASE_URL="postgresql://deallock:deallock@localhost:5432/deallock?schema=public"
```

Use PostgreSQL as the default backend database for local development and production.

---

### 2. Preserve existing logical data model

Keep the existing backend concepts:

- `User`
- `Wallet`
- `AuthNonce`
- `Agreement`
- `EmailVerificationToken`
- `NotificationPreference`
- `EmailNotificationLog`

The migration should preserve the existing API contract and frontend expectations.

Expected model meaning:

#### User
Product-level account.

Fields should include:

- `id`
- `email` nullable unique
- `emailVerifiedAt` nullable
- `createdAt`
- `updatedAt`

#### Wallet
Linked wallet identity.

Fields should include:

- `id`
- `userId`
- `address` unique, normalized lowercase
- `label`
- `isPrimary`
- `createdAt`
- `updatedAt`

Rules:

- One user can have many wallets.
- One wallet belongs to only one user.
- Wallet address uniqueness is enforced by DB constraint.

#### AuthNonce
One-time wallet signature challenge.

Fields should include:

- `id`
- `address`
- `nonce`
- `purpose`
- `message`
- `expiresAt`
- `usedAt`
- `createdAt`

Rules:

- Nonces expire.
- Nonces are single-use.
- Nonces must be linked to normalized lowercase addresses.

#### Agreement
Backend-side off-chain registry entry for known DealLock contracts.

Fields should include:

- `id`
- `contractAddress`
- `chainId`
- `clientAddress`
- `providerAddress`
- `clientEmail`
- `providerEmail`
- `projectTitle`
- `serviceTemplate`
- `metadataJson`
- `contractVersion`
- `createdByUserId`
- `createdAt`
- `updatedAt`
- `lastAccessedAt`
- `lastSyncedAt`

Rules:

- Unique per `(chainId, contractAddress)`.
- Contract, client, and provider addresses are stored lowercase.
- This is not authority over escrow state.
- Blockchain remains source of truth for funds, state transitions, and permissions.

#### EmailVerificationToken
Hashed email verification token.

Fields should include:

- `id`
- `userId`
- `email`
- `tokenHash` unique
- `expiresAt`
- `usedAt`
- `createdAt`

Rules:

- Store only token hash, never raw token.
- Token is single-use.
- Token expires after the configured TTL.

#### NotificationPreference
Per-user notification toggles.

Fields should include:

- `userId` unique
- booleans for agreement, milestone, adjustment, dispute, settlement, and review-claim event categories
- timestamps if already present or useful

#### EmailNotificationLog
Audit/dedupe log for app-triggered notifications.

Fields should include:

- `id`
- `agreementId`
- `recipientUserId`
- `contractAddress`
- `chainId`
- `eventType`
- `txHash`
- `recipientEmail`
- `status`
- `error`
- `createdAt`
- `sentAt`

Rules:

- Unique dedupe key: `(eventType, txHash, recipientEmail)`.
- Notification failures must not affect confirmed contract transaction success.

---

### 3. Add production-oriented indexes and constraints

Add explicit indexes in Prisma where useful.

Recommended indexes:

```prisma
@@index([userId])
@@index([address])
```

for `Wallet` if not already covered by unique address.

For `AuthNonce`:

```prisma
@@index([address, purpose])
@@index([expiresAt])
@@index([usedAt])
```

For `Agreement`:

```prisma
@@unique([chainId, contractAddress])
@@index([chainId, clientAddress])
@@index([chainId, providerAddress])
@@index([createdByUserId])
@@index([lastAccessedAt])
@@index([contractVersion])
```

For `EmailVerificationToken`:

```prisma
@@index([userId])
@@index([email])
@@index([expiresAt])
```

For `EmailNotificationLog`:

```prisma
@@unique([eventType, txHash, recipientEmail])
@@index([agreementId])
@@index([recipientUserId])
@@index([contractAddress, chainId])
@@index([status])
@@index([createdAt])
```

Use exact Prisma syntax that compiles with PostgreSQL.

---

### 4. Add local PostgreSQL development environment

Add or update Docker Compose for local PostgreSQL.

Preferred file location:

```text
docker-compose.yml
```

or, if the project already has a root Docker Compose file, add a clearly named dev compose file:

```text
docker-compose.dev.yml
```

Recommended service:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: deallock-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: deallock
      POSTGRES_PASSWORD: deallock
      POSTGRES_DB: deallock
    ports:
      - "5432:5432"
    volumes:
      - deallock_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U deallock -d deallock"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  deallock_postgres_data:
```

Do not commit actual database data.

---

### 5. Update backend environment configuration

Update `backend/.env.example`.

Required database/session values:

```env
DATABASE_URL="postgresql://deallock:deallock@localhost:5432/deallock?schema=public"
SESSION_SECRET="replace-with-long-random-secret"
SESSION_STORE="postgres"
FRONTEND_ORIGIN="http://localhost:5173"
PORT=4000
```

Existing email values should remain:

```env
APP_URL="http://localhost:5173"
EMAIL_PROVIDER="console"
EMAIL_FROM="DealLock <no-reply@deallock.local>"
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=false
```

Optional production-oriented values:

```env
NODE_ENV="development"
TRUST_PROXY=false
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_SAME_SITE="lax"
```

In production, cookies should be secure and the backend should trust proxy only when deployed behind a known reverse proxy.

---

### 6. Replace MemoryStore sessions with PostgreSQL-backed sessions

Current session storage uses `express-session` MemoryStore, which is not suitable for production.

Implement PostgreSQL-backed session storage.

Recommended package approach:

```text
connect-pg-simple + pg + express-session
```

Behavior:

- Use PostgreSQL session store when `SESSION_STORE=postgres`.
- Optionally keep MemoryStore only for tests or explicit local fallback.
- Session cookies remain HTTP-only.
- Configure cookie security through env.
- Do not expose session IDs to frontend code.

Implementation notes:

- Create or migrate the session table reliably.
- Prefer an explicit setup/migration rather than silently relying on fragile runtime behavior.
- If using `connect-pg-simple`, document how the session table is created.
- Ensure session store uses the same `DATABASE_URL` or a clearly documented `SESSION_DATABASE_URL` if needed.

---

### 7. Add backend database scripts

Update `backend/package.json` with clear scripts.

Recommended scripts:

```json
{
  "db:generate": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:deploy": "prisma migrate deploy",
  "db:studio": "prisma studio",
  "db:reset": "prisma migrate reset",
  "db:seed": "tsx prisma/seed.ts"
}
```

Only add `db:seed` if a seed file exists or is created.

Make sure existing scripts still work:

- `npm run build`
- `npm test`
- `npm run dev`

---

### 8. Add health checks

Add or improve backend health endpoints.

Recommended endpoints:

```text
GET /health
GET /health/db
```

Behavior:

- `/health` returns basic service status.
- `/health/db` performs a lightweight database query, such as `SELECT 1`, through Prisma or the DB client.
- Do not leak secrets or database URLs.

Example response:

```json
{
  "ok": true,
  "database": "reachable"
}
```

---

### 9. Update backend tests for PostgreSQL

Existing backend tests should still pass.

Preferred test strategy:

- Tests use a dedicated test PostgreSQL database.
- Test database URL is read from `DATABASE_URL_TEST` or a separate test env file.
- Test setup applies migrations before tests.
- Tests clean data between runs.

If a full test PostgreSQL harness is too large for this round, implement the minimum robust approach and document exact commands needed to run backend tests locally.

Do not silently run tests against the developer's production database.

---

### 10. Update README and docs

Update `README.md` with:

- PostgreSQL requirement.
- Docker Compose startup instructions.
- Backend setup commands.
- Migration commands.
- Environment variables.
- Session storage explanation.
- Local development workflow.

Example local setup flow:

```bash
docker compose up -d postgres
cd backend
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Update `docs/state.md`:

1. Overall project state should say backend uses PostgreSQL, not SQLite.
2. Backend stack should be updated from `Prisma 6 · SQLite` to `Prisma 6 · PostgreSQL`.
3. Backend database file references like `backend/prisma/dev.db` should be removed or marked as legacy pre-Round-6.
4. Add Round 6 under Implementation Rounds with status, backend changes, DB changes, tests, and out-of-scope items.
5. File structure should include Docker Compose and PostgreSQL-related setup.
6. Intentional scope limits should mention that Round 6 does not add an event indexer, AI arbitration, Google OAuth, ERC-20, factory contract, or platform fees.

---

## Data Migration Policy

This project is still pre-production. Do not over-engineer automatic migration from local SQLite `dev.db` unless existing project scripts already depend on it.

Acceptable Round 6 policy:

```text
SQLite dev.db is treated as disposable local development data.
PostgreSQL becomes the new source of backend persistence.
Developers should recreate local accounts/agreements or manually re-register existing contracts by loading them through the app.
```

If implementing a migration script is simple, it can be added as optional tooling:

```text
backend/scripts/export-sqlite.ts
backend/scripts/import-postgres.ts
```

But this is optional and should not block the main Round 6 implementation.

---

## Out of Scope

Do not implement in Round 6:

- Solidity contract changes
- V5 contract
- Blockchain event indexer
- AI arbitration
- Human arbitration
- Google OAuth
- Email login
- ERC-20 support
- Factory contract
- Platform fees
- Reputation system
- Admin dashboard
- Full analytics warehouse
- Migration to Python/Peewee

---

## Acceptance Criteria

Round 6 is complete when:

1. `backend/prisma/schema.prisma` uses PostgreSQL provider.
2. Local PostgreSQL can be started with Docker Compose.
3. `backend/.env.example` uses a PostgreSQL `DATABASE_URL`.
4. Prisma migrations apply cleanly to PostgreSQL.
5. Backend starts successfully against PostgreSQL.
6. Wallet sign-in still works.
7. Multi-wallet linking still works.
8. Agreement registry still works.
9. Email verification still works.
10. Notification preferences still work.
11. App-triggered notification logging still works.
12. Session persistence uses PostgreSQL or another production-safe store, not MemoryStore, when configured for normal backend operation.
13. Backend build passes.
14. Backend tests pass or documented local test setup is added and verified.
15. Frontend build still passes.
16. README explains PostgreSQL setup and commands.
17. `docs/state.md` is updated to reflect Round 6.
18. No Solidity contract behavior is changed.

---

## Suggested Implementation Order

1. Inspect current backend Prisma schema and routes.
2. Add Docker Compose PostgreSQL service.
3. Change Prisma datasource provider to PostgreSQL.
4. Add or adjust indexes and constraints.
5. Generate and apply Prisma migration.
6. Update `.env.example` and backend config.
7. Replace MemoryStore with PostgreSQL-backed session store.
8. Add health DB endpoint.
9. Fix tests and build issues.
10. Update README.
11. Update `docs/state.md` and add this round to Implementation Rounds.


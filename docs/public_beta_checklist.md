# DealLock — Public Beta Checklist

Use this checklist before opening DealLock to the public on Sepolia, and as a guide for running a full local release-candidate smoke test.

---

## Part A — Local Release-Candidate Smoke Test

Use this to verify the complete stack from a clean checkout on your local machine.

### Prerequisites

- Docker installed for PostgreSQL
- Node.js 20+ installed
- Two browser wallets (or two browser profiles with MetaMask)
  - Account 0 (`0xf39Fd…`) = client
  - Account 1 (`0x70997…`) = provider

---

### 1. Start PostgreSQL

```bash
docker compose up -d postgres
```

Verify: `docker compose ps` shows postgres healthy.

---

### 2. Start a local Hardhat node (separate terminal)

```bash
npm run rc:hardhat
# or: npx hardhat node
```

Verify: terminal prints `Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545`.

---

### 3. Deploy Factory V3, Factory V2, and MockUSDC

```bash
npm run rc:bootstrap
# or: npx hardhat run scripts/bootstrap-local-rc.ts --network localhost
```

Expected output:
- Deploys MockUSDC, DealLockFactoryV2, DealLockMultiAssetV2Deployer, and DealLockFactoryV3
- Mints 10,000 USDC to accounts 0 and 1
- Writes `frontend/.env.local` with `VITE_DEALLOCK_FACTORY_V3_HARDHAT`, `VITE_DEALLOCK_FACTORY_V2_HARDHAT`, and `VITE_USDC_HARDHAT_ADDRESS`
- Writes `backend/.env.local` with `FACTORY_V3_CONTRACTS`, `FACTORY_V2_CONTRACTS`, `USDC_HARDHAT_ADDRESS`, `INDEXER_ENABLED=true`, `FACTORY_INDEXER_ENABLED=true`

---

### 4. Configure backend environment

```bash
cd backend
cp .env.example .env
# Set in backend/.env: DATABASE_URL, SESSION_SECRET, FRONTEND_ORIGIN, APP_URL
# The bootstrap already wrote to backend/.env.local:
#   FACTORY_V3_CONTRACTS, FACTORY_V2_CONTRACTS, USDC_HARDHAT_ADDRESS, HARDHAT_RPC_URL, INDEXER_ENABLED, FACTORY_INDEXER_ENABLED
# backend/.env.local is auto-loaded by npm run dev — no manual merge needed.
```

---

### 5. Apply migrations and start backend

```bash
cd backend
npm run db:generate
npm run db:migrate
npm run dev
```

Verify:
- `GET http://localhost:4000/health` → `{ "ok": true }`
- `GET http://localhost:4000/health/db` → `{ "ok": true, "database": "reachable" }`
- `GET http://localhost:4000/health/indexer` → `{ "enabled": true, "factoryIndexerEnabled": true }`

---

### 6. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

---

### 7. Sign in with client wallet

1. Connect wallet Account 0 (client) on Hardhat local chain.
2. Click **Sign in** in the topbar.
3. Approve the MetaMask signature.

Expected: topbar shows session indicator.

---

### 8. Add verified email (optional but tests the notification path)

1. Click **Email** in topbar.
2. Enter an email and click **Verify**.
3. In the backend dev console, copy the verification link and open it.

Expected: email shown as verified.

---

### 9. Create an ETH agreement

1. Switch to the create form.
2. Fill in provider address (Account 1), title, milestones with ETH amounts and deadlines.
3. Ensure payment asset selector shows **ETH**.
4. Verify the ERC-20 approval UI is NOT shown for ETH.
5. Click **Deploy ETH agreement**.

Expected:
- Transaction submitted and confirmed.
- Agreement appears in sidebar with factory-created metadata.
- `POST /agreements` stores the agreement in the backend.

---

### 10. Provider accepts

1. Switch to Account 1 (provider wallet) in a second browser or profile.
2. Open the agreement.
3. Click **Accept agreement**.

Expected: agreement state → Accepted.

---

### 11. Client funds ETH agreement

1. Switch back to Account 0 (client).
2. Click **Fund agreement**.
3. Confirm the transaction sends native ETH (not a token).

Expected: agreement state → Funded.

---

### 12. Provider submits milestone 0

1. Switch to provider (Account 1).
2. Click **Submit milestone 0** with a proof string.

Expected: milestone 0 state → Submitted.

---

### 13. Client approves milestone 0

1. Switch to client (Account 0).
2. Click **Approve milestone 0**.

Expected: milestone 0 state → Released. Provider receives ETH.

---

### 14. Check activity feed

1. Stay signed in as client.
2. Open the activity panel.

Expected: `AgreementAccepted`, `AgreementFunded`, `MilestoneSubmitted`, `MilestoneReleased` events listed.

---

### 15. Run indexer and verify ChainEvent rows

```bash
cd backend
npm run indexer
```

Then:
```
GET http://localhost:4000/agreements/<contractAddress>/activity
```

Expected: activity rows show with correct `amountRaw` and `paymentSymbol`.

---

### 16. Verify no duplicate events

Run `npm run indexer` a second time.

Expected: same number of rows — no duplicates.

---

### 17. Create a USDC agreement

1. In the create form, change **Escrow asset** to **USDC**.
2. Verify the hint says "USDC agreements require approve, then fund. You still need ETH for gas."
3. Verify Factory V2 is listed as configured.
4. Deploy the USDC agreement.

Expected: agreement deployed with `paymentToken = MockUSDC address`.

---

### 18. Fund USDC agreement (approve + fund)

1. Provider accepts the USDC agreement.
2. Client: the action panel shows **Approve USDC** step.
3. Click **Approve USDC** — confirm the approval transaction (no ETH value).
4. Allowance refreshes. Click **Fund agreement** — confirm (no ETH value).

Expected:
- Both transactions succeed.
- Agreement state → Funded.
- No ETH sent as escrow value in either transaction.

---

### 19. Complete USDC milestone

1. Provider submits milestone 0.
2. Client approves milestone 0.

Expected: provider receives USDC tokens.

---

### 20. Create and fund a paid adjustment (USDC)

1. Client requests an adjustment.
2. Provider accepts.
3. Client funds the adjustment (approve + fund with USDC).
4. Provider submits proof.
5. Client approves.

Expected: provider receives USDC adjustment payment.

---

### 21. Run backend test suite

```bash
cd backend
npm test
```

Expected: all backend integration tests pass (requires PostgreSQL at `DATABASE_URL_TEST`).

---

### 22. Run indexer integration tests (optional)

```bash
cd backend
npm run test:indexer
```

Expected: agreement discovery and idempotency tests pass (requires running Hardhat node + test DB).

---

### 23. Check V6 / Factory V3 bytecode size

```bash
npm run check:bytecode
```

Expected: `DealLockMultiAssetV2`, the chunk helper template, `DealLockMultiAssetV2Deployer`, `DealLockFactoryV3`, and the actual V6 creation-code chunks are all below the 24,576-byte EVM deployed-bytecode limit.

---

### 24. Run all checks

```bash
npm run release:check
```

Expected: bytecode size check, Solhint, Solidity compile/tests, backend build/tests, indexer integration, and frontend build all pass.

---

## Part B — Sepolia Public Beta Smoke Test

Use this before deploying to testnet public beta.

### Prerequisites

- Two MetaMask wallets funded with Sepolia ETH.
- Backend running with PostgreSQL, SMTP or console email, and `SEPOLIA_RPC_URL`.
- Frontend deployed or running locally (`npm run dev` in `frontend/`).
- CI green, or the local release gate has passed:

```bash
docker compose up -d postgres
npm run release:check
```

---

### 1. Deploy Factory V3 to Sepolia

```bash
SEPOLIA_RPC_URL=... PRIVATE_KEY=... npm run deploy:factory:v3:sepolia
```

The deploy script creates the chunked V6 bytecode helper and then `DealLockFactoryV3`.

Set these in backend and frontend env files:

```
VITE_DEALLOCK_FACTORY_V3_SEPOLIA=<address>
FACTORY_V3_CONTRACTS=11155111:<address>
FACTORY_INDEXER_ENABLED=true
INDEXER_ENABLED=true
SEPOLIA_RPC_URL=<your-rpc-url>
```

---

### 2. Configure Sepolia USDC (optional)

If using a known Sepolia USDC test token:

```
VITE_USDC_SEPOLIA_ADDRESS=<address>
USDC_SEPOLIA_ADDRESS=<address>
```

---

### 3. Run migrations and start backend

```bash
cd backend
npm run db:deploy
npm start
```

---

### 4. Health checks

```
GET /health          → { "ok": true }
GET /health/db       → { "ok": true, "database": "reachable" }
GET /health/indexer  → { "enabled": true, "factoryIndexerEnabled": true, ... }
```

Expected: all three respond 200. Indexer shows `enabled: true` and `factoryIndexerEnabled: true`.

---

### 5. Sign in with wallet A (client)

1. Open the frontend and connect wallet A on Sepolia.
2. Click **Sign in**.
3. Approve the MetaMask signature.

Expected: topbar shows session indicator.

---

### 6. Verify email

1. Enter an email and click **Verify**.
2. Open the verification link (from SMTP or backend console).

Expected: email shown as verified.

---

### 7. Create an ETH agreement on Sepolia

1. Fill in provider (wallet B), title, milestones, ETH amounts, deadlines.
2. Payment asset: ETH.
3. Deploy.

Expected: transaction confirmed on Sepolia. Etherscan link shown.

---

### 8. Complete the ETH agreement workflow

- Provider (wallet B): accepts.
- Client: funds.
- Provider: submits milestone.
- Client: approves.

Expected: complete lifecycle on Sepolia without errors.

---

### 9. Create a USDC agreement on Sepolia (if USDC configured)

1. Switch asset to USDC in the create form.
2. Deploy the USDC agreement.
3. Provider accepts.
4. Client approves USDC spend, then funds.
5. Provider submits. Client approves.

Expected: full USDC lifecycle completes. Indexer picks up payment token metadata.

---

### 10. Confirm indexer discovery

Run or wait for the indexer to tick. Then:

```
GET /agreements/<address>/activity
```

Expected: `AgreementCreated`, `AgreementAccepted`, `AgreementFunded`, `MilestoneReleased` events in the activity feed.

---

### 11. Confirm Etherscan links

Open any activity event. Verify Etherscan link resolves to the correct Sepolia transaction.

---

### 12. Confirm email notification (if SMTP configured)

Expected: notification email sent for milestone release. Not duplicated on re-indexer run.

---

### 13. Confirm no duplicate events

Restart or re-tick the indexer.

Expected: same activity row count — idempotent.

---

### 14. Confirm email provider is not console

In production `.env`, verify:

```
EMAIL_PROVIDER=smtp
```

`console` is blocked in production unless `ALLOW_CONSOLE_EMAIL_IN_PROD=true` is explicitly set.

---

### 15. Final hardening checklist

- [ ] `SESSION_SECRET` is at least 32 random characters
- [ ] `SESSION_COOKIE_SECURE=true` (HTTPS only)
- [ ] `TRUST_PROXY=true` (if behind reverse proxy)
- [ ] `FRONTEND_ORIGIN` matches the deployed frontend URL exactly
- [ ] `EMAIL_PROVIDER=smtp` (not console)
- [ ] `INDEXER_ENABLED=true`
- [ ] `FACTORY_INDEXER_ENABLED=true`
- [ ] `SEPOLIA_RPC_URL` set to a reliable endpoint
- [ ] `FACTORY_V3_CONTRACTS` set correctly
- [ ] `FACTORY_V2_CONTRACTS` set only if the V5 fallback path is intentionally kept indexed
- [ ] No secrets in version-controlled files

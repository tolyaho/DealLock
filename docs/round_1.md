# DealLock Round 1 — Multi-Wallet Account Foundation

## Status

Planned implementation round.

## High-Level Goal

Move DealLock from a purely browser-local MVP toward a public-service architecture by adding a minimal backend account layer and multi-wallet support.

The first connected wallet should be able to create/sign in to a DealLock account. After that, the logged-in user should be able to link additional wallets to the same account by connecting each wallet and signing a wallet-linking message.

This round must preserve the current smart contract model: wallets remain the source of on-chain authority. A DealLock account only aggregates UX, metadata, agreement discovery, and future notification preferences.

## Current MVP Context

DealLock currently has:

- One deployed `DealLock.sol` contract per agreement.
- Client/provider authority enforced entirely by wallet addresses on-chain.
- React/Vite frontend with wagmi/viem.
- Agreement metadata and registry stored in browser `localStorage`.
- No backend.
- No email notifications.
- No Google OAuth.
- No factory contract.
- No platform fees.

## Product Rule

Use this identity model:

```text
DealLock Account = product profile and dashboard identity
Wallet = blockchain authority
```

A DealLock account can have many linked wallets.

A wallet can belong to only one DealLock account.

All contract writes still require the exact wallet that has the on-chain role in the contract.

Example:

```text
DealLock Account #1
├── 0xAAA...111 — primary wallet
├── 0xBBB...222 — linked client wallet
└── 0xCCC...333 — linked provider wallet
```

If an agreement has `client = 0xAAA...111`, but the user is currently connected as `0xBBB...222`, the dashboard may show the agreement, but client-only actions must be disabled with a clear instruction to switch to `0xAAA...111`.

## Out of Scope for Round 1

Do not implement these yet:

- Google OAuth.
- Email/password auth.
- Email notifications.
- Event watcher/indexer.
- Contract factory.
- Platform fees.
- ERC-20 payments.
- Arbitration/dispute resolution.
- Reputation system.
- Smart contract changes unless absolutely necessary.

`DealLock.sol` should remain unchanged in this round unless there is a very strong technical reason.

## Architecture Decision

Add a new backend app to the repository.

Recommended structure:

```text
DealLock/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── index.ts
│   │   ├── db.ts
│   │   ├── auth.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── wallets.ts
│   │   │   └── agreements.ts
│   │   └── middleware/
│   │       └── requireAuth.ts
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/
├── contracts/
├── docs/
│   ├── state.md
│   └── round_1.md
└── ...
```

Preferred backend stack:

- Node.js + TypeScript.
- Express or Fastify.
- Prisma ORM.
- SQLite for local development.
- HTTP-only cookie session for browser auth.
- CORS configured for the frontend dev origin.

Keep the backend minimal and clean. Do not build a large framework around it.

## Database Models

Implement at least these models.

### User

Represents a DealLock product account.

Fields:

- `id`
- `createdAt`
- `updatedAt`

No email is required in Round 1.

### Wallet

Represents a wallet linked to a DealLock account.

Fields:

- `id`
- `userId`
- `address`
- `label`
- `isPrimary`
- `createdAt`
- `updatedAt`

Rules:

- Store wallet addresses normalized to lowercase.
- `address` must be globally unique.
- One user can have many wallets.
- One wallet cannot belong to multiple users.
- Each user should have one primary wallet.

### AuthNonce

Represents a one-time challenge used for wallet signature auth.

Fields:

- `id`
- `address`
- `nonce`
- `purpose`
- `message`
- `expiresAt`
- `usedAt`
- `createdAt`

Purpose values:

- `signin`
- `link_wallet`

Rules:

- Nonces expire quickly, for example after 10 minutes.
- Nonces can be used only once.
- A used or expired nonce must be rejected.

### Agreement

Backend-side registry entry for known DealLock contracts.

Fields:

- `id`
- `contractAddress`
- `chainId`
- `clientAddress`
- `providerAddress`
- `projectTitle`
- `serviceTemplate`
- `metadataJson`
- `createdByUserId`
- `createdAt`
- `updatedAt`
- `lastAccessedAt`
- `lastSyncedAt`

Rules:

- Normalize addresses to lowercase.
- A contract address should be unique per chain.
- Agreements are visible to a user if either `clientAddress` or `providerAddress` matches any wallet linked to that user's account.

## Backend API

Use JSON responses. Return clean error messages and appropriate HTTP status codes.

### Auth

#### `POST /auth/nonce`

Input:

```json
{
  "address": "0x...",
  "chainId": 11155111
}
```

Behavior:

- Validate address.
- Normalize address.
- Create a signin nonce.
- Return the exact message that the frontend must ask the wallet to sign.

Response:

```json
{
  "message": "...",
  "nonceId": "..."
}
```

#### `POST /auth/verify`

Input:

```json
{
  "address": "0x...",
  "nonceId": "...",
  "signature": "0x..."
}
```

Behavior:

- Load nonce.
- Check purpose is `signin`.
- Check not expired and not used.
- Verify signature against the message.
- If wallet already exists, sign in to its user.
- If wallet does not exist, create a new user and primary wallet.
- Mark nonce as used.
- Create HTTP-only session cookie.
- Return current user and linked wallets.

Response:

```json
{
  "user": { "id": "..." },
  "wallets": [
    {
      "address": "0x...",
      "label": "Primary wallet",
      "isPrimary": true
    }
  ]
}
```

#### `POST /auth/logout`

Clears the session.

#### `GET /me`

Returns the current logged-in user and linked wallets.

If no session exists, return 401.

### Wallets

All wallet routes except link nonce generation/verification require an authenticated session.

#### `GET /wallets`

Returns wallets linked to the current account.

#### `POST /wallets/link/nonce`

Input:

```json
{
  "address": "0x...",
  "chainId": 11155111
}
```

Behavior:

- Requires existing session.
- Validate and normalize the address.
- If the wallet is already linked to the current account, return a useful response.
- If the wallet is linked to another account, reject with 409.
- Create a `link_wallet` nonce and message.

The message should clearly say that this signature links the wallet to the current DealLock account.

#### `POST /wallets/link/verify`

Input:

```json
{
  "address": "0x...",
  "nonceId": "...",
  "signature": "0x...",
  "label": "Provider wallet"
}
```

Behavior:

- Requires existing session.
- Check nonce purpose is `link_wallet`.
- Check not expired and not used.
- Verify signature.
- Ensure wallet is not linked to another user.
- Create wallet record for current user.
- Mark nonce as used.
- Return updated wallet list.

#### `PATCH /wallets/:address`

Update wallet label or primary status.

Rules:

- Only wallets belonging to the current user can be edited.
- If a wallet is set as primary, unset primary on the user's other wallets.

#### `DELETE /wallets/:address`

Optional in Round 1. If implemented:

- Do not allow deleting the user's only wallet.
- Do not allow deleting the primary wallet unless another wallet is made primary first.

### Agreements

#### `GET /agreements`

Returns all agreements where `clientAddress` or `providerAddress` matches any linked wallet of the current user.

Support optional filters:

- `chainId`
- `role=client|provider|all`

#### `POST /agreements`

Creates or upserts an agreement registry entry.

Input:

```json
{
  "contractAddress": "0x...",
  "chainId": 11155111,
  "clientAddress": "0x...",
  "providerAddress": "0x...",
  "projectTitle": "Landing page build",
  "serviceTemplate": "website",
  "metadataJson": {}
}
```

Rules:

- Requires authenticated session.
- Validate all addresses.
- Normalize all addresses.
- Allow save only if at least one party address matches one of the current user's linked wallets.
- Upsert by `(chainId, contractAddress)`.

#### `PATCH /agreements/:contractAddress`

Updates project title, service template, metadata, state cache, or `lastAccessedAt`.

Rules:

- User can update only agreements involving one of their linked wallets.

## Signature Message Requirements

Use a clear human-readable message. It does not need to be a full SIWE implementation yet, but it should be structured and safe.

Example signin message:

```text
Sign in to DealLock

This signature proves that you control this wallet.
It does not trigger a blockchain transaction and does not cost gas.

Wallet: 0x...
Chain ID: 11155111
Purpose: signin
Nonce: ...
Issued At: ...
Expires At: ...
```

Example link-wallet message:

```text
Link wallet to DealLock account

This signature links this wallet to your currently signed-in DealLock account.
It does not trigger a blockchain transaction and does not cost gas.

Wallet: 0x...
Chain ID: 11155111
Purpose: link_wallet
Nonce: ...
Issued At: ...
Expires At: ...
```

## Frontend Requirements

Add an account/session layer to the React app.

Suggested files:

```text
frontend/src/api/client.ts
frontend/src/api/auth.ts
frontend/src/api/wallets.ts
frontend/src/api/agreements.ts
frontend/src/account/AccountProvider.tsx
frontend/src/account/useAccountSession.ts
frontend/src/components/dashboard/LinkedWalletsPanel.tsx
```

### Sign-In Flow

Current wallet connection should not automatically mean authenticated backend session.

Use this flow:

```text
Connect wallet
→ request signin nonce from backend
→ ask wallet to sign message
→ verify signature with backend
→ backend creates account/session
→ frontend loads /me
```

If the wallet is unknown, the backend creates a new DealLock account automatically.

If the wallet is already known, the backend restores the existing account.

### Link Wallet Flow

Use this flow:

```text
Logged-in user clicks "Link another wallet"
→ user switches/connects the wallet they want to add
→ frontend requests link-wallet nonce
→ wallet signs link-wallet message
→ backend verifies and links wallet to current account
→ frontend refreshes wallet list and agreement list
```

The UI should make it clear that linking a wallet only proves ownership and does not transfer funds.

### Dashboard Aggregation

Update dashboard agreement discovery logic.

Current behavior:

```text
Show agreements from localStorage registry, mostly tied to current browser/device.
```

New behavior:

```text
Fetch agreements from backend for all linked wallets.
```

Keep localStorage as a fallback/migration source for metadata already created by the MVP.

Recommended migration behavior:

- On sign-in, read existing `deallock_agreement_registry_v1` from localStorage.
- For each local registry entry, if it involves the connected or linked wallet, POST it to backend.
- Keep local metadata loading for old agreements.
- For newly created agreements, save to both backend and localStorage during the transition.

### Contract Action Gating

Current `deriveRole(account, client, provider)` is based on the connected wallet.

Keep that behavior for contract writes.

But also compute account-level visibility:

```text
connectedWalletRole = role of currently connected wallet
accountWalletRole = whether any linked wallet is client/provider
```

UX rule:

- If any linked wallet is involved, show the agreement in dashboard.
- If the currently connected wallet is not the correct role, disable the action and show which wallet is required.

Example message:

```text
This agreement belongs to your linked client wallet 0xAAA...111. Switch to that wallet to approve or refund milestones.
```

## UI Requirements

Add a clear linked-wallets area. It can live in the dashboard sidebar, workspace settings, or a new account panel.

It should show:

- Current backend session status.
- Primary wallet.
- Linked wallets.
- Wallet labels.
- Button to link another wallet.
- Button to rename wallet label.
- Clear error if a wallet is already linked to another DealLock account.

Use existing visual style. Do not redesign the whole app in this round.

## Environment Variables

Add backend `.env.example`:

```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="replace-me-with-a-long-random-secret"
FRONTEND_ORIGIN="http://localhost:5173"
PORT=4000
```

Add frontend `.env.example` variable if needed:

```env
VITE_API_URL="http://localhost:4000"
```

## Testing Requirements

Add practical tests or at least a reliable manual test checklist.

Minimum manual tests:

1. Start backend and frontend locally.
2. Connect wallet A.
3. Sign in with wallet A.
4. Confirm a new user account is created.
5. Link wallet B by switching wallet and signing the link message.
6. Confirm wallet B appears in linked wallets.
7. Confirm wallet B cannot be linked to a second account.
8. Create an agreement involving wallet A and confirm it saves to backend.
9. Create/load an agreement involving wallet B and confirm it appears under the same account.
10. Confirm actions are disabled when the connected wallet is not the required on-chain role.
11. Confirm existing localStorage-created agreements can still be loaded.

## Acceptance Criteria

Round 1 is complete when:

- A new backend exists and runs locally.
- Wallet A can sign in and create a DealLock account.
- Wallet A can sign in again and restore the same account.
- Logged-in account can link wallet B by signature.
- Wallet B cannot be linked to another account.
- Linked wallets are visible in the frontend.
- Agreement registry can be saved to backend.
- Dashboard can show agreements involving any linked wallet.
- Contract writes still require the currently connected wallet to match the on-chain role.
- Existing create/load agreement flows still work.
- `DealLock.sol` remains unchanged.
- Google OAuth is not implemented.
- Email notifications are not implemented.
- `README.md` is updated with backend setup instructions.
- `docs/state.md` is updated to reflect the new overall state and the Round 1 changelog.

## Required Documentation Updates

After implementation, update `docs/state.md` in two ways.

### 1. Update the overall current state

The main state document should no longer describe DealLock as purely client-side/localStorage-only if the backend is implemented.

It should mention:

- Backend exists.
- Account/session layer exists.
- Multi-wallet account model exists.
- Agreement registry is backend-backed, with localStorage kept as fallback/migration support.
- Wallets remain the source of smart contract authority.
- Email and Google OAuth are still not implemented.

### 2. Add a round history section

Add or update a section like:

```md
## Implementation Rounds

### Round 1 — Multi-Wallet Account Foundation

Status: Implemented

Changes:
- Added backend service with SQLite/Prisma.
- Added wallet signature sign-in.
- Added account creation from first wallet.
- Added linked wallets.
- Added backend agreement registry.
- Updated dashboard to aggregate agreements across linked wallets.
- Preserved wallet-based contract authority.

Out of scope:
- Google OAuth.
- Email notifications.
- Contract changes.
```

For future rounds, append new round summaries to this section instead of replacing it.

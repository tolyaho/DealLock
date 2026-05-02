# DealLock Round 7 — Blockchain Event Indexer and Reliable Notifications

## Status

**Planned**

## Goal

Add a backend blockchain event indexer so DealLock can detect on-chain actions even when users interact outside the DealLock frontend.

Round 5 added verified email identity and best-effort app-triggered notifications. However, those notifications only fire when the DealLock frontend sees a confirmed transaction and calls the backend. Round 7 makes notifications and activity history backend-driven by indexing events from known DealLock contracts.

The backend must remain a product/account/notification layer only. The blockchain remains the source of truth for escrow funds, permissions, milestone state, adjustment state, disputes, settlements, and contract state transitions.

---

## High-Level Product Problem

Currently, if a user acts through:

- Etherscan,
- a custom script,
- another frontend,
- direct wallet contract interaction,
- a future mobile app,

then the DealLock backend may not know that anything happened.

That means:

- email notifications can be missed,
- dashboard activity history is incomplete,
- future reminders and analytics do not have reliable event data,
- future AI-assisted dispute review does not have a clean evidence timeline.

Round 7 fixes this by indexing on-chain events for all agreements known to the backend registry.

---

## Core Design

Because DealLock still has **no factory contract** and **no on-chain central registry**, the backend cannot discover every DealLock contract globally.

Therefore, the Round 7 indexer watches only **known agreements** stored in the backend `Agreement` table.

Known agreements are created when:

1. the frontend deploys a new agreement and saves it to the backend;
2. a signed-in user manually loads a contract address and the frontend saves it to the backend;
3. localStorage migration pushes a known agreement to the backend.

This is acceptable for Round 7. Global discovery can come later through a factory contract or on-chain registry.

---

## Scope

### In Scope

- Backend event indexer for known DealLock contracts.
- Support for DealLock V1, V2, V3, and V4 event ABIs.
- Idempotent event storage in PostgreSQL.
- Indexer cursor/checkpoint tracking.
- Reliable notification emails triggered from indexed events.
- Agreement activity feed API.
- Agreement activity feed frontend component.
- Health/status endpoints for indexer lag and DB reachability.
- README and `docs/state.md` updates.

### Out of Scope

- Solidity changes.
- DealLockV5.
- Factory contract.
- Global on-chain registry.
- AI dispute analysis.
- Binding arbitration.
- ERC-20 payments.
- Platform fees.
- Reputation scoring.
- Google OAuth.
- Full historical indexing of unknown contracts.
- Replacing blockchain reads as source of truth.

---

## No Solidity Changes

Round 7 must not modify:

- `contracts/DealLock.sol`
- `contracts/DealLockV2.sol`
- `contracts/DealLockV3.sol`
- `contracts/DealLockV4.sol`

No new Solidity contract should be added.

The current V4 contract remains the default for new agreements.

---

## Backend Architecture

### New Indexer Module

Add backend indexer modules under:

```text
backend/src/indexer/
```

Suggested files:

```text
backend/src/indexer/
├── config.ts
├── clients.ts
├── abis.ts
├── eventMap.ts
├── decode.ts
├── timestamp.ts
├── store.ts
├── notify.ts
├── syncAgreement.ts
├── runner.ts
└── status.ts
```

The backend should expose a clean `runIndexerOnce()` function for tests and optional CLI use.

### Runtime Mode

Support two modes:

1. **Integrated mode**: backend starts the indexer polling loop when `INDEXER_ENABLED=true`.
2. **Command mode**: `npm run indexer` runs a standalone polling process or one-shot indexer loop.

For MVP public service, integrated mode is acceptable, but the code should be structured so the indexer can later run as a separate worker process.

---

## Backend Environment Variables

Add to `backend/.env.example`:

```env
SEPOLIA_RPC_URL=
HARDHAT_RPC_URL=http://127.0.0.1:8545

INDEXER_ENABLED=false
INDEXER_POLL_MS=15000
INDEXER_CONFIRMATIONS=2
INDEXER_BLOCK_BATCH_SIZE=1000
INDEXER_LOOKBACK_BLOCKS=250000
INDEXER_MAX_AGREEMENTS_PER_TICK=25
INDEXER_LOG_LEVEL=info
```

Rules:

- In local development, indexer should be disabled by default.
- In production/staging, indexer can be enabled via `INDEXER_ENABLED=true`.
- `INDEXER_CONFIRMATIONS` prevents indexing unfinalized head blocks.
- `INDEXER_BLOCK_BATCH_SIZE` avoids overly large RPC log queries.
- `INDEXER_LOOKBACK_BLOCKS` is used when an agreement has no known deployment block.

---

## Database Changes

Use Prisma migrations. Keep PostgreSQL as the only current persistence target.

### Agreement Model Additions

Extend `Agreement`:

```prisma
model Agreement {
  // existing fields...

  deploymentTxHash       String?
  deploymentBlockNumber  BigInt?
  indexingStartBlock     BigInt?
  lastIndexedBlock       BigInt?
  lastIndexedAt          DateTime?
  indexerStatus          String   @default("pending") // pending | indexing | synced | error
  indexerError           String?
}
```

Notes:

- `deploymentBlockNumber` should be set when the frontend creates a contract and has the deployment receipt.
- If `deploymentBlockNumber` is missing, use `latestBlock - INDEXER_LOOKBACK_BLOCKS` as the starting point, but never below block 0.
- `lastIndexedBlock` should advance only after successful indexing of a range.
- Do not use these fields as escrow authority; they are indexer metadata only.

### New Model: ChainEvent

Add:

```prisma
model ChainEvent {
  id              String   @id @default(cuid())
  agreementId     String
  agreement       Agreement @relation(fields: [agreementId], references: [id], onDelete: Cascade)

  chainId         Int
  contractAddress String
  contractVersion Int

  blockNumber     BigInt
  blockHash       String?
  txHash          String
  logIndex        Int
  eventName       String

  itemType        String?  // agreement | milestone | adjustment | settlement | dispute
  itemId          Int?
  actorAddress    String?
  counterpartyAddress String?

  amountWei       String?
  payloadJson     Json

  occurredAt      DateTime
  createdAt       DateTime @default(now())

  notificationsProcessedAt DateTime?

  @@unique([chainId, txHash, logIndex])
  @@index([agreementId, blockNumber])
  @@index([chainId, contractAddress, blockNumber])
  @@index([eventName])
  @@index([occurredAt])
}
```

Store bigint ETH amounts as decimal strings in `amountWei` and inside `payloadJson` where needed, to avoid JS precision issues.

### New Model: IndexerRun

Add:

```prisma
model IndexerRun {
  id              String   @id @default(cuid())
  startedAt       DateTime @default(now())
  finishedAt      DateTime?
  status          String   // running | success | error
  chainId         Int?
  agreementsSeen  Int      @default(0)
  eventsFound     Int      @default(0)
  error           String?
}
```

This is useful for debugging and `/health/indexer`.

### EmailNotificationLog Additions

Extend existing notification log to support indexer-driven emails:

```prisma
model EmailNotificationLog {
  // existing fields...

  source        String  @default("app") // app | indexer
  chainEventId  String?
  logIndex      Int?

  // Keep existing app-triggered dedupe.
  // Add indexer-specific dedupe:
  @@unique([chainEventId, recipientEmail])
}
```

If Prisma nullable unique behavior is awkward, enforce indexer dedupe in code before insert.

---

## Event Coverage

The indexer must decode all events present in V1-V4 ABIs.

At minimum, support these event families where present:

### V1 Milestone / Agreement Events

```text
AgreementAccepted
AgreementFunded
MilestoneSubmitted
MilestoneReleased
MilestoneRefunded
```

### V2/V3 Adjustment Events

```text
AdjustmentRequested
AdjustmentAccepted
AdjustmentFunded
AdjustmentSubmitted
AdjustmentReleased
AdjustmentRefunded
AdjustmentCancelled
```

### V4 Review / Dispute / Settlement Events

Use the exact event names from `DealLockV4` ABI. Expected families include:

```text
MilestoneDisputed
AdjustmentDisputed
MilestoneClaimedAfterReview
AdjustmentClaimedAfterReview
MilestoneSettlementProposed
AdjustmentSettlementProposed
MilestoneSettlementCancelled
AdjustmentSettlementCancelled
MilestoneSettled
AdjustmentSettled
```

If actual event names differ in the ABI, use the actual compiled names and update docs/state.md accordingly.

---

## Event Decoding Rules

For every event log:

1. Identify the agreement by `(chainId, contractAddress)`.
2. Pick the ABI based on `agreement.contractVersion`.
3. Decode the log.
4. Normalize addresses to lowercase.
5. Determine:
   - event name,
   - item type,
   - item id if available,
   - actor address if inferable,
   - counterparty address if inferable,
   - amount if available,
   - payload JSON,
   - timestamp from block.
6. Insert `ChainEvent` idempotently.
7. Dispatch notification if needed and not already sent.

If actor cannot be confidently inferred from the event arguments, leave `actorAddress` null and still store the event.

---

## Notification Rules

Round 7 changes notification behavior:

```text
Round 5: frontend-confirmed transaction → backend email
Round 7: indexed on-chain event → backend email
```

The indexer becomes the primary notification source.

The existing `/notifications/contract-action` endpoint may remain as a fallback, but it must be deduped with indexer-triggered notifications. If the same tx/event is later indexed, the backend must not send a duplicate email.

### Recipient Resolution

Use current Round 5 recipient logic:

1. Find the counterparty account by linked wallet address.
2. If counterparty account has a verified email and preferences allow the event type, send to that verified email.
3. Otherwise, use the agreement's optional `clientEmail` / `providerEmail` contact fallback when appropriate.
4. Never use email as authorization.
5. Never include sensitive on-chain proof/dispute/settlement text in email body beyond short safe summaries and links.

### Suggested Recipient Mapping

| Event Type | Recipient |
|---|---|
| AgreementAccepted | client |
| AgreementFunded | provider |
| MilestoneSubmitted | client |
| MilestoneReleased | provider |
| MilestoneRefunded | provider |
| AdjustmentRequested | provider |
| AdjustmentAccepted | client |
| AdjustmentFunded | provider |
| AdjustmentSubmitted | client |
| AdjustmentReleased | provider |
| AdjustmentRefunded | provider |
| AdjustmentCancelled | counterparty if actor known, otherwise both parties |
| MilestoneDisputed | provider |
| AdjustmentDisputed | provider |
| MilestoneClaimedAfterReview | client |
| AdjustmentClaimedAfterReview | client |
| SettlementProposed | counterparty |
| SettlementCancelled | counterparty if actor known |
| Settled | both parties or the proposal creator, depending on event data |

If exact event payload makes recipient inference ambiguous, prefer a safe notification to both parties or skip the email but store the event.

---

## Agreement Activity API

Add:

```text
GET /agreements/:contractAddress/activity?chainId=11155111&limit=50&cursor=
```

Auth:

- Require session.
- The signed-in account must have at least one linked wallet that matches the agreement client or provider address.
- Later, public activity could be considered, but keep it private-by-session for now.

Response shape:

```ts
{
  events: Array<{
    id: string
    eventName: string
    itemType: string | null
    itemId: number | null
    actorAddress: string | null
    counterpartyAddress: string | null
    amountWei: string | null
    txHash: string
    blockNumber: string
    occurredAt: string
    payload: unknown
  }>
  nextCursor?: string
}
```

Sort newest first.

Do not expose raw email fields or internal notification logs through this endpoint.

---

## Indexer Status API

Add:

```text
GET /health/indexer
```

Response should include:

```ts
{
  enabled: boolean
  latestKnownRun?: {
    status: string
    startedAt: string
    finishedAt?: string
    agreementsSeen: number
    eventsFound: number
    error?: string
  }
  pendingAgreements: number
  errorAgreements: number
}
```

This can be unauthenticated for dev, but avoid exposing sensitive details in production.

---

## Frontend Changes

### New API Module

Add:

```text
frontend/src/api/activity.ts
```

Functions:

```ts
getAgreementActivity(contractAddress: string, chainId: number): Promise<ActivityEvent[]>
```

### New Component

Add:

```text
frontend/src/components/AgreementActivityFeed.tsx
```

Display:

- event name in human-readable form,
- item type and id,
- amount if relevant,
- actor short address if available,
- timestamp,
- Etherscan transaction link,
- empty state when no indexed events exist yet,
- loading/error state.

Do not show full raw payload by default. A compact "technical details" disclosure is acceptable.

### Dashboard Integration

In `DashboardPage`:

- fetch activity for the loaded contract when signed in and contract address is known;
- render `AgreementActivityFeed` under the main agreement overview or context sections;
- refresh activity after transaction success alongside `refetchAll`;
- show a note if indexer is not enabled or no events have been indexed yet.

---

## App-Triggered Notification Endpoint After Round 7

Keep `/notifications/contract-action` for compatibility, but change its role:

- It is a fallback only.
- It should create log records with `source = "app"`.
- Indexer-driven notifications use `source = "indexer"`.
- Deduplication must prevent duplicate emails when both app and indexer see the same tx.
- README should explain that reliable notifications require `INDEXER_ENABLED=true`.

---

## Security and Reliability Requirements

- Never let indexed backend state authorize contract actions.
- Never trust event payload over fresh contract reads for critical UI decisions.
- Indexer must be idempotent and safe to restart.
- Use confirmed blocks only: `latestBlock - INDEXER_CONFIRMATIONS`.
- Store block number, transaction hash, and log index for every indexed event.
- Do not include sensitive proof/dispute/settlement text in emails.
- Do not leak one user's private backend registry to another user.
- Lowercase all addresses before DB lookup.
- Do not send duplicate notification emails.
- Keep app usable if indexer is disabled.
- Indexer failures must not crash the web server unless running in dedicated indexer command mode.

---

## Testing Requirements

### Backend Tests

Add tests for:

1. event log decoding for V1-V4 ABIs;
2. idempotent `ChainEvent` insert with duplicate tx/log index;
3. per-agreement cursor advancement;
4. indexer does not process blocks newer than `latest - confirmations`;
5. notification recipient resolution;
6. preference-based notification skipping;
7. fallback contact email notification;
8. dedupe between app-triggered and indexer-triggered notification;
9. activity API authorization;
10. activity API sorting and pagination;
11. `/health/indexer` response.

If full live chain integration is too heavy, use mocked viem public client responses for backend tests.

### Build Verification

Run:

```text
cd backend
npm run db:generate
npm run build
npm test

cd ../frontend
npm run build
```

If a local PostgreSQL instance is required for tests, document the exact command:

```text
docker compose up -d postgres
```

---

## README Updates

Update README with:

- what the event indexer does;
- why it is needed after Round 5;
- known-agreement limitation due to no factory contract;
- required env vars;
- how to run indexer integrated with backend;
- how to run standalone indexer command if implemented;
- notification behavior after Round 7;
- activity feed behavior;
- confirmation-depth and reorg limitations;
- statement that blockchain remains source of truth.

---

## docs/state.md Updates

After implementation, update `docs/state.md`:

1. Add Round 7 to Project Overview:
   - event indexer,
   - reliable backend-triggered notifications,
   - activity feed,
   - known-contract limitation.

2. Update Backend section:
   - new indexer modules,
   - new DB models,
   - new env vars,
   - new health/indexer API,
   - notification behavior.

3. Update Frontend section:
   - new activity API module,
   - `AgreementActivityFeed`,
   - Dashboard integration.

4. Update File Structure:
   - `backend/src/indexer/*`,
   - new Prisma migration,
   - `frontend/src/api/activity.ts`,
   - `frontend/src/components/AgreementActivityFeed.tsx`,
   - `docs/round_7.md`.

5. Add Implementation Rounds entry:
   - **Round 7 — Event Indexer and Reliable Notifications**
   - status,
   - backend changes,
   - frontend changes,
   - tests,
   - out-of-scope items.

6. Update Intentional Scope Limits:
   - remove "No event indexer";
   - replace with "No factory/global registry yet";
   - keep "blockchain remains source of truth".

---

## Acceptance Criteria

Round 7 is complete when:

- Backend indexes events for known V1/V2/V3/V4 agreements.
- Events are stored idempotently in PostgreSQL.
- Indexer can restart without duplicating events or notifications.
- Notifications are sent from indexed events.
- App-triggered notification endpoint remains safe as fallback or is explicitly deprecated.
- Activity feed displays indexed events for a loaded agreement.
- Activity feed is only visible to accounts linked to a client/provider wallet.
- README and `docs/state.md` are updated.
- No Solidity contracts are changed.
- No V5 contract is created.
- Blockchain reads remain the source of truth for escrow state.

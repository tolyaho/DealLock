# Round 5 — Verified Email Identity and App-Triggered Notifications

## Status

Planned.

## Goal

Add an optional email layer to DealLock accounts so users can receive product notifications without changing the wallet-based trust model.

Round 5 should introduce:

1. Verified email addresses for DealLock accounts.
2. Notification preferences.
3. Optional agreement contact emails for client/provider communication.
4. Email transport infrastructure in the backend.
5. Best-effort notification emails when DealLock app actions are confirmed through the frontend.

This round must **not** make email an authority source. Wallets remain the only source of contract permission.

```text
DealLock Account = product identity and dashboard
Wallet           = blockchain authority
Email            = notifications and communication only
```

---

## Product Principles

### 1. Wallet remains the authority

Email must never decide whether a user can:

- accept an agreement,
- fund escrow,
- submit work,
- approve work,
- refund,
- dispute,
- propose or accept settlement,
- claim after review.

All contract writes must continue to require the exact client/provider wallet.

### 2. Email is optional

A user can still use DealLock with only a wallet. Email improves UX but should not block contract usage.

### 3. Email is off-chain

Emails must never be written to the smart contract. Email data belongs only in the backend database.

### 4. Notifications are best-effort in Round 5

Round 5 should send notification emails only for actions that happen through the DealLock frontend after the frontend observes a confirmed transaction and calls the backend.

This means:

- actions performed through the app can trigger emails;
- actions performed directly on Etherscan, scripts, or other frontends may not trigger emails yet;
- a later event-indexer round should make notifications fully reliable.

### 5. Do not leak sensitive content by email

Email notifications should avoid including full proof strings, dispute reasons, or settlement notes. These strings are on-chain/public, but emails should still stay concise and privacy-aware.

Use emails like:

```text
Provider submitted Milestone #1 in “Landing Page Build”.
Open DealLock to review the submission.
Contract: 0x...
Transaction: Etherscan link
```

Do not include full raw proof/dispute text unless explicitly decided later.

---

## Out of Scope

Do **not** implement in Round 5:

- Google OAuth.
- Password login.
- AI dispute analysis.
- Binding arbitration.
- Blockchain event indexer.
- Guaranteed notifications for actions outside the DealLock frontend.
- Smart contract changes.
- ERC-20 payments.
- Factory contract.
- Reputation system.
- Platform fees.

---

## Backend Requirements

### 1. Email transport layer

Add a backend email service abstraction.

Recommended structure:

```text
backend/src/email/
├── transport.ts
├── templates.ts
└── sendEmail.ts
```

The email transport should support:

```text
EMAIL_PROVIDER=console | smtp
```

For development, `console` provider is enough and should print the email contents and verification links to the backend console.

For production-like SMTP support, add environment variables:

```env
EMAIL_PROVIDER=console
EMAIL_FROM="DealLock <no-reply@deallock.app>"
APP_URL=http://localhost:5173
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=false
```

Do not hardcode any real provider credentials.

### 2. Prisma schema changes

Update `backend/prisma/schema.prisma`.

#### User model

Extend `User`:

```prisma
model User {
  id              String    @id @default(cuid())
  email           String?   @unique
  emailVerifiedAt DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  wallets         Wallet[]
  // existing relations...
}
```

If the current `User` model already exists, modify it without breaking existing data.

#### EmailVerificationToken

Add:

```prisma
model EmailVerificationToken {
  id        String    @id @default(cuid())
  userId    String
  email     String
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([email])
}
```

Store only a hash of the verification token, not the raw token.

#### NotificationPreference

Add global user preferences. Keep the first version simple.

```prisma
model NotificationPreference {
  id                    String   @id @default(cuid())
  userId                String   @unique
  agreementCreated       Boolean  @default(true)
  agreementAccepted      Boolean  @default(true)
  agreementFunded        Boolean  @default(true)
  milestoneSubmitted     Boolean  @default(true)
  milestoneReleased      Boolean  @default(true)
  milestoneRefunded      Boolean  @default(true)
  adjustmentRequested    Boolean  @default(true)
  adjustmentAccepted     Boolean  @default(true)
  adjustmentFunded       Boolean  @default(true)
  adjustmentSubmitted    Boolean  @default(true)
  adjustmentReleased     Boolean  @default(true)
  adjustmentRefunded     Boolean  @default(true)
  disputeOpened          Boolean  @default(true)
  settlementProposed     Boolean  @default(true)
  settlementAccepted     Boolean  @default(true)
  reviewClaimed          Boolean  @default(true)
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  user                   User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

If this feels too many booleans for the existing code style, a JSON preferences field is acceptable, but typed columns are preferred for clarity.

#### Agreement contact emails

Add optional contact emails to `Agreement`:

```prisma
clientEmail   String?
providerEmail String?
```

These emails are optional contact/notification emails. They are not authorization fields.

Use them when the counterparty has not yet signed up or linked a verified email.

#### EmailNotificationLog

Add a send log to avoid duplicate notification emails for the same transaction.

```prisma
model EmailNotificationLog {
  id              String    @id @default(cuid())
  agreementId     String?
  contractAddress String
  chainId         Int
  eventType       String
  txHash          String?
  recipientEmail  String
  status          String    // sent | skipped | failed
  error           String?
  createdAt       DateTime  @default(now())
  sentAt          DateTime?

  agreement        Agreement? @relation(fields: [agreementId], references: [id], onDelete: SetNull)

  @@index([contractAddress, chainId])
  @@index([txHash])
  @@unique([eventType, txHash, recipientEmail])
}
```

If `txHash` is null for non-chain emails, avoid using this unique constraint directly and implement deduplication in code.

### 3. API endpoints

Add routes under `backend/src/routes/email.ts` or equivalent.

All routes require an authenticated session unless otherwise noted.

#### Account email endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/email` | Return current email, verification status, and preferences |
| POST | `/email/start-verification` | Start or restart email verification for an email address |
| POST | `/email/confirm` | Confirm email using raw token |
| DELETE | `/email` | Remove email from current account |
| GET | `/notification-preferences` | Get notification preferences |
| PATCH | `/notification-preferences` | Update notification preferences |

`POST /email/start-verification` body:

```json
{
  "email": "user@example.com"
}
```

Rules:

- validate email format;
- normalize email to lowercase;
- rate-limit repeated requests;
- generate random token;
- store token hash;
- expire token after 30 minutes;
- send verification email;
- in console mode, print verification link.

`POST /email/confirm` body:

```json
{
  "token": "raw-token-from-email"
}
```

Rules:

- hash token and find active token;
- ensure not expired and not used;
- check whether the email is already verified by another account;
- set `user.email` and `user.emailVerifiedAt`;
- mark token as used;
- create default `NotificationPreference` if missing.

#### Agreement contact endpoints

Add or extend agreement routes so users can save contact emails.

Recommended endpoint:

| Method | Path | Description |
|---|---|---|
| PATCH | `/agreements/:contractAddress/contacts` | Update optional client/provider contact emails |

Body:

```json
{
  "chainId": 11155111,
  "clientEmail": "client@example.com",
  "providerEmail": "provider@example.com"
}
```

Rules:

- require session;
- require that at least one linked wallet is client or provider for the agreement;
- normalize emails;
- validate format;
- store off-chain only;
- do not send emails yet unless explicitly triggered by app action or verification flow.

### 4. App-triggered notification endpoint

Add an endpoint the frontend can call after a transaction confirms.

| Method | Path | Description |
|---|---|---|
| POST | `/notifications/contract-action` | Send best-effort email notification for a confirmed DealLock action |

Body:

```json
{
  "chainId": 11155111,
  "contractAddress": "0x...",
  "contractVersion": 4,
  "txHash": "0x...",
  "actionType": "milestone_submitted",
  "actorAddress": "0x...",
  "itemType": "milestone",
  "itemId": 0
}
```

Supported action types should include at least:

```text
agreement_accepted
agreement_funded
milestone_submitted
milestone_released
milestone_refunded
adjustment_requested
adjustment_accepted
adjustment_funded
adjustment_submitted
adjustment_released
adjustment_refunded
dispute_opened
settlement_proposed
settlement_accepted
review_claimed
```

Rules:

- require session;
- validate `contractAddress`, `chainId`, and `txHash`;
- require `actorAddress` to belong to the signed-in user's linked wallets;
- load agreement from backend registry;
- determine the counterparty recipient:
  - first, look up a DealLock account with the counterparty wallet and verified email;
  - if missing, fall back to `clientEmail`/`providerEmail` from `Agreement` contact fields;
  - skip if no email is available;
- check recipient preferences if the recipient has a DealLock account;
- send concise notification email;
- log send/skipped/failed in `EmailNotificationLog`;
- deduplicate by `eventType + txHash + recipientEmail`.

Round 5 does not need to independently verify the transaction receipt on-chain, but it is better if the backend does a lightweight validation when possible using the configured RPC. If that is too much for this round, document that the endpoint is app-trusted and will be hardened by the event-indexer round.

---

## Frontend Requirements

### 1. Account email UI

Add an email/settings panel accessible from the existing account/session area.

Possible component:

```text
frontend/src/components/dashboard/EmailSettingsPanel.tsx
```

It should show:

- current email;
- verification status;
- add/change email form;
- resend verification button;
- remove email button;
- explanation: email is for notifications only and does not control funds.

### 2. Notification preferences UI

Add a simple notification preferences section.

Recommended grouping:

```text
Agreement lifecycle
- Agreement accepted
- Agreement funded

Milestones
- Submitted
- Released
- Refunded

Paid adjustments
- Requested
- Accepted
- Funded
- Submitted
- Released
- Refunded

Disputes and settlements
- Dispute opened
- Settlement proposed
- Settlement accepted
- Review auto-claimed
```

A simple checkbox list is enough.

### 3. Agreement contact emails

Update create/load flows to support optional contact emails.

#### Create agreement form

Add optional fields:

```text
Client notification email (optional)
Provider notification email (optional)
```

Default behavior:

- if the signed-in user has a verified email and is the client, prefill client email;
- provider email can be entered manually;
- these fields should be saved only to backend/local metadata, not on-chain.

#### Loaded agreement

Add a small section in the agreement context/settings area:

```text
Notification contacts
Client email: ...
Provider email: ...
```

Allow editing if the current account has a linked wallet involved in the agreement.

### 4. Trigger notifications after confirmed app actions

After `ActionPanel` gets a confirmed transaction receipt, call:

```text
POST /notifications/contract-action
```

Map frontend actions to action types:

| Frontend action | actionType |
|---|---|
| acceptAgreement | `agreement_accepted` |
| fundAgreement | `agreement_funded` |
| submitMilestone | `milestone_submitted` |
| approveMilestone | `milestone_released` |
| refundExpiredMilestone | `milestone_refunded` |
| requestAdjustment | `adjustment_requested` |
| acceptAdjustment | `adjustment_accepted` |
| fundAdjustment | `adjustment_funded` |
| submitAdjustment | `adjustment_submitted` |
| approveAdjustment | `adjustment_released` |
| refundExpiredAdjustment | `adjustment_refunded` |
| disputeMilestone / disputeAdjustment | `dispute_opened` |
| proposeMilestoneSettlement / proposeAdjustmentSettlement | `settlement_proposed` |
| acceptMilestoneSettlement / acceptAdjustmentSettlement | `settlement_accepted` |
| claimMilestoneAfterReview / claimAdjustmentAfterReview | `review_claimed` |

Do not block the UI if notification sending fails. Transaction success is more important than email success.

Show a small non-blocking message like:

```text
Transaction confirmed. Notification email attempted.
```

or, if email failed:

```text
Transaction confirmed. Email notification could not be sent.
```

### 5. LocalStorage fallback

Keep existing localStorage metadata as fallback. Email fields should be stored in backend when signed in. If the user is signed out, optional email fields may be saved locally, but do not attempt notifications without backend session.

---

## Email Templates

Add simple templates in `backend/src/email/templates.ts`.

### Verification email

Subject:

```text
Verify your DealLock email
```

Body:

```text
Confirm this email address for DealLock notifications.

This does not give anyone access to your wallet or funds.

Verify email: <link>
```

### Contract action email

Subject examples:

```text
DealLock: Milestone submitted
DealLock: Agreement funded
DealLock: Dispute opened
DealLock: Settlement proposed
```

Body should include:

- project title;
- action summary;
- contract address short form;
- chain name;
- transaction link;
- app link to open the agreement;
- reminder that contract actions require wallet approval.

Avoid including full proof/dispute/settlement note text.

---

## Security Requirements

- Store email verification tokens hashed.
- Use random high-entropy tokens.
- Expire verification tokens after 30 minutes.
- Mark tokens as used after confirmation.
- Rate-limit email verification requests per user/email/IP where practical.
- Validate email format on backend.
- Normalize emails to lowercase.
- Never expose another user's email unless it is explicitly stored as an agreement contact email and visible to an involved party.
- Do not include private session data in email links.
- Do not make email a login method in this round.
- Do not allow email to authorize contract actions.
- Do not store emails on-chain.

---

## Testing Requirements

### Backend tests

Add tests for:

1. User can start email verification.
2. Verification token is stored hashed, not raw.
3. Expired token cannot verify email.
4. Used token cannot be reused.
5. Verified email is stored on the user.
6. Same email cannot be verified by two accounts.
7. Notification preferences are created and updated.
8. Agreement contact emails can be saved only by involved account.
9. Notification endpoint skips when no recipient email exists.
10. Notification endpoint sends when recipient has verified email.
11. Notification endpoint respects disabled preferences.
12. Notification endpoint deduplicates by tx hash + event type + recipient.

### Frontend checks

Add or manually verify:

1. Signed-in user can add an email.
2. Console email provider prints verification link in dev.
3. User can confirm email.
4. Email status updates in account UI.
5. User can toggle notification preferences.
6. Create agreement form supports optional contact emails.
7. Confirmed transaction calls the notification endpoint.
8. Failed email notification does not mark transaction as failed.

---

## Documentation Requirements

Update `docs/state.md`:

1. Update the overall state to include Round 5 email identity and notification infrastructure.
2. Add email to the identity model:

```text
DealLock Account = product identity and dashboard
Wallet           = blockchain authority
Email            = verified notification/contact channel
```

3. Update backend models and API endpoints.
4. Update frontend architecture with email settings, notification preferences, and action notification calls.
5. Add Round 5 to the Implementation Rounds section.
6. Keep AI arbitration explicitly deferred.
7. Mark event-indexer notifications as future work if not implemented.

Update `README.md`:

- Add backend email environment variables.
- Explain console email provider for local development.
- Explain how to verify an email.
- Explain notification limitations in Round 5.
- Explain that email does not control funds.

---

## Acceptance Criteria

Round 5 is complete when:

- Users can add and verify an email address after wallet sign-in.
- Email verification works in local development through console transport.
- Verified email is stored in backend and visible in account UI.
- Users can update notification preferences.
- Agreements can store optional client/provider contact emails off-chain.
- Confirmed app actions trigger best-effort email notifications to the counterparty when an email exists.
- Notification sends are logged and deduplicated.
- Email notification failures do not affect contract transaction success.
- No smart contract changes are made.
- No Google OAuth is added.
- No AI arbitration is added.
- `docs/state.md` and `README.md` are updated.

# Round 19 — Landing Page and Dashboard Conversion Upgrade

## Status

Planned.

## Goal

Turn DealLock from a functional escrow dApp with a polished interface into a clearer, more convincing, and more activation-oriented product.

Round 19 is a **frontend-only landing page and dashboard pass**. The goal is not to add escrow functionality. The goal is to make the product easier to understand, easier to trust, and easier to start using.

The public landing page should answer, in the first few seconds:

- What is DealLock?
- Who is it for?
- Why is it safer than informal payment flows?
- What does the user do first?
- Where do funds live?
- What happens after work is submitted?

The dashboard should answer, immediately after opening:

- What is the current agreement state?
- What should I do next?
- Who needs to act now?
- How much is escrowed, released, refundable, or waiting?
- What happened recently?
- How is this agreement protected?

This round should make DealLock feel closer to a calm fintech/productivity tool than to a generic crypto demo.

---

## Research source

This round is based on the provided deep research report benchmarking 50 startup and AI/fintech/devtool/web3 landing pages.

The strongest common patterns from that report:

1. **Outcome-first hero.** Lead with the user result, not the technology.
2. **Product preview above the fold.** Show the actual product shape immediately.
3. **Trust proof early.** For money-related products, trust must appear before feature depth.
4. **Clear CTA pair.** One primary action and one lower-pressure learning action.
5. **Role-specific messaging.** Clients and providers need different emotional reassurance.
6. **Objection handling.** Do not hide questions about custody, crypto, release, revisions, and disputes.
7. **Action-oriented dashboard.** The home screen should prioritize the next action, not just display data.
8. **Helpful empty states.** Empty dashboards should teach and guide, not look broken.
9. **Transaction clarity.** Money/wallet actions need explicit pending, confirmed, failed, and rejected states.
10. **Plain English over web3 jargon.** Use crypto terms only after translating the product meaning.

---

## Product positioning for this round

Use this as the core positioning:

> **Milestone escrow for client work.**

DealLock lets clients and providers create a milestone-based agreement, fund work in ETH or USDC, and release payment only when the relevant approval path is completed. Funds stay in the agreement contract until the contract workflow says they move.

### Target tone

- Minimal
- Premium
- Calm
- Trustworthy
- Precise
- Non-hype
- Non-crypto-native by default
- Clear enough for a first-time client or freelancer

### What DealLock is not trying to sound like

Avoid:

- “Revolutionary web3 escrow protocol”
- “Decentralized future of work powered by smart contracts”
- “Trustless crypto-native settlement layer”
- “Next-generation DeFi freelancer marketplace”

Better:

- “Protect client work with milestone escrow.”
- “Fund work step by step. Release only after approval.”
- “A clear payment workflow for clients and providers.”
- “Funds stay in the contract until the agreed action happens.”

---

## Hard constraints

Claude must treat these as non-negotiable.

### No product logic changes

Do **not** change:

- Solidity contracts
- Contract deployment model
- Contract ABI assumptions
- Backend APIs
- Database schema
- Indexer logic
- Email notification logic
- Wallet authority model
- Payment/release/refund/dispute semantics
- Supported assets
- Platform fee logic
- Arbitration logic

Round 19 is frontend/content/UX only.

### No fake trust

Do **not** add:

- Fake testimonials
- Fake customer logos
- Fake usage metrics
- Fake audit badges
- Fake compliance claims
- Fake insurance claims
- Fake “trusted by” sections
- Fake YC/VC/investor claims
- Fake legal guarantees

Use **product-truth proof** instead:

- No platform custody
- Wallet-authorised actions only
- Funds stay in the agreement contract
- Milestone-based release
- Activity history
- ETH and USDC support, only if already implemented
- Revision/dispute flows, only as currently supported
- No platform fees, only if true in the current codebase

### No jargon-first copy

Do not lead with:

- Smart contract
- ERC-20
- On-chain
- Wallet signature
- Non-custodial
- Decentralized
- Settlement

These terms may appear, but only after a plain-English explanation.

Example:

- Bad: `Non-custodial ERC-20 milestone escrow`
- Better: `Funds stay in the agreement contract until work is approved. Under the hood, this is handled by a non-custodial smart contract.`

### No forced wallet trap

The landing page primary CTA must not feel like a sudden wallet popup with no explanation.

Users should understand what will happen before they are asked to connect/sign.

### No decorative complexity

Avoid heavy animations, crypto-neon effects, noisy gradients, or complex glassmorphism. DealLock handles money, deadlines, and disputes. It should feel serious and controlled.

---

## Landing page target structure

Rebuild or significantly restructure the landing page around this order.

### 1. Hero split

The first viewport should include:

- Short eyebrow line.
- Strong headline.
- Plain-English subhead.
- Primary CTA.
- Secondary CTA.
- Role switcher or role chips.
- Product preview.
- Trust strip.

#### Recommended hero copy

Eyebrow:

```text
For clients and providers working across wallets
```

Headline:

```text
Milestone escrow for client work
```

Subhead:

```text
Create an agreement, fund milestones in ETH or USDC, and release payment only when work is approved. Funds stay in the contract until the workflow says they move.
```

Primary CTA options:

```text
Create an agreement
Start protected project
Open your first escrow
```

Secondary CTA options:

```text
See how it works
View a sample agreement
Learn the 3-step flow
```

Role switcher:

```text
I'm hiring
I'm delivering work
```

Role-specific helper copy:

For client:

```text
Keep budget control. Release funds only after the agreed milestone is ready.
```

For provider:

```text
Get payment certainty before work begins. Every milestone has a clear approval path.
```

#### Hero product preview

Add a realistic frontend-only product preview using real product concepts.

It should show something like:

- Agreement title: `Website redesign contract`
- Status: `Funded` or `In review`
- Client and provider roles
- Asset: `USDC` or `ETH`
- Milestone list
- Current milestone state
- Next action button
- Mini activity row
- Small “Funds in contract” indicator

The preview should not pretend to be live data unless it is actually connected to live data.

Label it clearly as a preview if static:

```text
Example agreement preview
```

### 2. Trust strip

Place immediately below the hero or inside the hero footer.

Possible items:

```text
No platform custody
Wallet-authorised actions only
Milestone-based payouts
ETH and USDC support
Revisions and disputes supported
No platform fees
```

Rules:

- Only include claims that are true in the current codebase.
- Use short labels.
- Use icons only as support, not as the only meaning.
- On mobile, wrap cleanly into 2-column or stacked layout.

### 3. Three-step How it Works

Create a simple, highly readable flow:

1. **Create the agreement**
   - Add client/provider wallets, milestones, deadlines, and payment asset.
2. **Fund milestones safely**
   - The client funds the contract before the provider starts or before a milestone proceeds.
3. **Review and release**
   - The provider submits work, the client reviews it, and funds are released, revised, disputed, or settled according to the agreement flow.

Suggested copy:

```text
1. Define the work
Set the provider, payment asset, milestone amounts, and deadlines in one agreement.

2. Fund the contract
The client funds the agreement contract. DealLock does not custody the money.

3. Release after approval
The provider submits proof. The client approves, requests a revision, or follows the dispute path if something goes wrong.
```

Keep this section short. It should not become a full docs page.

### 4. Role-specific value bento

Create a bento/card section with two main role columns:

#### For clients

Cards:

- **Budget control** — fund defined milestones instead of sending the full amount informally.
- **Approval before release** — release funds only after the work reaches review/approval state.
- **Readable history** — see submissions, releases, revision requests, disputes, and settlements in one timeline.

#### For providers

Cards:

- **Payment certainty** — see that funds are escrowed before continuing work.
- **Clear next step** — know whether to accept, deliver, revise, or wait for review.
- **Less payment chasing** — every milestone has an explicit state and action history.

Rules:

- Do not overpromise legal enforcement.
- Do not imply DealLock guarantees dispute outcomes.
- Keep cards workflow-based, not architecture-based.

### 5. Product proof block

Add a section that shows the actual product interface or a realistic mock based on real components.

It should explain:

- Current agreement state
- Current milestone state
- Escrowed/released amount
- Next action
- Activity feed
- Wallet/network facts
- Protection/trust panel

Suggested heading:

```text
A workspace for every protected agreement
```

Suggested subhead:

```text
DealLock keeps the agreement, funds, milestones, proof, and activity history in one place so both sides know what happens next.
```

Avoid fake metrics. Use annotated UI instead of logos/testimonials.

### 6. Objection handling / FAQ

Add at least 6 concise FAQ items.

Required questions:

1. **Where does the money go after funding?**
   - Into the contract for this agreement, not to DealLock and not to the provider until the required approval path completes.

2. **Who can release funds?**
   - The authorized contract role can trigger release according to the current agreement state. Do not imply arbitrary admin power.

3. **Do users need to understand crypto?**
   - They need a wallet and the correct asset/network, but the interface should explain each action in product language.

4. **What happens if the client wants changes?**
   - Use the current revision/request flow if implemented. Do not invent free revision or paid change-order behavior beyond what exists.

5. **What happens if there is a dispute?**
   - Explain the current dispute and mutual/manual settlement model. Do not mention AI arbitration as if it exists.

6. **Which assets are supported?**
   - Mention only assets actually supported by the current app. If ETH and USDC are supported, say ETH and USDC.

Optional questions:

- Why not just send crypto directly?
- Why not pay everything upfront?
- Can a provider reject an adjustment?
- Can deadlines change?
- What if a transaction fails?
- Does DealLock hold my funds?

### 7. Final CTA

End with a clear conversion block.

Suggested heading:

```text
Protect your next client project
```

Suggested body:

```text
Start with a milestone agreement, fund it step by step, and keep both sides aligned from delivery to release.
```

CTA pair:

```text
Create an agreement
See how it works
```

---

## Dashboard target structure

The dashboard should feel like a command centre, not a data dump.

### 1. Top action centre

Add a prominent `Next step` card near the top of the dashboard.

It should answer:

- Who needs to act?
- What action is available?
- What happens after this action?
- Is money moving?
- Is this action reversible?

Examples:

```text
Next step
Client needs to fund Milestone 1 before the provider can start with payment protection.
[Fund milestone]
```

```text
Next step
Provider submitted work for Milestone 2. Review the proof and choose whether to release funds or request a revision.
[Review submission]
```

```text
Next step
This milestone is disputed. Funds stay in the contract until both sides complete the supported settlement flow.
[View dispute]
```

Rules:

- Show only one highest-priority next action.
- Do not show many equal-weight buttons at the top.
- Priority logic must map to real app states only.
- If state detection is uncertain, use safer generic copy.

### 2. Agreement progress rail

Add a visual lifecycle rail. It should make the agreement state understandable at a glance.

Suggested stages:

```text
Draft / Proposed → Accepted → Funded → In progress → Review → Released / Refunded / Disputed / Settled
```

Important:

- Use actual product state names internally.
- Display plain-English labels externally.
- Do not invent unsupported states.
- If the exact state is more nuanced, show a small helper sentence.

### 3. Value summary cards

Add summary cards near the top or under the progress rail.

Suggested cards:

- **Escrowed** — funds currently in the agreement contract.
- **Released** — funds already released to provider.
- **Refunded** — funds already returned to client, if relevant.
- **Pending** — current pending action or transaction.
- **Next amount** — amount tied to the next milestone/action, if available.

Rules:

- If a metric is not available, do not fake it.
- Use `—` or hide the card rather than inventing data.
- Use asset-aware formatting for ETH and ERC-20 values.
- Do not rely on color alone.

### 4. Improved empty states

Handle at least these states:

#### Signed out

Goal: invite the user to connect wallet after explaining why.

Copy:

```text
Connect your wallet to open your agreement workspace.
DealLock uses your wallet to identify which agreements and actions belong to you.
```

CTA:

```text
Connect wallet
```

#### Wallet connected, no agreements

Goal: guide the user to first value.

Copy:

```text
No agreements yet.
Start with a simple milestone agreement to protect budget, timeline, and payout from day one.
```

CTA:

```text
Create agreement
```

Secondary:

```text
View 3-step guide
```

#### Agreement exists, no immediate action

Goal: reassure the user.

Copy:

```text
No action needed right now.
DealLock will show the next required step here when this agreement changes state.
```

### 5. Onboarding/help block

Reuse Round 18 onboarding components in context.

Possible surfaces:

- `RoleGuide` in a dashboard help card.
- `ConceptGlossary` inside an accordion/drawer/modal.
- “What happens next?” panel beside the action centre.
- First-run checklist.

Suggested first-run checklist:

```text
1. Connect the wallet you will use for this agreement.
2. Create or open an agreement.
3. Check the payment asset and network.
4. Confirm who acts next.
5. Follow the milestone timeline.
```

This should be skimmable, not a full tutorial engine.

### 6. Activity and transaction area

Keep the improved Round 18 activity feed, but make it more scannable.

Requirements:

- Map raw event names to product language.
- Group or visually separate activity by milestone when possible.
- Show icons + text, not icons/color alone.
- Show empty/loading/error states using proper UI components.
- Avoid duplicate information with the action centre.

Suggested event language:

```text
Agreement accepted
Funds deposited
Work submitted
Funds released
Refund issued
Revision requested
Dispute opened
Settlement proposed
Settlement completed
Deadline update requested
Deadline update approved
```

### 7. Transaction status banner

Add or improve a visible transaction status surface for wallet actions.

States to support if already detectable:

- Awaiting wallet signature
- Signature rejected
- Transaction submitted
- Confirming on network
- Confirmed
- Failed

Example copy:

```text
Awaiting wallet signature
MetaMask will ask you to confirm this action. No funds move until the transaction is submitted and confirmed.
```

```text
Transaction rejected
You rejected the wallet request. No escrow state changed and no funds moved.
```

```text
Transaction confirming
Your transaction was submitted. DealLock will update the agreement after the network confirms it.
```

Use `aria-live` or an equivalent semantic pattern where practical.

### 8. Trust/transparency panel

Add a compact panel that explains the protection model for the current agreement.

Suggested content:

```text
How this agreement is protected
- Funds live in this agreement contract.
- DealLock does not custody the escrow balance.
- Contract actions require the authorized wallet role.
- Releases, refunds, revisions, disputes, and settlements follow the contract workflow.
```

Possible facts if available:

- Contract address with copy button
- Network
- Payment asset
- Client wallet
- Provider wallet
- Current contract balance
- Explorer link

Rules:

- Mask long wallet addresses but allow copy.
- Show explorer link only if supported/configured.
- Do not expose confusing raw internals without explanation.

---

## Component plan

Claude should inspect the current repo and adapt these paths to the existing structure.

Recommended new or refactored components:

```text
frontend/src/components/landing/
  HeroSplit.tsx
  TrustStrip.tsx
  HowItWorks.tsx
  RoleValueBento.tsx
  ProductProof.tsx
  FAQAccordion.tsx
  FinalCta.tsx

frontend/src/components/dashboard/
  ActionCenter.tsx
  ProgressRail.tsx
  ValueSummaryGrid.tsx
  DashboardEmptyState.tsx
  OnboardingChecklist.tsx
  TrustPanel.tsx
  TransactionStatusBanner.tsx

frontend/src/components/onboarding/
  RoleGuide.tsx              # reuse/improve from Round 18
  ConceptGlossary.tsx        # reuse/improve from Round 18
  ExplainerCard.tsx          # reuse/improve from Round 18
```

Existing likely files to update:

```text
frontend/src/pages/LandingPage.tsx
frontend/src/pages/DashboardPage.tsx
frontend/src/components/layout/AppShell.tsx
frontend/src/components/activity/ActivityFeed.tsx
frontend/src/styles/tokens.css
frontend/src/index.css
```

Only create new components if they reduce complexity. If the repo already has equivalent components, improve and reuse them.

---

## Styling direction

### Visual target

The visual direction should be:

- Dark-first but not low-contrast.
- Minimal but not empty.
- Futuristic but not neon/gamified.
- Premium but not decorative.
- Product-first, with UI previews doing real explanatory work.

### Layout rules

- Hero should be readable at 1280px and 1440px.
- Hero must not overflow at 375px.
- Product preview should collapse gracefully on mobile.
- Avoid long one-line headings on mobile.
- Keep button clusters small.
- Cards should have clear hierarchy and spacing.
- Avoid walls of identical cards.

### Token rules

Use the existing design token system. Do not introduce hard-coded random colors.

All of these should come from tokens or existing variables:

- Backgrounds
- Borders
- Surfaces
- Text colors
- Muted text
- Accent colors
- Success/warning/error states
- Shadows
- Radii
- Focus rings

### Motion rules

Subtle motion is allowed for:

- Hero product preview entrance
- Accordion expansion
- Hover states
- Small status transitions

Motion is not allowed to carry essential meaning.

Must respect:

```css
@media (prefers-reduced-motion: reduce)
```

---

## Accessibility requirements

Round 19 must preserve or improve accessibility.

Requirements:

- Keyboard navigation works across landing page and dashboard.
- Focus states are visible for CTAs, links, accordions, chips, copy buttons, and wallet/action buttons.
- Color is never the only indicator of state.
- State pills include text labels.
- Touch targets are at least 44×44px where practical.
- FAQ accordion uses semantic buttons and `aria-expanded`.
- Transaction status changes use a semantic live region where practical.
- Product preview does not trap focus if it is decorative/static.
- Decorative icons have empty `aria-hidden` semantics where appropriate.
- Important icons have text labels.
- Contrast meets WCAG AA for body text and key functional labels.

---

## Microcopy library

Use these as starting copy, not mandatory final wording.

### Landing

```text
Milestone escrow for client work
```

```text
Create agreements, fund milestones in ETH or USDC, and release payment only when work is approved. Funds stay in the contract until the workflow says they move.
```

```text
For clients who need control. For providers who need payment certainty.
```

```text
No platform custody
```

```text
Wallet-authorised actions only
```

```text
Milestone-based payouts
```

```text
Revisions and disputes supported
```

```text
Create an agreement
```

```text
See how it works
```

### Dashboard

```text
Next step
```

```text
What happens after this?
```

```text
No action needed right now
```

```text
Funds stay in the agreement contract until the required approval path is completed.
```

```text
Waiting for client action
```

```text
Waiting for provider action
```

```text
Ready for review
```

```text
Funds released
```

```text
Transaction rejected. No escrow state changed and no funds moved.
```

```text
Need this in plain English?
```

```text
Open the 2-minute guide for clients and providers.
```

---

## State and copy mapping guidance

Claude must inspect existing state enums/types/helpers before implementing this mapping.

Use this as a product-language guide, not as a new source of truth.

| Internal concept | User-facing label | Helper copy style |
|---|---|---|
| Proposed / draft agreement | Waiting for acceptance | Provider must accept before funding can continue. |
| Accepted but not funded | Ready to fund | Client can fund the agreement or milestone. |
| Funded | Funded | Funds are in the agreement contract. |
| Pending milestone | Not started / Next milestone | This milestone is waiting for the required previous step. |
| Submitted milestone | Ready for review | Provider submitted proof; client can review. |
| Released milestone | Funds released | Payment was released for this milestone. |
| Refunded milestone | Refunded | Funds were returned according to the contract flow. |
| Revision requested | Revision requested | Client requested changes before release. |
| Disputed | Disputed | Funds stay in the contract until the supported settlement flow completes. |
| Settled | Settled | The milestone was resolved through settlement. |

Do not add labels for states that do not exist in the code unless they are purely display aliases for existing states.

---

## Implementation phases

### Phase 1 — Inspect and plan

Claude should first inspect:

```text
frontend/src/pages/LandingPage.tsx
frontend/src/pages/DashboardPage.tsx
frontend/src/components/onboarding/
frontend/src/components/activity/
frontend/src/components/layout/
frontend/src/styles/
frontend/src/index.css
frontend/src/types/
frontend/src/lib/
```

Find existing:

- State enums
- Agreement/milestone data shapes
- Transaction status helpers
- Formatting helpers
- Address/explorer helpers
- Existing UI components
- Existing token variables
- Round 18 onboarding components

Then implement with minimal disruption.

### Phase 2 — Landing page rebuild

Implement:

- Hero split
- Role switcher/chips
- Product preview
- Trust strip
- Three-step How it Works
- Role-specific value bento
- Product proof section
- FAQ/objection handling
- Final CTA

Acceptance:

- First viewport explains DealLock without requiring web3 knowledge.
- Product preview is visible above or near the fold on desktop.
- Mobile layout works at 375px.
- CTA pair is clear.
- Trust claims are truthful.

### Phase 3 — Dashboard action orientation

Implement:

- ActionCenter
- ProgressRail
- ValueSummaryGrid
- DashboardEmptyState
- TrustPanel
- TransactionStatusBanner
- OnboardingChecklist/help block

Acceptance:

- Dashboard clearly shows one primary next step.
- Empty states guide the user.
- Agreement state is understandable without reading raw enums.
- Summary cards do not fake unavailable metrics.
- Transaction states are clear and safe.

### Phase 4 — Polish and QA

Polish:

- Spacing
- Typography
- Dark-mode contrast
- Focus states
- Mobile responsiveness
- Loading/error/empty states
- Reduced motion
- Activity feed wording

Run checks.

---

## Acceptance criteria

Round 19 is complete only if all P0 requirements pass.

### P0 requirements

- Landing hero is outcome-first and trust-first.
- Landing hero includes CTA pair, product preview, and trust strip.
- Landing page includes a 3-step workflow explanation.
- Landing page includes role-specific value cards for client and provider.
- Landing page includes FAQ/objection handling for custody, release, crypto knowledge, revisions, disputes, and assets.
- Dashboard includes a top `Next step` action centre.
- Dashboard includes an agreement progress rail.
- Dashboard includes value summary cards or safe fallbacks when data is unavailable.
- Dashboard empty states are helpful for signed-out, connected/no-agreement, and no-action states.
- Round 18 onboarding components are reused in meaningful contexts.
- No backend, contract, indexer, or escrow logic changes are introduced.
- No fake trust/social proof/compliance claims are introduced.
- `npm run build` passes.

### P1 requirements

- Activity feed is more scannable.
- Transaction status banner handles pending/rejected/confirmed/failed states where available.
- FAQ accordion is accessible.
- Product preview works cleanly on mobile.
- Trust panel includes contract/network facts where available.
- Visual polish is consistent with existing design tokens.

### P2 optional improvements

- Static sample agreement path from the landing page.
- Short comparison section: `Why DealLock instead of upfront invoice or direct wallet transfer?`
- Additional CTA copy variants prepared for later A/B testing.
- Lightweight tutorial entry point for future guided onboarding.

---

## QA checklist

Claude should run or manually validate:

```bash
npm run build
```

Also run if configured:

```bash
npm run lint
npm run test
```

Manual QA:

- Desktop 1280px: hero and preview are balanced.
- Desktop 1440px: page does not feel sparse or stretched.
- Mobile 375px: no horizontal overflow.
- Mobile 375px: product preview remains readable or collapses into a simpler card.
- Keyboard: all CTAs, links, role chips, accordions, copy buttons, and action buttons are reachable.
- Focus: visible focus ring appears on every interactive element.
- Reduced motion: page remains usable with reduced motion enabled.
- Contrast: muted text, trust strip, pills, and dashboard cards are readable.
- Empty states: signed-out, wallet-connected/no-agreement, and no-action states all render useful copy.
- Contract states: funded, submitted/review, released, refunded, revision, dispute, and settlement displays remain coherent.
- Wallet actions: rejected/failed transactions clearly say that no state changed if true.
- No fake claims: landing contains no fake customers, audits, metrics, or compliance badges.

---

## Suggested commit message

```text
Improve landing and dashboard UX for Round 19
```

Alternative:

```text
Add trust-first landing and action-oriented dashboard UX
```

---

## Final Claude prompt

Use this prompt if running Claude/Cursor directly:

```text
You are implementing DealLock Round 19.

Read docs/round_19.md fully before editing. Implement Round 19 as a frontend-only conversion and trust pass. Do not change Solidity, backend APIs, indexer logic, database schema, escrow semantics, wallet authority, supported assets, or payment behavior.

The landing page must explain DealLock in plain English for non-crypto-savvy clients and providers. Reframe the hero around the outcome: milestone escrow for client work. Add a product preview in or near the first viewport, a truthful trust strip, a 3-step how-it-works section, role-specific client/provider value cards, a product proof block, FAQ/objection handling, and a final CTA.

The dashboard must become an action-oriented home screen. Add a top Next Step action centre, agreement progress rail, value summary cards, better empty states, contextual onboarding/help using the Round 18 components, a trust/transparency panel, and clearer transaction status messaging where the current code already exposes transaction state.

Use existing design tokens and components where possible. Keep the style minimal, premium, calm, and trust-heavy. Do not add fake customer logos, testimonials, audits, metrics, compliance claims, or legal guarantees. Do not lead with web3 jargon. Use plain-English product language first and crypto terms second.

Before implementing, inspect the current frontend file structure, existing state enums/types, transaction helpers, onboarding components, activity feed, and CSS tokens. Adapt paths to the actual repo. Build reusable components only when they reduce duplication.

Acceptance: npm run build must pass. If lint/tests are configured, run them too. Verify mobile at 375px, keyboard focus, reduced motion, contrast, empty states, and all existing agreement/milestone states. No backend/contract/indexer changes are allowed.
```

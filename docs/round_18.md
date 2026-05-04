# Round 18 — Frontend Visual Elevation, UX Clarity, and Onboarding Foundation

## Status

Implemented.

## Goal

Elevate DealLock's frontend from a technically functional public-beta dApp into a polished,
minimalistic, futuristic, and intuitive product interface, without changing any contract, backend,
escrow, or indexer behavior.

---

## What changed

### 1. BetaBanner fixed (AppShell.tsx)

The `BetaBanner` component used hardcoded light CSS colors (`#fffbeb`, `#fcd34d`, `#92400e`) that
clashed with the dark design system. Replaced with design-token-based dark styling that integrates
with the rest of the UI.

### 2. Missing CSS classes added (app-chrome.css)

- `.beta-banner` — dark-themed testnet banner
- `.session-dot` / `.session-dot--active` — live status dot referenced in AppShell.tsx but not defined
- `.topbar-error` — topbar error state referenced in AppShell.tsx but not defined

### 3. Missing state pills added (tokens-base.css)

The milestone states `Disputed`, `Settled`, and `RevisionRequested` had no visual styling.  
Added:

- `.state-pill--disputed` — red tint, for the Disputed milestone state
- `.state-pill--settled` — accent tint, for the Settled milestone state
- `.state-pill--revisionrequested` — warning tint, for the RevisionRequested V6 state

### 4. Missing milestone-node styles added (dashboard.css)

Added visual differentiation for disputed, settled, and revision-requested milestone timeline nodes:

- `.milestone-node--disputed` — red step indicator + red-tinted card
- `.milestone-node--settled` — accent step indicator
- `.milestone-node--revisionrequested` — warning step indicator + warning-tinted card

### 5. Missing agreement-row-state colors added (dashboard.css)

Added `.agreement-row-state--disputed`, `.agreement-row-state--settled`, and
`.agreement-row-state--revisionrequested` color overrides for the sidebar agreement list.

### 6. Activity feed polished (AgreementActivityFeed.tsx + dashboard.css)

- Raw camelCase event names replaced with human-readable product labels (e.g. "MilestoneFunded"
  → "Escrow funded", "RevisionRequested" → "Revision requested")
- Each event type has a contextual icon
- Signed-out state improved: clear prompt with explanation instead of plain text
- Loading state improved: animated dots with aria-live
- Empty state improved: consistent `empty-state` class with icon and guidance
- Activity items have a small icon column for quick visual scanning
- Amount, item tag, and actor address displayed as distinct styled elements
- Hover effects on activity items
- Accessibility: `role="list"`, `role="listitem"`, and descriptive `aria-label` on the Tx link

### 7. Onboarding/tutorial foundation components created

New directory: `frontend/src/components/onboarding/`

**ExplainerCard.tsx** — Reusable educational callout card with icon, title, body, and variant
styling (info, client, provider, warning). Ready for use in empty states, form sidebars, and
tutorial flows.

**ConceptGlossary.tsx** — Plain-English definitions for 11 escrow concepts: Escrow, Milestone,
Review period, Deadline grace period, Paid adjustment, Revision request, Dispute, Mutual
settlement, Wallet authority, Payment asset, Factory-created agreement. Supports a `terms` filter
to show only relevant definitions.

**RoleGuide.tsx** — Side-by-side 4-step client vs. provider role guide with role-colored step
numbers. Supports rendering `client`, `provider`, or `both` roles.

All three components have corresponding CSS added to `dashboard.css`.

### 8. Landing page upgraded (LandingPage.tsx + app-chrome.css)

- Hero subtitle updated to mention ETH and ERC-20 (was ETH-only)
- "Digital-first" and "Sepolia-ready" feature cards replaced with "ETH & ERC-20" and "Cooperative
  revisions" to reflect V5/V6 capabilities
- New **"New to escrow?"** section added before the CTA strip:
  - `RoleGuide` component showing client and provider 4-step flows side by side
  - `ConceptGlossary` panel with 8 key terms
  - Section linked from a new `#escrow-guide` anchor
- CSS for the new section added to `dashboard.css` (`escrow-explainer-section`,
  `escrow-explainer-grid`, `escrow-glossary-card`, etc.)

### 9. Agreement overview trust strip added (AgreementOverview.tsx + dashboard.css)

A compact trust indicator row added below the escrow metrics:
"No platform custody · Wallet-authorized actions only · All funds in the contract · No platform fees"

---

## Files changed

- `frontend/src/components/layout/AppShell.tsx` — BetaBanner fix
- `frontend/src/styles/app-chrome.css` — beta-banner, session-dot, topbar-error CSS
- `frontend/src/styles/tokens-base.css` — disputed, settled, revisionrequested state pills
- `frontend/src/styles/dashboard.css` — milestone node states, activity feed, onboarding
  components, overview trust strip
- `frontend/src/components/AgreementActivityFeed.tsx` — product event labels, icons, empty/loading
  states
- `frontend/src/components/AgreementOverview.tsx` — trust indicator strip
- `frontend/src/pages/LandingPage.tsx` — ERC-20 mention, updated features, "New to escrow?" section
- `frontend/src/components/onboarding/ExplainerCard.tsx` — new
- `frontend/src/components/onboarding/ConceptGlossary.tsx` — new
- `frontend/src/components/onboarding/RoleGuide.tsx` — new

---

## Verification

Passed:
```
cd frontend && npm run build
```

TypeScript: no errors. Vite build: clean (pre-existing vendor chunk size warning, unrelated to this round).

Not run / blocked:
- `npm run lint:contracts` — no Solidity changes
- `npx hardhat compile` — no contract changes
- `npm run check:bytecode` — no contract changes
- `npx hardhat test` — no contract changes
- `cd backend && npm run build` — no backend changes
- PostgreSQL-backed release gate — PostgreSQL not available locally; frontend build passed

---

## Behavior confirmation

- No Solidity behavior changed.
- No backend escrow authority added.
- No payment, funding, dispute, or settlement logic changed.
- V1–V6 compatibility preserved.
- Factory V1/V2/V3 fallback behavior preserved.
- Wallet authority and required-wallet gating preserved.
- Payment asset formatting for ETH/ERC-20 preserved.
- Notification fallback calls after confirmed transactions preserved.
- Signed-out localStorage mode and signed-in backend registry mode preserved.
- Backend-unavailable behavior preserved.

---

## Known limitations

- The onboarding components (ExplainerCard, ConceptGlossary, RoleGuide) are created but only
  partially integrated: ConceptGlossary and RoleGuide are used on the landing page "New to
  escrow?" section. ExplainerCard is available for future use in dashboard empty states, form
  sidepanels, and tutorial flows.
- ActionPanel action grouping and inline "what does this do?" copy was not changed in this round.
  The existing group structure and descriptions are functional; deeper copy work is deferred.
- Full tutorial engine with persistence, user progress tracking, or guided modal flows is
  intentionally out of scope for Round 18 per spec.

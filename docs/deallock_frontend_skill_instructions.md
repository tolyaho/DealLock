# DealLock Frontend Skill Instructions

**Suggested repo path:** `docs/frontend_skill_instructions.md`

This file is the source of truth for using the installed frontend/design skills in the DealLock project.

Installed skills:

- `/crypto-frontend-design`
- `/elegant`
- `/enterprise`
- `/frontend-accessibility-best-practices`
- `/glassmorphism`
- `/modern-frontend-design`
- `/onboarding-optimization`

---

## 0. Global DealLock Direction

DealLock should not feel like a generic crypto dApp or a simple milestone tracker.

It should feel like a **premium trust execution system** for serious digital deals:

- the client does not blindly trust the provider
- the provider does not blindly trust the client
- the platform does not custody money
- funds are locked in a smart contract
- every important action is wallet-authorized
- the agreement state is transparent and auditable
- non-crypto users can still understand what is happening

### Visual mood

Use a minimal, futuristic, high-status interface:

- dark-first or premium neutral base
- precise spacing
- strong typography
- subtle glow, depth, and motion
- realistic product artifacts instead of generic decorative cards
- clear status language
- calm trust, not hype

### Product metaphor

Use these metaphors across the landing page and dashboard:

- **Smart-contract vault** — money is locked by code, not held by a middleman
- **Deal control room** — both sides see the same agreement state
- **Trust rail** — deal progress is transparent, sequential, and auditable
- **Wallet authority** — actions require the correct on-chain role wallet
- **Proof trail** — submissions, approvals, disputes, and settlements leave a visible activity history

### Copy principles

Prefer simple direct language:

- “Funds locked in a smart contract”
- “No platform custody”
- “No platform fee”
- “Client approves release”
- “Provider can request review or settlement”
- “Wallet signature required”
- “Activity is indexed from confirmed on-chain events”

Avoid misleading or overconfident claims:

- Do not say “risk-free”
- Do not say “legally guaranteed”
- Do not say “AI arbitration” unless implemented
- Do not imply the backend can move funds
- Do not imply email can authorize actions
- Do not claim support for arbitrary tokens, BTC, SOL, fiat, swaps, or gasless payments

### Technical guardrails

Do not change Solidity, backend, indexer, auth, payment, or wallet logic unless the task explicitly asks for it.

For visual/frontend improvement rounds, focus on:

- `frontend/src/pages/LandingPage.tsx`
- `frontend/src/components/landing/*`
- `frontend/src/components/dashboard/*`
- `frontend/src/components/ActionPanel.tsx`
- `frontend/src/components/AgreementOverview.tsx`
- `frontend/src/components/AgreementActivityFeed.tsx`
- `frontend/src/components/MilestoneList.tsx`
- `frontend/src/components/AdjustmentList.tsx`
- `frontend/src/index.css`

Always preserve:

- contract version handling
- wallet role gating
- payment asset formatting
- transaction behavior
- existing API behavior
- accessibility basics
- mobile responsiveness

### Required verification

After changes, run at minimum:

```bash
cd frontend && npm run build
```

If shared types or ABI-facing code changed, also run:

```bash
npx hardhat compile
cd backend && npm run build
```

---

## 1. `/crypto-frontend-design`

### Purpose

Use this skill when improving anything related to crypto UX, wallet actions, smart-contract escrow, token payments, chain state, transaction flows, or trust messaging.

DealLock must feel credible to crypto-native users while remaining understandable to non-crypto users.

### Main goal

Make the interface clearly communicate:

> DealLock does not hold the money. The smart contract does.

### Apply this skill to

- wallet connection and sign-in states
- contract address displays
- chain/network labels
- ETH/ERC-20 payment chips
- allowance and approval flows
- funding flows
- transaction pending/confirmed/error states
- activity feed
- trust/no-custody messaging
- dashboard role gating
- smart-contract escrow explanations

### Design instructions

Use crypto-native UI cues, but keep them restrained:

- show chain/network badges
- show wallet role chips: `Client`, `Provider`, `Observer`, `Wrong wallet`
- show asset chips: `ETH`, `USDC`, token address when useful
- show contract address with copy/explorer actions
- show transaction state clearly:
  - wallet confirmation needed
  - transaction submitted
  - waiting for confirmation
  - confirmed
  - failed/reverted
- separate product account identity from wallet authority
- visually distinguish:
  - off-chain metadata
  - backend-synced registry
  - on-chain source of truth

### Copy instructions

Use plain crypto explanations:

- “This action requires the client wallet.”
- “Funds are released only by the contract.”
- “The backend indexes activity but cannot move funds.”
- “Email is for notifications only.”
- “ERC-20 payments require approval before funding.”
- “ETH is still needed for gas.”

### Avoid

- casino/Web3 hype aesthetics
- rainbow token chaos
- “decentralized everything” language
- claims that DealLock guarantees quality
- hiding gas/token approval complexity
- implying the platform can reverse or override contract state
- making the UI look like a trading app

### Acceptance checklist

- A user can tell which wallet role they have.
- A user can tell where the funds are held.
- A user can tell what asset the agreement uses.
- A user can tell whether an action is on-chain or off-chain.
- A user can tell what the next transaction will do before signing.
- All crypto copy is accurate and not overpromising.

### Brief agent instruction

```txt
Use /crypto-frontend-design to make DealLock’s wallet, payment, transaction, and trust UX clearer. Emphasize smart-contract custody, wallet-authorized actions, ETH/ERC-20 clarity, chain transparency, and safe transaction-state copy. Do not add crypto hype or false security claims.
```

---

## 2. `/elegant`

### Purpose

Use this skill to make DealLock feel premium, restrained, and high-status.

This skill should remove clutter, improve hierarchy, and make the product feel expensive without making it complicated.

### Main goal

Make the UI feel like a polished financial product, not a student project.

### Apply this skill to

- landing page hero
- typography
- spacing
- card hierarchy
- dashboard layout
- CTAs
- empty states
- trust sections
- onboarding sections
- microcopy

### Design instructions

Prefer:

- fewer, stronger sections
- larger breathing room
- consistent spacing scale
- premium type hierarchy
- concise headlines
- soft borders
- subtle shadows
- calm accent colors
- one strong visual metaphor per section
- fewer cards, more intentional composition

Use high-value visual details:

- hairline borders
- small uppercase labels
- restrained gradient accents
- subtle background noise or radial glow
- consistent rounded corners
- controlled motion
- polished icon sizing

### Copy instructions

Use confident, minimal copy:

- “Make the deal. Lock the funds. Release on approval.”
- “Escrow without a platform middleman.”
- “A shared agreement state both sides can trust.”
- “Wallet-authorized payments. Transparent activity. No custody.”

### Avoid

- too many badges
- too many gradients
- too many cards in a row
- loud neon everywhere
- long explanatory paragraphs above the fold
- generic SaaS “feature grid” feeling
- random glass panels without purpose

### Acceptance checklist

- The page feels calmer after the change, not busier.
- The first screen has one clear headline, one clear visual, and one clear CTA.
- Spacing and alignment are consistent.
- Every section has a clear purpose.
- Important content is easier to scan.
- The interface feels more premium without sacrificing clarity.

### Brief agent instruction

```txt
Use /elegant to make DealLock feel premium and restrained. Improve spacing, typography, hierarchy, card polish, and copy sharpness. Remove clutter. Prefer calm confidence over visual noise.
```

---

## 3. `/enterprise`

### Purpose

Use this skill when improving trust, reliability, credibility, compliance-adjacent messaging, professional structure, and serious-user confidence.

This does not mean boring enterprise software. It means DealLock should feel reliable enough for real money and serious agreements.

### Main goal

Make users believe the product is operationally serious.

### Apply this skill to

- trust sections
- no-custody explanations
- dashboard status panels
- activity feed
- notification settings
- agreement overview
- error states
- security boundary copy
- production/beta disclaimers
- documentation-style UI sections

### Design instructions

Add credibility through clarity:

- show what is on-chain vs off-chain
- show what the platform can and cannot do
- show audit/activity trail
- show role-specific permissions
- show network and contract addresses
- show beta/testnet status honestly
- show clear recovery paths for errors

Good enterprise-feeling UI elements:

- status rows
- audit timeline
- compact trust strip
- permission matrix
- source-of-truth labels
- “What happens next” panels
- safe warning banners
- strong empty states
- explicit unavailable/backend degraded states

### Copy instructions

Use precise trust language:

- “Blockchain reads are the source of truth.”
- “Backend sync improves discovery and notifications only.”
- “The platform cannot release or refund funds.”
- “Only the client/provider wallet can perform role-specific actions.”
- “Factory contracts deploy agreements; they do not control them.”

### Avoid

- vague security claims
- fake compliance badges
- “military-grade security”
- legal guarantees
- heavy corporate language
- burying important state in small text
- making beta/testnet status look production-final

### Acceptance checklist

- Trust boundaries are explicit.
- User knows what DealLock controls and what it does not.
- Activity/history feels auditable.
- Error states tell the user what to do next.
- The app feels serious without becoming visually heavy.

### Brief agent instruction

```txt
Use /enterprise to improve DealLock’s credibility and trust structure. Make source-of-truth boundaries, wallet permissions, activity history, beta status, and operational states clear. Do not use fake security or legal claims.
```

---

## 4. `/frontend-accessibility-best-practices`

### Purpose

Use this skill for every meaningful frontend/design pass.

Animations, glass effects, dark UI, and futuristic visuals must still be accessible and usable.

### Main goal

Make DealLock usable by keyboard, screen reader, mobile, low-vision, and reduced-motion users.

### Apply this skill to

- all interactive components
- forms
- CTAs
- wallet/action buttons
- modals/dropdowns
- activity feed
- status pills
- onboarding/tutorial sections
- animated sections
- glassmorphism panels
- dark-mode color tokens

### Implementation instructions

Check:

- semantic HTML
- correct heading order
- keyboard navigation
- visible focus states
- button vs link semantics
- form labels
- error messages tied to fields
- sufficient color contrast
- reduced-motion support
- no motion-only meaning
- responsive layout
- tap target sizes
- text readability on glass backgrounds
- no hover-only critical actions

### Motion accessibility

For every animation:

- respect `prefers-reduced-motion`
- keep important text readable during animation
- avoid constant motion around primary CTAs
- avoid flashing or intense pulsing
- keep parallax subtle
- make reveal animations optional/progressive

### CSS guidance

Use tokens and utility classes:

- focus ring token
- high-contrast text tokens
- muted text tokens
- danger/warning/success tokens
- reduced-motion media query
- minimum target size for buttons

### Avoid

- low-contrast gray text
- important content hidden until animation completes
- icons without text labels where meaning matters
- clickable divs
- hover-only dropdowns
- unreadable glass blur
- motion that distracts from form completion
- tiny wallet/action buttons

### Acceptance checklist

- Main flows are keyboard usable.
- Focus states are visible.
- Reduced-motion users get a calm version.
- Status is not communicated by color alone.
- Text remains readable on all backgrounds.
- Mobile layout is not a compressed desktop page.
- `cd frontend && npm run build` passes.

### Brief agent instruction

```txt
Use /frontend-accessibility-best-practices on every visual change. Ensure semantic HTML, keyboard support, visible focus states, contrast, reduced-motion behavior, readable glass panels, responsive layout, and non-color-only status communication.
```

---

## 5. `/glassmorphism`

### Purpose

Use this skill only when glass effects support the product metaphor.

For DealLock, glassmorphism should feel like a transparent vault/control room — not random frosted cards.

### Main goal

Use glass to communicate transparency, locked funds, layered contract state, and premium depth.

### Apply this skill to

- hero product artifact
- smart-contract vault visual
- dashboard preview shell
- trust strip
- agreement cards
- floating status cards
- activity feed preview
- tutorial cards
- modal-like explanation panels

### Design instructions

Use glass sparingly:

- translucent dark panels
- subtle blur
- thin borders
- inner highlight
- soft shadow
- low-opacity gradient edge
- readable text layer
- visible separation from background

Recommended feel:

- “transparent but secure”
- “premium financial glass”
- “control room overlay”
- “vault interface”
- “audit-layer panels”

### CSS guidance

Use consistent classes/tokens:

```css
.glass-panel {
  background: rgba(255, 255, 255, 0.055);
  border: 1px solid rgba(255, 255, 255, 0.11);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(18px);
}
```

Always provide fallback:

```css
@supports not (backdrop-filter: blur(18px)) {
  .glass-panel {
    background: rgba(18, 24, 38, 0.96);
  }
}
```

### Avoid

- glass on top of busy backgrounds
- text directly on bright gradients
- too many translucent cards
- low-contrast text
- heavy blur on mobile if performance suffers
- glass used for every component
- random “futuristic” panels without product meaning

### Acceptance checklist

- Glass panels improve hierarchy.
- Text remains readable.
- The effect supports transparency/trust metaphor.
- Mobile performance remains acceptable.
- Reduced-motion and non-backdrop-filter fallbacks are safe.
- The page does not become visually noisy.

### Brief agent instruction

```txt
Use /glassmorphism carefully to create a transparent smart-contract vault/control-room feeling. Apply glass only to meaningful product artifacts and trust panels. Preserve readability, contrast, performance, and fallback styles.
```

---

## 6. `/modern-frontend-design`

### Purpose

Use this skill for major visual redesigns of the landing page, dashboard preview, product artifacts, and section flow.

### Main goal

Make DealLock feel like a modern high-performing startup landing page, not a basic dApp demo.

### Apply this skill to

- landing page structure
- hero section
- product mockup/dashboard preview
- scroll storytelling
- animated visual artifacts
- feature sections
- CTA sections
- responsive design
- reusable visual components

### Landing page direction

The landing page should focus less on “milestones” and more on the emotional/business problem:

> “How do two people make a deal online when neither side fully trusts the other?”

Then answer:

> “Lock funds in a smart contract, make progress visible, and release only when the agreed action happens.”

### Recommended section flow

1. **Hero**
   - headline about trust, money, and execution
   - product artifact showing locked funds and wallet-authorized action
   - primary CTA: create/open app
   - secondary CTA: see how it works

2. **Trust problem**
   - client risk: pays and gets bad/no work
   - provider risk: works and does not get paid
   - platform risk: middleman custody and fees

3. **Smart-contract vault**
   - money locked in contract
   - no platform custody
   - wallet-authorized release/refund/settlement

4. **Deal lifecycle**
   - agreement created
   - funds locked
   - proof submitted
   - approve/revise/dispute/settle

5. **Client/provider split**
   - show both sides’ incentives and protections

6. **Dashboard preview**
   - realistic interface artifact:
     - agreement header
     - escrow balance
     - active state
     - action panel
     - activity feed
     - payment asset chips

7. **Transparency/trust**
   - source-of-truth labels
   - indexed activity
   - no fees
   - no custody

8. **Beginner onboarding**
   - “New to escrow?”
   - “What is a wallet signature?”
   - “What does the platform control?”

9. **Final CTA**
   - concise, confident, action-oriented

### Animation direction

Use lightweight premium motion:

- scroll reveals
- floating agreement cards
- animated escrow lock glow
- milestone/trust rail path
- wallet signature pulse
- transaction confirmation shimmer
- proof card slide-in
- activity feed ticker
- subtle background gradients

Motion must support understanding, not distract.

### Avoid

- generic 3-card feature grid as the main experience
- random AI-looking gradients
- giant unsupported claims
- heavy animation libraries unless justified
- desktop-only layouts
- copy that assumes crypto knowledge
- making milestones the only core message

### Acceptance checklist

- Above the fold communicates the trust problem and smart-contract solution.
- Visuals look like real product artifacts.
- Motion improves comprehension.
- Page feels premium, startup-like, and easy to scan.
- Mobile layout remains strong.
- Build passes.

### Brief agent instruction

```txt
Use /modern-frontend-design to redesign DealLock like a premium modern startup landing page. Focus on trust resolution, smart-contract vault metaphor, realistic product artifacts, scroll storytelling, polished motion, and clear responsive hierarchy.
```

---

## 7. `/onboarding-optimization`

### Purpose

Use this skill to make DealLock understandable for first-time users, especially users who are not crypto-native.

### Main goal

Reduce confusion before a user ever connects a wallet.

### Apply this skill to

- landing page explanation sections
- tutorials
- empty states
- create agreement flow
- dashboard guidance
- role-specific action copy
- glossary/tooltips
- first-run onboarding
- notification/contact setup
- transaction explanations

### User questions to answer

Every beginner should quickly understand:

- What is DealLock?
- Why is it better than paying directly?
- Who holds the money?
- What is a smart contract?
- What does the platform control?
- What does the wallet control?
- What does the client do?
- What does the provider do?
- What happens if work is late?
- What happens if the client wants changes?
- What happens if there is a dispute?
- Why do I need ETH for gas?
- What is the difference between account, wallet, and email?

### UX instructions

Use progressive disclosure:

- short plain-English explanation first
- technical detail on expand
- tooltips for terms
- “What happens next?” panels
- role-based guides
- client/provider tabs
- beginner glossary
- contextual help beside action buttons
- empty states that guide action

### Tutorial ideas

Add or improve:

- “How DealLock works in 60 seconds”
- “For clients”
- “For providers”
- “Before you sign”
- “What happens after funding”
- “When to approve, request fixes, or dispute”
- “Wallet signatures vs transactions”
- “ETH vs USDC payments”

### Copy instructions

Use simple explanations:

- “Your DealLock account helps organize agreements. Your wallet controls contract actions.”
- “Email is only for notifications.”
- “Approving releases funds.”
- “Requesting fixes pauses auto-release until the provider responds or timeout escalation is available.”
- “Disputes keep funds locked until both sides agree on a split.”

### Avoid

- explaining everything at once
- crypto jargon without translation
- long documentation blocks on the landing page
- hiding important risk/role information
- making users connect a wallet before they understand the product
- assuming the user knows what escrow means

### Acceptance checklist

- A non-crypto user can explain the product after reading the landing page.
- Client and provider roles are clearly separated.
- The next action is always obvious.
- Empty states teach rather than just say “nothing here.”
- Technical terms have plain-English support.
- Tutorials do not interrupt advanced users.

### Brief agent instruction

```txt
Use /onboarding-optimization to make DealLock easy for first-time users. Add plain-English explanations, role guides, glossary/tooltips, what-happens-next panels, and progressive disclosure without overwhelming advanced users.
```

---

## 8. How To Combine Skills

When multiple skills are invoked, apply them in this priority order:

1. `/frontend-accessibility-best-practices`
2. `/crypto-frontend-design`
3. `/enterprise`
4. `/onboarding-optimization`
5. `/modern-frontend-design`
6. `/elegant`
7. `/glassmorphism`

This means:

- never sacrifice accessibility for visuals
- never sacrifice crypto correctness for marketing
- never sacrifice trust clarity for animation
- never sacrifice usability for style
- use glass and motion only when they support the product story

### Combined prompt for all skills

```txt
Read docs/frontend_skill_instructions.md first.

Use the sections matching the invoked skills as the source of truth. Also apply the Global DealLock Direction and How To Combine Skills priority order.

Improve DealLock’s frontend so it feels premium, futuristic, trust-first, intuitive, and easy to use. Focus on the core promise: resolving trust issues in digital deals by locking funds in a smart contract instead of a platform middleman.

Preserve all existing smart-contract, wallet, payment, backend, indexer, and auth behavior unless explicitly instructed otherwise. Do not add false claims about security, legality, custody, arbitration, tokens, or platform control.

After changes, summarize what changed and run:
cd frontend && npm run build
```

### Short prompt for a single skill

```txt
Read docs/frontend_skill_instructions.md. Apply only the section for /<skill-name>, plus the Global DealLock Direction and acceptance checklist. Keep DealLock accurate: smart-contract escrow, no platform custody, no platform fees, wallet authority only. Do not change product logic unless asked. Run cd frontend && npm run build.
```

### Short prompt for several skills

```txt
Read docs/frontend_skill_instructions.md. Apply the sections for these skills: /<skill-1>, /<skill-2>, /<skill-3>. Merge them using the priority order in “How To Combine Skills.” Preserve contract/payment/wallet/backend behavior. Improve visuals, clarity, trust, and usability. Run cd frontend && npm run build.
```

---

## 9. Final Acceptance Gate For Any Frontend Visual Round

Before considering the round complete, check:

- The product feels more trustworthy.
- The product feels more premium.
- The product is easier to understand.
- The UI clearly communicates no platform custody.
- The UI clearly communicates wallet-authorized actions.
- The interface is responsive.
- The interface is keyboard-accessible.
- The interface supports reduced motion.
- The page avoids fake security/legal claims.
- The page avoids generic crypto/dApp aesthetics.
- The frontend build passes.


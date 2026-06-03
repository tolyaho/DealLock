# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Scope: this file covers the **`frontend/` package only**. The monorepo-wide root
> `../CLAUDE.md` (contracts, backend, indexer, release gate) is loaded alongside it —
> don't duplicate that here.

## What this package actually is

A **standalone marketing landing page** — a single hero screen, not a dApp. Despite
what the root `README.md` says about wagmi/viem/TanStack/contract ABIs, **none of that
lives here anymore**. The full dApp frontend was removed; it survives read-only at
`../archive/frontend/` (not built). The only runtime deps are `react` and `react-dom`;
all web fonts load via the Google Fonts `<link>` in `index.html`. There is no router, no
data fetching, no wallet code.

`src/main.tsx` mounts the page inside `.dl-page`: `<SiteHeader/>` (the fixed header),
then `<Hero/>`, `<WorkflowStory/>`, `<SecuritySection/>`, `<FAQSection/>`, `<ParallaxLayers/>`.
All nav links are `href="#"`/in-page anchors and the "Launch App" button is non-functional
by design (this is the marketing landing, not the dApp).

## Commands

```bash
npm run dev       # vite dev server on :5173
npm run build     # tsc --noEmit (typecheck) THEN vite build — build fails on any TS error
npm run preview   # serve the production build from dist/
```

There are no tests, no linter, and no test runner in this package. `npm run build` is
the only gate — it typechecks before bundling, so a type error breaks the build.

## Architecture

Sections live in `src/components/landing/`:

- **`SiteHeader.tsx`** — the one fixed site header (`.site-header`), mounted in `main.tsx`
  above the hero (NOT inside it). Layout is `.site-header-inner`, a `1fr auto 1fr` grid on
  the shared page container (`--page-max-width` / `--page-padding-x`, which alias the
  `--dl-shell-*` tokens) so its edges line up with the hero/sections: `.deallock-wordmark`
  (left, Stardos Stencil), `.nav-rail` (center, IBM Plex Mono links), `.launch-button`
  (right). Two states: backgroundless at the top, and a liquid-glass pill once `scrollY > 32`
  adds `.nav-scrolled` (a rAF-throttled listener). The header is `pointer-events:none` with
  only its children interactive, so the empty grid gutters stay click-through. Overlap with
  content is handled by the hero/section `padding-top`/`scroll-margin-top` reserving
  `--header-height` (96px) — never by z-index. Center nav hides at ≤920px.
- **`Hero.tsx`** — lays out `<HeroBackground/>`, the left copy column (`.dl-hero-copy`), the
  right-column visual (`<VaultObject/>` inside `.dl-vault-wrap`), the progressive blur, and a
  scroll cue. The two-column layout is a CSS grid on `.dl-hero-v2__stage`. (The header is no
  longer here — it's `SiteHeader`.)
- **`VaultObject.tsx`** — the hand-authored SVG metallic "vault" sculpture that is the
  hero's right-column visual. All its gradient/filter IDs are namespaced through the
  `const ID = "vault"` prefix to avoid collisions.
- **`ContractOrb.tsx`** — an alternative silver-orb SVG visual. **Currently unused / not
  imported anywhere.** Its IDs are literal `orb-*` (not namespaced), so if you ever mount
  it alongside another SVG, check for ID clashes.
- **`HeroBackground.tsx`** — a pure-CSS "architectural wall": planes, hairline framing
  lines, an inset recess frame, ambient/vault light blooms, and a grain layer. It renders
  only `<div>`/`<span>` elements; all the visual work is in `styles.css`.

## Styling — the load-bearing system

There is **one stylesheet, `src/styles.css`** (no CSS modules, no Tailwind, no
styled-components). It is built on a design-token system you must work *within*:

- **Tokens are CSS custom properties scoped under `.dl-root`** (set on `<html class="dl-root">`
  in `index.html`). The scoping is deliberate — keeps tokens from leaking into third-party
  widgets. Use the existing `--dl-*` tokens (`--dl-ink`, `--dl-steel-*`, spacing, radii,
  shadow presets) instead of hardcoding values.
- **Fonts**: one typography system defined as tokens at the top of `styles.css`. Marketing
  uses 3 faces — `--font-logo` (Stardos Stencil, wordmark only), `--font-marketing-display`
  (Chakra Petch, hero headline + section titles), `--font-marketing-ui` (IBM Plex Mono, the
  **body/UI default** set on `body`: prose, nav, chips, labels, FAQ, security copy, code, and
  faux on-chain data). The app/dashboard system (not built here) is `--font-app-title`
  (Instrument Serif) + `--font-app-ui` (Inter). The legacy `--dl-display`/`--dl-mono`/`--dl-sans`
  names are kept as aliases of those tokens. **Reference a token — never hardcode a
  font-family.** All faces load via the Google Fonts `<link>` in `index.html`.
- **Aesthetic constraints are explicit in the comments and are intentional**: cold
  silver/steel/graphite palette only ("silver spectrum only, never pastel"); shadows are
  ink-tinted `rgba(17,19,21,…)`, **never** `rgba(0,0,0,…)`; semantic colors are muted and
  desaturated. Preserve this — don't introduce saturated colors or pure-black shadows.
- **Naming is BEM-ish with a `dl-` prefix**: `block__element--modifier`
  (e.g. `dl-wall-bg__plane--left`).

### Things that will bite you

- **Vault/frame positioning is driven by local custom props** on `.dl-hero-v2`:
  `--vault-frame-left/-top/-width/-height`. These position the background recess frame AND
  its framing lines together, and each breakpoint **redefines them** to move the vault. To
  reposition the hero visual, edit these vars per-breakpoint — not individual rules.
- **`--dl-mono` ends in a duplicated `monospace, monospace` keyword on purpose.** Removing
  the second `monospace` re-triggers WebKit's fixed-pitch font-size shrink, making Safari
  render body text smaller than Chrome. Leave it.
- **`.dl-hero-h1` is `white-space: nowrap`** with a hard `<br/>` in the markup. Longer
  headline copy can overflow on desktop; the mobile breakpoint only rescales font-size.
- **`.dl-vault-wrap` has a looping `dl-vault-float` animation**, disabled under
  `prefers-reduced-motion`.

### Responsive breakpoints (max-width, in `styles.css`)

- `960px` — stage collapses to a single column; vault reorders below the copy.
- `920px` — header center nav (`.nav-rail`) hides; wordmark + Launch App remain.
- `639px` — mobile: vault shrinks and reorders to the top (`order: 0`); wall tokens retuned;
  wordmark + Launch App shrink to compact sizes.

When changing the hero, verify all breakpoints plus reduced-motion — they each retune
layout and the wall background, so a change that looks right on desktop often needs a
matching tweak in the smaller queries.

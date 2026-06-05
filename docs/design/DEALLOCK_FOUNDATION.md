# DealLock Foundation

The design system the DealLock app is built on. This document is the **why**;
the **what** lives in code:

- Tokens — `frontend/src/styles/tokens.css` (single source of truth)
- Material + components — `frontend/src/styles/app.css`
- React primitives + shell — `frontend/src/components/app/` (barrel: `index.ts`)
- Live preview — `/app/design-lab` (`frontend/src/pages/app/DesignLabPage.tsx`)

Source of truth for the visual direction is the repo's `moodboard/` (20 refs).
This was read image-by-image; the distilled read is in `MOODBOARD_ANALYSIS.md`.

> One rule above all: **build screens from `components/app` + tokens. Never
> hardcode color / spacing / radius / shadow / timing, and never invent a one-off
> component.** If something is missing, add it to the foundation first.

---

## 1. Visual principles (extracted from the moodboard)

| Ref | What it teaches | How we apply it |
|---|---|---|
| `brand-key-icon-dark-3d-speckled` | A **dark graphite key**, matte-speckled, crisp specular rim. | Graphite (`--surface-primary`) is for the brand mark + the *one* primary action only — never a flat black fill. |
| `material-metallic-button-keycap` | Controls are **satin-aluminum keycaps**: rounded body, light catches the top, a pressable center. | Primary button = dark keycap w/ top light-catch; action-tile / avatar / switch-knob = brushed `--metal-disc`. |
| `material-brushed-metal-door` + `wall-panels` | **Anisotropic brushed grain** + **vertical panel seams** on real satin steel. | The canvas + shell use `--metal-wall` / `--metal-panel` with a diagonal specular sweep, brushed grain, and a dot texture — physical metal, not pale paper. |
| `component-toggle-rocker-metallic-glow` | On-states get a **soft warm under-glow** beneath a metal control. | `Switch.is-on` → sage `--glow-secure`. Physical, never neon. |
| `component-circular-status-pods` | Status is **circular**, monochrome, with a **single accent arc**. | One accent per state; progress/donuts (later) stay monochrome + one sage arc. |
| `component-bottom-nav-neumorphic` | Action bar = **recessed pill housing** + a raised keycap. | `BottomActionBar` = frosted pill; the primary keycap sits inside it. |
| `ref-dashboard-home` (Mercury) | **Calm, low density**, sectioned sidebar, big headline number, quick-action row, hairline dividers. | Shell = sectioned sidebar; pages = metric strip → quick actions → compact lists. |
| `ref-dashboard-table` (Squarespace) | **Tiny uppercase-mono column labels**, tall rows, status pills, filter tabs, dark export button. | `TableShell` + `SegmentedControl` + `StatusChip` exactly. |
| `ref-dashboard-settings` (ElevenLabs) | **Row = label/description · control**, grouped, soft-tint alert cards. | `.dl-setting` row pattern. |
| `ref-agreement-milestones` | Big value → metadata → titled sections (Milestones/Docs/Timeline) → sticky action bar. | The agreement-detail rhythm for the next phase. |
| `ref-landing-crypto-…-timeline` | Soft **top specular silver shine**, glass cards, mono addresses, green check nodes. | `--metal-shine` (shared with the landing's `--dl-shine`); mono for addresses/IDs. |

## 2. Final design direction

DealLock is a **precision escrow operating system**. Premium, minimal, satin
silver / brushed aluminum, glassy-but-restrained, Apple-like, contractual, calm,
machine-grade, trustworthy. White card "objects" rest on a lit satin-metal
surface, lit by one consistent studio key light from the top-left.

It is explicitly **not** generic SaaS, colorful crypto fintech, noisy
glassmorphism, a random Dribbble dashboard, or flat white cards on gray.

## 3. Typography roles (4 only — never drift)

Faces are inherited from the landing (`.dl-root`) so the product reads as one.

| Token | Face | Use |
|---|---|---|
| `--font-display` | Instrument Serif | **Rare** large expressive headings only (welcome hero, lab title). NOT page titles. |
| `--font-ui` | Inter | **Default** — body, buttons, nav, forms, table text, page titles, numbers. |
| `--font-mono` | IBM Plex Mono | Labels, IDs, contract addresses, metadata, tiny uppercase headings, system states. |
| `--font-brand` | Stardos Stencil | The DealLock wordmark only. |

Scale: `--text-2xs 11` · `xs 12` · `sm 13` · `base 14` (body) · `md 15` · `lg 17`
· `xl 20` · `2xl 24` (page title) · `3xl 30` · `display clamp(34–48)`.
Weights 400 / 500 / 600. Tabular numerals for all money/data.

## 4. Color system

Neutral graphite/silver does the work; **accents are sparse and semantic**, and
always pair with a dot/icon/text (never color alone).

- **Ink** — `--ink #20211d` / `--ink-soft` / `--ink-muted #74756e` (AA) / `--ink-faint`.
- **Sage `--accent-secure #4e7d5e`** — secure / active / released / confirm.
- **Champagne `--accent-review #b89b6a`** — review / pending / attention.
- **Lavender-silver `--accent-technical`** — rare technical/selected accent + focus ring.
- **Brick `--accent-danger`** — destructive actions only.
- Borders are ink-tinted hairlines (`--border-*`); **shadows are ink-tinted
  `rgba(24,24,20,…)`, never pure black**.

No blue, purple, neon, rainbow/iridescence, or heavy-green fintech wash.

## 5. Spacing system (strict)

`--space-1..11` = **4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80**. No
in-between values. Layout rhythm: page gap `--space-6` (24), page padding
`--page-pad-*`, content cap `--page-max 1200`.

Radii: `--radius-shell 28` · `panel 24` · `card 20` · `inner 16` · `control 12`
· `sm 8` · `pill ∞`.

## 6. Surface / card system (7 levels)

| Level | Token | Reads as |
|---|---|---|
| App canvas | `--surface-canvas` / `--metal-wall` | the deep brushed wall everything rests on |
| Metal panel | `--surface-metal` / `--metal-panel` | the lit satin shell |
| Base card | `--surface-card` | white plate, faint brushed catch, `--shadow-2` |
| Elevated card | `Card variant="raised"` | `--shadow-3` lift |
| Glass panel | `--surface-glass` | restrained blur — sticky/floating surfaces only |
| Action surface | `--surface-action` | satin control faces (secondary button, search) |
| Dark primary | `--surface-primary` | graphite keycap — one primary action per screen |

Elevation scale: `--shadow-1..4` + `--shadow-inset` + `--shadow-primary`. Every
plate gets a 1px top light-catch (`--edge-highlight*`) so it reads as satin.

## 7. Component rules

- The kit lives in `components/app` and is the **only** way to build screens.
  Primitives: `Button`, `IconButton`, `Card`, `MetricCard`, `StatusChip`,
  `SegmentedControl`, `SearchInput`, `ActionTile`, `TableShell`, `EmptyState`,
  `BottomActionBar`, `Avatar`, `Switch`. Shell: `AppShell`, `Sidebar`, `Topbar`,
  `WorkspaceSwitch`, `PageContainer`, `PageHeader`, `MetalSurface`.
- Every interactive primitive supports **default / hover / active / selected /
  disabled / loading (where relevant) / keyboard-focus**.
- **One primary action per screen** (dark keycap). Everything else is secondary
  (satin), positive (sage), ghost, or danger.
- **Accessibility is non-negotiable**: AA contrast, visible focus ring
  (`--accent-technical`), labelled icon-only buttons, real `<table>` semantics,
  44px touch targets, `prefers-reduced-motion` honored.
- Page anatomy: `PageContainer` → `PageHeader` (eyebrow/title/subtitle/actions)
  → metric strip → primary module / quick actions → compact secondary lists.
  Optional sticky `BottomActionBar` for commit-style flows.

## 8. Motion rules

- Micro-interactions **120–180ms**; transitions ≤ **240–320ms**.
- `--ease-out` to enter, `--ease-in` to exit, subtle `--ease-spring` for tactile
  press/lift. Animate `transform`/`opacity`/`box-shadow` only.
- Buttons/tiles lift on hover (`translateY(-1/-2px)`) and seat on press
  (`translateY(1px)`). Keep it physical, never bouncy.
- All motion collapses under `prefers-reduced-motion`.

## 9. What to avoid

- Saturated/neon/purple/rainbow color; iridescence; heavy green fintech.
- Pure-black shadows or borders; cheap mirror-chrome; visible scratches.
- Noisy glassmorphism (blur is for sticky/floating surfaces only, with purpose).
- Display serif used for routine UI; data-dense tables; generic SaaS chrome.
- Hardcoded values, one-off components, or styling outside the token system.

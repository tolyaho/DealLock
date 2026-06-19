# MOODBOARD_ANALYSIS.md

Visual-director read of `moodboard/` (20 refs) → the DealLock design system.
DealLock = a **precision escrow operating system**: silver, metallic, minimal,
contractual, calm, Apple-like, trustworthy, authored.

---

## 1. Visual traits extracted

**Material language (brand + material refs)**
- `brand-key-icon-dark-3d-speckled` → the brand motif is a **dark graphite key**, matte
  *speckled* finish with a crisp specular rim light. Graphite is for the mark + primary
  actions only — never a flat black fill.
- `material-chrome-keycap-liquid-metal` + `chrome-organic-sculpture` → **liquid-metal
  chrome** for the single hero object (the vault). Organic, mercury-soft reflections,
  gallery-grade presentation: one premium object on a calm light wall.
- `material-metallic-button-keycap-isometric` → controls are **satin-aluminum keycaps**:
  soft rounded-square body, light catches the top, a **circular pressable center**.
- `material-metallic-wall-panels` + `brushed-metal-door-intercom` → background is
  **brushed satin steel with vertical panel seams** and an **anisotropic (directional)
  swirled grain** — physical metal, not flat gray paper. No scratches, no cheap gloss.

**Controls (component refs)**
- `component-bottom-nav-neumorphic` → action bars = a **recessed pill housing** with a
  **raised metallic-rimmed primary keycap** in the center, flanked by ghost icon controls.
  One restrained bronze/champagne accent.
- `component-circular-status-pods` → status/progress is **circular**: calm white pods and
  **single-accent arc gauges** (one green arc). → milestone donut, progress rings.
- `component-toggle-rocker-metallic-glow` → active/on states get a **soft warm under-glow**
  beneath a metal control. Physical, precise, never neon.

**Layout (dashboard + agreement refs)**
- Calm, **low data density**, generous whitespace; thin hairline dividers.
- Narrow **icon rail** (matches our 76px) OR sectioned sidebar; **big headline number**.
- **Quick-action chip row** beneath the page header.
- Tables: **tiny uppercase mono column labels**, generous row height, **status pills**,
  underline **filter tabs**, a search + filter + sort row, a dark primary export button.
- Settings: **row = label/description (left) · control or status (right)**, grouped under
  section headings; soft-tint **alert cards**.
- Agreement detail rhythm: **big value number → metadata columns → stacked titled sections
  (Milestones / Documents / Timeline) → Notes side panel → sticky acceptance action bar**.

**Marketing (landing + nav refs)**
- **Centered glass nav pill** floating over a **fluid liquid-silver** background; nav stays
  translucent (only visibly glassy on scroll).
- **Bento glass cards**, varied sizes, a 3D object inside, one bronze accent, pill CTAs.
- **Vertical status timeline** with circular nodes + green checks; compliance/wallet cards
  with **mono addresses**. Soft top **specular shine** (already implemented as `--dl-shine`).

**Charts** — monochrome (graphite/silver bars), one accent arc, subtle gridlines, framed.

---

## 2. Design tokens to change / add

- **Spacing**: formalize a strict scale `--dash-s-1..` = 4 / 8 / 12 / 16 / 20 / 24 / 32 /
  40 / 48 / 64 / 80 and replace the ad-hoc inline `padding/margin/gap` values with it.
- **Card levels**: add `--dash-shadow-…` already exist; add an **inner top highlight** +
  **hover lift** convention, and 4 explicit levels (base / elevated / hero / action-bar).
- **Controls**: add a **keycap** treatment token set (top sheen + bottom seat + press
  translate) for the primary button; add an **under-glow** for active toggles.
- **Surface**: keep `--dash-bg/shell` brushed walls; add **vertical panel seams** to the
  shell; keep `--dl-shine`. Brushed grain already present (`::after`).
- **Accent discipline**: keep sage (`--dash-positive`) = secure/active, champagne
  (`--dash-champagne`) = review/pending, a *tiny* lavender-silver only for selected
  technical accents. No purple/neon/rainbow.
- **Type roles** (already tokenized) — enforce: logo = Stardos Stencil; display (Chakra
  Petch) for page titles only; Inter for all UI/body/tables/forms; IBM Plex Mono for IDs,
  uppercase labels, addresses, metadata.

## 3. Component patterns that should become reusable

`SectionCard` (+ `--interactive` hover-lift + `--hero` bloom variant) · `Button`
(keycap primary / satin secondary / ghost) · `StatusPill` + `MilestonePill` (sage /
champagne / neutral) · `Segmented` / `WorkspaceToggle` (gliding pill) · table
(`.dl-table` w/ mono head + tall rows) · `FilterBar` (search + tabs + sort) · settings
row (`.dl-setting-row`) · `MilestoneStepper` / timeline (circular nodes) · `EmptyState`
(object-like, not placeholder) · action bar (`.dl-actionbar`, frosted).

## 4. Pages needing the most work (priority order)

1. **Agreement Detail** — must be portfolio-quality (the contract control room).
2. **Provider / Client Home** — command-center stat cards + quick actions.
3. **Agreements list** — contractual table discipline.
4. **Statistics** — custom premium charts.
5. **Counterparties** — richer, less repetitive cards.
6. **Activity / Messages / Settings** — rhythm, empty states, alignment.
   Landing already shares one wall; verify Workflow/Security/FAQ continuity + shine.

## 5. What I will intentionally avoid

- Bright purple, neon blue, rainbow/iridescent crypto color (the earlier mistake).
- Generic SaaS chrome; literal copies of any reference; random glassmorphism.
- Heavy green fintech wash; loud gradients; pure-black shadows/borders.
- Cheap mirror-chrome, visible scratches, bouncy intro animation.
- Display font everywhere; data-dense tables; one-off CSS hacks / hardcoded values.

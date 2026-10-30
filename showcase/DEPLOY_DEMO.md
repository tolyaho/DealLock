# Deploying the DealLock showcase to Vercel

The deployed site is the **landing page + interactive `#demo`** only — a self-contained,
backend-free, wallet-free, deterministic simulation. No environment variables are
required. The wallet-auth pages and `/app` dashboard are gated off in production and
tree-shaken out of the build, so nothing backend-dependent is ever exposed.

## Vercel — Git import (recommended)

1. Push this repository to GitHub (a **separate** approval; see `VERCEL_GO_NO_GO.md`).
2. Vercel → **New Project** → import the repo.
3. **Root Directory → `frontend`** (this repo keeps the site under `frontend/`).
4. Framework preset: **Vite** (auto-detected). The committed `frontend/vercel.json` pins:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm ci`
   - SPA rewrite: every path → `/index.html` (so deep links / reloads don't 404).
5. **Environment variables: none required.** `DEMO_MODE` defaults ON for production
   builds. (Optional: `VITE_DEMO_ONLY=true` to be explicit; `VITE_REPO_URL=<repo>` to
   activate the Security section's "Explore repository" links once the repo is public.)
6. Deploy.

## Vercel — CLI (alternative)

Run from the **`frontend/`** directory (the project root Vercel builds), not the repo
root — do not double the `frontend/` prefix.

```bash
npm i -g vercel          # once
cd frontend
vercel                   # Preview deploy — UPLOADS code to Vercel. Needs approval.
vercel --prod            # Production deploy. Separate approval.
```

> `vercel`/`vercel deploy` uploads the code and creates a **Preview** (not offline).
> `vercel link` can create/link projects and must not be run without authorization.
> Keep Preview and Production as independent go/no-go decisions.

## Verify a deploy

- `/` loads the landing; hero "Try interactive demo" jumps to the live demo controls.
- Switch Client/Freelancer; run accept → fund → submit → approve/release + revision.
- Header shows **"Try demo"** (no Log in / Sign up).
- Direct-load any path (e.g. `/login`, `/app`) → redirects to `/` (no broken page).
- No network calls to a backend/auth/RPC; only static assets (+ optional Spline CDN).

## Demo mode

`src/demoMode.ts` → `DEMO_MODE`: defaults **ON** in production (`vite build`), **off** for
local `npm run dev`. Override with `VITE_DEMO_ONLY=true|false`. In demo mode the auth +
`/app` routes are removed from the router (and tree-shaken), and `AuthProvider` makes no
backend calls.

## Hero vault (Spline)

The hero vault is a Spline 3D scene with a **static JPG poster fallback**
(`src/assets/hero-vault-poster.jpg`): the poster holds the slot during load and remains
if the scene is blocked/slow, and under `prefers-reduced-motion` the poster renders alone
(no WebGL). A blocked Spline CDN never breaks the page or the demo.

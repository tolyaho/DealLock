# Deploying the DealLock showcase to Vercel

The deployed site is the **landing page + interactive `#demo`** only — a self-contained,
backend-free, wallet-free, deterministic simulation. No environment variables are
required, and no wallet / backend / chain code ships in the bundle.

The live site is served by the existing Vercel project **`deallock-demo`** from **this
`showcase/` directory**. Production is public; preview deployments and generated
deployment URLs stay access-protected (Vercel **Standard Protection**).

> Deploy from `showcase/` — **not** the repo's full-stack `frontend/`. The `frontend/`
> app carries the wallet/backend stack (and its older dependencies) and must never be
> published to this project.

## Vercel — CLI (current path)

Run from **this `showcase/` directory**:

```bash
npm i -g vercel            # once
cd showcase
vercel deploy             # Preview — protected; verify here first
vercel deploy --prod      # Production — public domain
```

`vercel.json` (committed here) pins the build so settings never drift:

- Framework: **Vite**
- Install: `npm ci`
- Build: `npm run build`
- Output: `dist`
- SPA rewrite: every path → `/index.html` (deep links / reloads don't 404)

The project is already linked (`deallock-demo`, team `jommo`). **Do not create a new
project** and do not change the production domain.

## Vercel — GitHub integration (optional)

To auto-deploy from `main` instead of the CLI, in the existing project's settings set
**Root Directory → `showcase/`** and connect the GitHub repo. Keep **Standard
Protection** so only the production domain is public. Never point the project at
`frontend/`.

## Verify a deploy

- `/` loads the landing; hero **"Try interactive demo"** jumps to the live demo controls.
- Switch Client / Freelancer; run accept → fund → submit → approve/release + the revision path.
- Header shows **"Try demo"** (no Log in / Sign up).
- Direct-load any unknown path (e.g. `/app`) → redirects to `/` (no broken page).
- No network calls to a backend / auth / RPC — only static assets (+ the optional Spline CDN).
- Production domain loads anonymously; a preview URL shows the Vercel auth gate.

## Demo build flag

`src/demoMode.ts` → `DEMO_MODE` defaults **ON** for production builds (`vite build`) and
off for local `npm run dev`. In this standalone showcase the wallet/auth/dashboard code
isn't present at all, so the deployed site is demo-only regardless; the flag only toggles
the header's single CTA. Override with `VITE_DEMO_ONLY=true|false` if needed.

## Hero vault (Spline)

The hero vault is a Spline 3D scene with a **static JPG poster fallback**
(`src/assets/hero-vault-poster.jpg`): the poster holds the slot during load and remains
if the scene is blocked or slow, and under `prefers-reduced-motion` the poster renders
alone (no WebGL). A blocked Spline CDN never breaks the page or the demo.

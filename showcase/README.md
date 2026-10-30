# DealLock — interactive escrow showcase

This directory is the **showcase website** for DealLock: a polished marketing landing
page plus an **interactive, browser-only demonstration** of the milestone-escrow
workflow that anyone can drive from either side of a deal.

It is deployed as plain static files (Vite + React) and is completely independent of
the protocol implementation in the rest of this repository — it has its own
`package.json` and installs/builds on its own.

## What this is — and is not

- ✅ A **deterministic, client-side simulation**. No account, no wallet, no backend,
  no blockchain RPC, no paid API, and **no real funds**. Every amount and transaction
  shown is **illustrative / simulated** and labelled as such in the UI.
- ✅ A static single-page app that deploys as plain files behind any static host.
- ❌ **Not** a deployed production protocol. The site does **not** custody money, does
  **not** connect to a live contract, and makes **no claim** of being audited, insured,
  or deployed to any mainnet or testnet.

The escrow logic shown in the **Security** section is real Solidity source from the
DealLock contract work (in the repository root); the contracts and their tests are a
**separate body of work** and their on-chain deployment status is not asserted here.

## The interactive demo

From the homepage, **Try interactive demo** (or the `#demo` anchor) opens an embedded
product window where you can:

- Switch between the **Client** and **Freelancer** perspectives.
- Walk the full flow: **accept → fund escrow → submit work → approve & release**, plus
  the **request-revision** path.
- Watch deterministic escrow math (a fixed **12,000 USDC** example split across three
  milestones) and honest state labels update at each step.
- Use **"Jump to the payment release"** to reach the key moment in one click.

The transitions mirror the implemented contracts exactly (Proposed → Accepted → Funded
→ Completed, with sequential, manually-approved, all-at-once-funded milestones and no
platform fees). Everything is wrapped in persistent **"Simulated · No real funds"** cues.

## Develop

```bash
npm ci
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build → dist/
npm run preview    # serve the production build locally
```

No environment variables are required. See [`.env.example`](./.env.example) for the
optional flags:

- `VITE_DEMO_ONLY` — defaults **on** for production builds (`vite build`), so only the
  landing page + interactive demo ship and the wallet-auth code is tree-shaken out.
- `VITE_REPO_URL` — overrides the Security section's "source" links (defaults to the
  public DealLock repository).

## Deploy

See [`DEPLOY_DEMO.md`](./DEPLOY_DEMO.md) for the exact static/Vercel deploy steps. The
build output in `dist/` is self-contained static files; `vercel.json` rewrites all
routes to `index.html` for the single-page app.

## License

Covered by the repository root [`LICENSE`](../LICENSE) — Business Source License 1.1
(changes to MIT on 2030-04-29). Not an open-source license today.

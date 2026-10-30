# DealLock

**Milestone-based escrow for client–freelancer work.** Funds are locked in a smart
contract and released milestone-by-milestone on the client's approval — with a review
window, revision requests, refunds on missed deadlines, and a mutual-settlement path for
disputes. No platform fee, no custodian, no middleman.

![DealLock interactive escrow demo](docs/assets/showcase-hero.png)

**[▶ Live demo](https://deallock-demo.vercel.app)** · **[Interactive showcase source](showcase/)** · **[Protocol & backend overview](docs/project-overview.md)**

> The live demo is an **access-protected preview** during review — a public launch is
> pending. It is a browser-only **simulation**: no wallet, no account, no real funds.

---

## Two surfaces

DealLock is two distinct things in one repository.

**1. Interactive showcase** — [`showcase/`](showcase/) is a frontend-only demonstration
of the escrow workflow. It is deterministic and client-side, with **no wallet, no
backend, no chain calls, and no real money** — every amount and event is clearly
labelled "Simulated". This is what the live demo serves, and it builds with nothing but
Node and a browser.

**2. Protocol implementation** — [`contracts/`](contracts/), [`backend/`](backend/), and
[`frontend/`](frontend/) are the actual engineering: Solidity escrow contracts with a
full Hardhat test suite, plus a testnet-oriented dApp and an Express/Prisma backend
prototype (wallet-signature auth, a contract-event indexer, notification emails). This is
where the real escrow logic lives.

The showcase mirrors the contracts' behaviour exactly but shares none of their runtime —
so you can explore the product without a wallet, and read the engineering without running
a node.

## What the contracts actually do

One Solidity contract represents one agreement between a client and a provider. It holds
the chosen payment asset in escrow and enforces, on-chain:

- **Agreement lifecycle** — proposed → accepted → funded → completed. The provider must
  accept before the client can fund.
- **Exact, all-at-once funding** — the client deposits the full agreement total; funds
  then release per milestone.
- **Sequential milestones** — a milestone can be submitted only once every earlier one is
  released. Approval is always manual; there is no automatic payout and no platform fee.
- **Review window** — submitted work can be approved, disputed, or (if the client does
  nothing) claimed by the provider after the review period expires.
- **Revisions & deadline grace** — the client can request changes instead of approving;
  late submissions are protected by a grace window, and the client can grant a deadline
  extension.
- **Refunds** — pending, unsubmitted work can be refunded once the deadline + grace window
  has passed.
- **Disputes & mutual settlement** — disputed funds stay locked until the counterparty
  accepts a proposed split.
- **Payment assets** — native ETH, or one fixed ERC-20 per agreement (e.g. USDC).
  Standard ERC-20 behaviour only.

There are six contract versions (V1–V6) and three factories; the version axis, ABI
switching, factory hierarchy, and deadline/dispute mechanics are documented in detail in
**[docs/project-overview.md](docs/project-overview.md)**.

## Architecture

- **Contracts** — Solidity 0.8.20 on Hardhat 3. New agreements deploy through
  `DealLockFactoryV3` (V6 multi-asset), with Factory V2 / legacy fallbacks. Factories
  deploy and index agreements only — they never hold funds, take fees, or control an
  agreement.
- **Backend** — Express 4 + Prisma 6 + PostgreSQL: wallet-signature sign-in, multi-wallet
  accounts, and a two-phase contract-event indexer (factory discovery + per-agreement
  lifecycle) guarded by a PostgreSQL advisory lock, with indexed notification emails.
  Blockchain reads remain the source of truth; email and activity are off-chain
  conveniences.
- **Frontend** — React 19 + Vite 6 + TypeScript; auto-detects the on-chain contract
  version and switches ABI accordingly.
- **Showcase** — the same React/Vite stack reduced to the landing page + demo, with the
  entire wallet/backend layer removed from the build.

## Tests & reproducibility

GitHub Actions runs on every push and pull request to `main`: **Contracts** (solhint +
Hardhat tests), **Backend** (PostgreSQL-backed), **Indexer integration** (against a live
Hardhat node), **Frontend** build, and a **Showcase** build + dependency audit. Locally:

```bash
npm test                               # all Hardhat contract/factory tests
npm run release:check                  # full local gate (contracts + backend + indexer + frontend build)
cd showcase && npm ci && npm run build # the deployed demo
```

`npm run release:check` needs a local PostgreSQL and starts a Hardhat node automatically.
These are local and CI checks — no figures in this repository are third-party audited.

## Security

- **Showcase** (`showcase/`) — five runtime dependencies (React, React DOM, React Router,
  and Spline for the 3D hero). `npm audit` reports **0 vulnerabilities**, and no
  wallet / backend / chain code is reachable in the shipped bundle.
- **Full application** (`frontend/`, `backend/`) — the full dApp carries the older wallet
  stack (wagmi / viem / TanStack Query) and has **not** been dependency-audited for this
  release. It is intended for local and testnet development, not public deployment; treat
  its security status separately from the showcase.

The contracts have **not** been externally audited. Do not deploy them to a mainnet or
custody real funds without an independent audit.

## License

**Business Source License 1.1** — see [`LICENSE`](LICENSE). The Licensed Work is **not**
open source today; it converts to the **MIT License on 2030-04-29**. Commercial use
before the change date requires a separate license from the licensor named in the file.

---

*DealLock is an independent portfolio project, not affiliated with any third party and
making no guarantees to any. The 3D scenes are the author's own Spline assets; all other
assets are original to this project.*

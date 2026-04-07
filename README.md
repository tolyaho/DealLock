# DealLock

**DealLock** is a milestone-based escrow smart contract for **structured digital freelance agreements** — websites, UI/UX, branding packages, and similar digital deliverables with staged handoffs.

The MVP demo runs on **Sepolia testnet**. No real ETH is involved.

---

## What Sepolia is used for

Sepolia is Ethereum's primary public testnet. It uses test ETH (no monetary value) and gives us a real blockchain environment with:

- public block explorer (Etherscan)
- real wallet signing (MetaMask)
- realistic transaction confirmation times (~12 s)
- permanent contract addresses that anyone can inspect

DealLock treats Sepolia as the **primary demo network**. Hardhat local is supported for development but the UI, docs, and defaults are Sepolia-first.

---

## Quick start

### 1. Install dependencies

```bash
# Root (Hardhat + Solidity)
npm install

# Frontend
cd frontend && npm install
```

### 2. Run tests (local Hardhat, no Sepolia needed)

```bash
npx hardhat test
```

### 3. Run the frontend

```bash
cd frontend
cp .env.example .env        # optional: set VITE_SEPOLIA_RPC_URL for a custom RPC
npm run dev
```

Open `http://localhost:5173` in a browser with MetaMask.

### 4. (Optional) Deploy from CLI to Sepolia

```bash
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY \
PRIVATE_KEY=0xYOUR_PRIVATE_KEY \
npx hardhat run scripts/deploy-sepolia.ts --network sepolia
```

The deploy script creates a sample 3-milestone agreement. Edit `scripts/deploy-sepolia.ts` to change parameters.

---

## Environment variables

### Root (Hardhat CLI deploys)

| Variable | Purpose |
|---|---|
| `SEPOLIA_RPC_URL` | Sepolia JSON-RPC endpoint (Alchemy, Infura, etc.) |
| `PRIVATE_KEY` | Deployer private key (hex, with `0x` prefix) |
| `PROVIDER_ADDRESS` | (optional) Provider address for the sample deploy script |

### Frontend (`frontend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `VITE_SEPOLIA_RPC_URL` | wagmi public default | Custom Sepolia RPC for higher reliability |
| `VITE_SEPOLIA_EXPLORER` | `https://sepolia.etherscan.io` | Explorer base URL for links |

Copy `frontend/.env.example` to `frontend/.env` and fill in values.

---

## How to connect MetaMask

1. Install the [MetaMask](https://metamask.io/) browser extension.
2. Open MetaMask → click the network dropdown → **Show test networks** (in Settings → Advanced if hidden).
3. Select **Sepolia**.
4. Your account address is now on Sepolia.

### How to get Sepolia ETH

Faucets (free test ETH):

- [Google Cloud Sepolia Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)
- [Alchemy Sepolia Faucet](https://www.alchemy.com/faucets/ethereum-sepolia)
- [Infura Sepolia Faucet](https://www.infura.io/faucet/sepolia)

Request 0.05–0.5 SepoliaETH; that is more than enough for many demo agreements.

---

## Two-wallet demo setup

To demo the full flow you need **two MetaMask accounts** (or two browser profiles):

| Role | What they do |
|---|---|
| **Client** (Account 1) | Creates / deploys the agreement, funds it, approves milestones, can refund expired ones |
| **Provider** (Account 2) | Accepts the agreement, submits delivery evidence per milestone |

Both accounts must be on **Sepolia** and hold some test ETH.

**Tip:** In MetaMask click your avatar → **Create account** to make a second account in the same wallet. Copy the second address to use as the provider when creating the agreement.

---

## End-to-end demo flow

### Create agreement (Client)

1. Open the app, connect as **Client** (Account 1) on Sepolia.
2. Click **Create New** tab.
3. Pick a service template (e.g. "Website Development").
4. Fill in:
   - Project title
   - Provider address (Account 2)
   - Milestone descriptions, amounts (small: 0.005–0.01 ETH each), deadlines
5. Click **Deploy agreement** → confirm in MetaMask.
6. Wait for confirmation; copy the contract address.

### Accept (Provider)

1. Switch MetaMask to **Account 2** (provider) on Sepolia.
2. Paste the contract address in **Load Existing** → **Load**.
3. The role badge should say **Provider**.
4. Click **Accept** → confirm in MetaMask.
5. Agreement state changes from Proposed → **Accepted**.

### Fund (Client)

1. Switch MetaMask back to **Account 1** (client).
2. Refresh contract state (the Refresh button).
3. Click **Fund (X ETH)** → confirm. Sends the exact total to the contract.
4. State → **Funded**. Milestone workflow is now active.

### Submit delivery evidence (Provider)

1. Switch to Account 2 (provider).
2. Refresh.
3. In the Submit section, enter milestone `0` and a delivery reference string (e.g. `https://github.com/you/repo/releases/tag/v0.1`).
4. Click **Submit** → confirm.
5. Milestone #0 moves to **Submitted**.

### Approve (Client)

1. Switch to Account 1 (client).
2. Refresh.
3. Click **Approve #0** → confirm.
4. Milestone #0 → **Released**; funds are sent to the provider.

### Refund path (Client, alternative)

If a milestone stays **Pending** past its deadline:

1. As client, click **Refund #N** (shown only when deadline has passed).
2. The milestone amount is returned to the client; milestone → **Refunded**.

### Completion

When all milestones are either Released or Refunded, the agreement state becomes **Completed**.

---

## How to interpret explorer links

Every transaction hash and address in the UI links to **Sepolia Etherscan**:

- **Contract address** → shows constructor args, balance, state, event logs.
- **Transaction hash** → shows sender, value, gas, status (success/revert), decoded logs.
- **Client / Provider address** → shows their balance and recent transactions.

If a transaction reverts, Etherscan shows the revert reason (e.g. "Only client", "Invalid agreement state").

---

## Sepolia demo flow (presentation cheat sheet)

```
1. Open app → connect Client wallet (Sepolia)
2. Create New → pick template → set provider → set milestones → Deploy
3. Copy contract address
4. Switch to Provider wallet → Load address → Accept
5. Switch to Client → Refresh → Fund
6. Switch to Provider → Refresh → Submit #0 (paste evidence link)
7. Switch to Client → Refresh → Approve #0
   → Milestone Released, funds sent to provider
8. Repeat submit/approve for remaining milestones
9. Agreement → Completed
10. Click any Etherscan link to show on-chain proof
```

---

## Tech stack

- **Solidity 0.8.20** — DealLock contract
- **Hardhat 3** — compile, test, Sepolia deploy
- **React + Vite + TypeScript** — frontend
- **wagmi / viem** — wallet and contract hooks
- **MetaMask** — signing

## MVP scope boundaries

**Included:** roles, sequential milestone escrow, delivery reference recording, release / refund, Sepolia explorer links, off-chain metadata (localStorage), service templates.

**Explicitly not included:** backend, database, OAuth, factory contract, marketplace, arbitration, reputation, ERC-20 tokens.

## Repository layout

```
fte4312/
├── hardhat.config.ts
├── scripts/
│   └── deploy-sepolia.ts
├── DealLock/
│   ├── contracts/DealLock.sol
│   ├── test/DealLock.ts
│   ├── docs/mvp.md
│   └── README.md          ← you are here
└── frontend/
    ├── .env.example
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── wagmi.ts
        ├── network.ts
        ├── contract.ts
        ├── bytecode.ts
        ├── types.ts
        ├── templates.ts
        ├── storage.ts
        └── components/
            ├── WalletPanel.tsx
            ├── CreateAgreementForm.tsx
            ├── AgreementOverview.tsx
            ├── AgreementContextSections.tsx
            ├── MilestoneList.tsx
            └── ActionPanel.tsx
```

# DealLock

DealLock is a client-only escrow dApp for milestone-based digital freelance agreements. One Solidity contract represents one agreement between a client and a provider, holds ETH in escrow, and enforces acceptance, exact funding, sequential milestone submission, approval, and expired-milestone refund.

The frontend runs in the browser with React, Vite, TypeScript, wagmi, and viem. Sepolia is the main demo network; Hardhat is used for local tests and optional local development.

## Features

- One deployed `DealLock.sol` contract per agreement.
- Client/provider role checks enforced on-chain.
- Sequential milestone workflow: proposed, accepted, funded, completed.
- Native ETH escrow with release or refund per milestone.
- Browser-only metadata for titles, templates, notes, and local agreement history.
- Sepolia Etherscan links for addresses and transactions.

## Tech Stack

- Solidity `0.8.20`
- Hardhat 3
- React 19, Vite 6, TypeScript
- wagmi, viem, TanStack Query
- MetaMask or another injected wallet

## Project Structure

```text
contracts/              DealLock smart contract
test/                   Hardhat test suite
scripts/                Sepolia deployment script
docs/                   MVP specification
frontend/               React/Vite dApp
report/                 Final report source and PDF
```

## Prerequisites

- Node.js 20+
- npm
- MetaMask for the browser demo
- Sepolia test ETH for live testnet transactions

## Install

From the repository root:

```bash
npm install
cd frontend
npm install
```

## Run Tests

From the repository root:

```bash
npm test
```

This runs the Hardhat test suite against a local in-memory chain. No Sepolia RPC or wallet private key is required.

## Run the Frontend

```bash
cd frontend
cp .env.example .env
npm run dev
```

Open:

```text
http://localhost:5173
```

Connect MetaMask and switch to Sepolia. The frontend can deploy a new agreement or load an existing DealLock contract address.

## Frontend Environment

`frontend/.env`:

```bash
VITE_SEPOLIA_RPC_URL=
VITE_SEPOLIA_EXPLORER=https://sepolia.etherscan.io
```

`VITE_SEPOLIA_RPC_URL` is optional. Set it to an Alchemy, Infura, or other Sepolia RPC URL for better reliability.

## Optional Sepolia CLI Deploy

From the repository root:

```bash
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY \
PRIVATE_KEY=0xYOUR_PRIVATE_KEY \
PROVIDER_ADDRESS=0xPROVIDER_ADDRESS \
npx hardhat run scripts/deploy-sepolia.ts --network sepolia
```

The deployer becomes the client. `PROVIDER_ADDRESS` is optional; if omitted, the script uses the deployer address as provider for a simple smoke test.

## Demo Flow

1. Open the frontend and connect the client wallet on Sepolia.
2. Create an agreement with provider address, milestone amounts, and deadlines.
3. Switch MetaMask to the provider wallet and load the contract address.
4. Provider accepts the agreement.
5. Switch back to the client wallet and fund the exact total.
6. Provider submits milestone evidence, such as a URL, commit hash, or IPFS CID.
7. Client approves the submitted milestone, releasing funds to the provider.
8. Repeat until all milestones are released, or refund expired pending milestones.

## Build

Frontend production build:

```bash
cd frontend
npm run build
```

Hardhat build:

```bash
npm run build
```

## Scope

DealLock is an MVP. It enforces payment flow, roles, milestone order, deadlines, and fund movement. It does not provide arbitration, a marketplace, a backend database, an indexer, ERC-20 payments, reputation, or subjective quality judgement.

## Report

The final project report is available at:

```text
report/report.pdf
```

# DealLock

**DealLock** is a milestone-based escrow smart contract for online service agreements.  
It is designed for situations where a client and a service provider want clear, enforceable payment rules without relying on a centralized platform.

The contract allows two parties to agree on a fixed set of milestones, lock funds in escrow, submit proof of delivery for each milestone, release payments upon approval, and refund unreleased amounts if a milestone expires without completion. In the MVP, milestones are handled **sequentially**, so the agreement follows a clear phase-by-phase workflow.

## Motivation

Online freelance and remote service agreements often suffer from a trust problem:

- the client does not want to pay everything upfront;
- the provider does not want to work without payment guarantees;
- milestone agreements are often informal and hard to enforce;
- delayed approval or inactivity can create disputes.

DealLock addresses this by making the agreement terms explicit, immutable after acceptance, and enforced on-chain.

## Main Features

- fixed client and provider roles;
- customizable milestone structure;
- explicit provider acceptance before activation;
- full escrow funding by the client;
- on-chain milestone tracking;
- proof submission via hash or IPFS reference;
- payment release after client approval;
- refund path for expired, unreleased milestones;
- **sequential milestone workflow**, so milestones are completed in order.

## MVP Scope

This project implements a focused MVP with the following rules:

- one client and one provider per contract;
- one agreement per deployed contract;
- milestones are fixed at deployment;
- provider must explicitly accept;
- client funds the contract in full with the exact agreed amount;
- milestones are processed sequentially;
- provider submits proof for a milestone;
- client approves a submitted milestone;
- approved milestone amount is released to the provider;
- expired, unreleased milestones can be refunded by the client in order.

Out of scope for the MVP:

- arbitration and dispute resolution;
- milestone editing after acceptance;
- multiple providers;
- ERC-20 token payments;
- platform fees;
- reputation systems.

See [mvp.md](./mvp.md) for the exact functional specification.

## Tech Stack

Planned stack:

- **Solidity** — smart contract implementation
- **Hardhat** — compilation, testing, local blockchain, deployment scripts
- **Ethers.js** — contract interaction
- **React + Vite** — lightweight frontend
- **MetaMask** — wallet connection for demo

## Repository Structure

```text
DealLock/
├── contracts/        # Solidity contracts
├── test/             # Hardhat tests
├── scripts/          # deployment / interaction scripts
├── frontend/         # React frontend
├── mvp.md            # MVP functional specification
└── README.md
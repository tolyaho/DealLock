# DealLock MVP Specification

## 1. Purpose

This document defines the exact MVP scope and behavior of **DealLock**, a milestone-based escrow smart contract for **structured digital freelance deliverables** (e.g. websites, UI/UX, branding packages, small frontends/MVPs)—not a generic “all online services” platform.

The goal of the MVP is to provide a clear, implementation-ready specification. The **on-chain** behavior is unchanged from the original escrow design; this document also records **product and dispute-boundary framing** so implementations do not overclaim what the contract enforces.

## 2. MVP Goal

The MVP should support a simple two-party workflow:

- a client deploys an agreement toward a specific provider (with milestone descriptions, amounts, and deadlines fixed at deploy time);
- the provider explicitly accepts the agreement;
- the client deposits the exact total payment into escrow;
- milestones are processed in sequence;
- the provider submits a **non-empty delivery reference** for the current milestone (on-chain field: `proof`—typically a URL, commit hash, content hash, IPFS CID, etc.);
- the client approves submissions (release of funds is the on-chain “approval”);
- approved milestone funds are released to the provider;
- expired, unreleased milestones can be refunded by the client in order.

The MVP is intentionally minimal. It does **not** resolve subjective quality disputes, revision counts, or scope creep—the contract enforces **workflow and escrow rules**, not “was the design good enough?” judgments.

### 2.1 Suitable service categories (product framing)

The reference frontend and documentation assume work that decomposes into **staged digital handoffs**, for example:

- Website or landing page development (structure → build → deploy)  
- UI/UX design (flows/wires → hi-fi → export / design system)  
- Branding / logo packages (concepts → refinement → final kit)  
- Simple MVP or frontend milestones defined clearly in milestone text  

### 2.2 Suitable evidence types (off-chain pointers)

The contract stores a **string reference** only. Suitable patterns include:

- Git repository, release, or commit links  
- Figma or design-tool links (with version where possible)  
- Hashes of ZIP/PDF exports (e.g. SHA-256)  
- Preview URLs, Loom or demo links  
- Shared drive folders (with access agreed off-chain)  
- IPFS CIDs  

### 2.3 Disputes the system structurally supports

- Enforcing **accept → fund → sequential milestones**  
- Recording **that** a reference was submitted and **when**  
- **Release** after client approval  
- **Refund** path for expired pending milestones (in order)  

### 2.4 Disputes not covered by the MVP

- Subjective design or UX quality  
- Code correctness, security, or hidden bugs after approval  
- Whether informal chat messages changed the scope  
- Aesthetic or brand “fit” without objective checklist in milestone text  
- Arbitration, reputation, or third-party judging  

### 2.5 Why this specialization matters

Positioning DealLock as **digital milestone escrow with delivery references** aligns user expectations with **on-chain capabilities**. Claiming coverage for “any online service” implies quality and scope enforcement the contract does not provide. A narrower framing makes the MVP **academically honest** and easier to evaluate against real freelance workflows.

## 3. Actors

### Client
The party purchasing the service.

Permissions:
- deploy the contract;
- fund the agreement;
- approve submitted milestones;
- refund expired pending milestones.

### Provider
The party delivering the service.

Permissions:
- accept the agreement;
- submit proof for milestones.

### Unauthorized User
Any address other than the client or provider.

Permissions:
- none.

## 4. High-Level Rules

- Each contract instance represents exactly **one agreement**.
- Each agreement has exactly **one client** and **one provider**.
- The milestone list is fixed at deployment.
- Agreement terms cannot be edited after deployment.
- The provider must explicitly accept before funding can occur.
- The client must fund the full total amount in one transaction.
- Funding must be for the **exact** agreed amount.
- Milestones are processed **sequentially**.
- Each milestone amount can only be released or refunded once.
- Large files are not stored on-chain; only proof references are stored.

## 5. Out of Scope

The MVP does **not** include:

- arbitration or dispute resolution (including automated “quality” rulings);
- partial milestone release;
- milestone revision after deployment;
- multiple providers or clients;
- ERC-20 token support;
- service fees;
- automatic approval logic;
- reputation systems;
- factory contracts for mass deployment;
- backend, database, or OAuth—any **off-chain** agreement metadata in the reference UI is **browser localStorage only**, for display and scenario context, not consensus.

### 5.1 Frontend-only metadata (non-normative)

The reference React app may store **per-contract-address** metadata locally (e.g. project title, service template id, evidence/acceptance guidance, per-milestone notes). This data is **not** part of the consensus layer and must not be relied on for security or legal proof; the canonical agreement terms for the chain are the **constructor parameters** and subsequent on-chain state.

## 6. Agreement State Model

The agreement should use the following states:

### `Proposed`
Initial state after deployment.  
The contract exists, but the provider has not accepted yet.

### `Accepted`
The provider has accepted the agreement, but the client has not funded it yet.

### `Funded`
The client has deposited the full payment into escrow.  
Milestone workflow is active.

### `Completed`
All milestone funds have been fully resolved, meaning every milestone has been either:
- released to the provider, or
- refunded to the client.

### `Cancelled`
Optional state for unused future extension.  
For the MVP, this state may exist in the enum but does not need active logic.

## 7. Milestone State Model

Each milestone should use the following states:

### `Pending`
The milestone exists but no proof has been submitted yet.

### `Submitted`
The provider has submitted proof for review.

### `Released`
The client approved the milestone and the milestone amount was paid to the provider.

### `Refunded`
The milestone amount was returned to the client after expiry.

For simplicity, the MVP does not need a separate `Approved` state if payment is released immediately during approval.

## 8. Data Model

### 8.1 Agreement-Level Data

The contract should store:

- `client` — address of the client
- `provider` — address of the provider
- `totalAmount` — total value of the agreement in wei
- `fundedAmount` — amount currently escrowed
- `agreementState` — current state of the agreement
- `releasedAmount` — total amount paid out to provider
- `refundedAmount` — total amount refunded to client
- `milestoneCount` — number of milestones

### 8.2 Milestone Data

Each milestone should store:

- `description` — short text description
- `amount` — payment amount in wei
- `deadline` — UNIX timestamp
- `proof` — string containing a delivery reference (URL, hash, CID, etc.); the reference UI calls this **submission / delivery evidence**
- `submittedAt` — timestamp of submission
- `state` — milestone state

## 9. Deployment Rules

The contract is deployed by the client.

### Constructor inputs
Suggested constructor inputs:

- provider address
- array of milestone descriptions
- array of milestone amounts
- array of milestone deadlines

### Deployment validation
The constructor must check:

- provider address is not zero;
- there is at least one milestone;
- descriptions, amounts, and deadlines arrays have equal length;
- every milestone amount is greater than zero;
- the sum of milestone amounts is greater than zero;
- the sum of milestone amounts becomes `totalAmount`.

Optional validation:
- deadlines should be in nondecreasing order;
- deadlines should be in the future at deployment.

## 10. Access Control Rules

### Only client can:
- fund the contract;
- approve a milestone;
- refund an expired milestone.

### Only provider can:
- accept the agreement;
- submit a milestone proof.

### No one else can:
- change state;
- release funds;
- submit proofs;
- trigger refunds.

## 11. Sequential Workflow Rules

The MVP enforces milestone ordering.

- milestone `0` is the first milestone;
- milestone `1` can move forward only after milestone `0` has been released;
- milestone `2` can move forward only after milestones `0` and `1` have been released;
- in general, milestone `i` can only be submitted or approved after all milestones with index `< i` have been released;
- refunds also proceed in order, meaning milestone `i` can only be refunded after all earlier milestones are already resolved.

A milestone is considered **resolved** if its state is either:
- `Released`, or
- `Refunded`.

This keeps the agreement phase-based and easy to reason about.

## 12. Function Specification

### 12.1 `acceptAgreement()`

**Caller:** Provider only.

**Preconditions:**
- agreement state must be `Proposed`.

**Effects:**
- agreement state becomes `Accepted`.

**Reverts if:**
- caller is not provider;
- agreement is not in `Proposed`.

---

### 12.2 `fundAgreement()`

**Caller:** Client only.

**Preconditions:**
- agreement state must be `Accepted`;
- `msg.value` must equal `totalAmount`.

**Effects:**
- escrow is funded;
- `fundedAmount` is updated;
- agreement state becomes `Funded`.

**Reverts if:**
- caller is not client;
- agreement is not `Accepted`;
- sent amount is incorrect;
- agreement has already been funded.

---

### 12.3 `submitMilestone(uint256 milestoneId, string calldata proof)`

**Caller:** Provider only.

**Preconditions:**
- agreement state must be `Funded`;
- `milestoneId` must be valid;
- milestone state must be `Pending`;
- proof string must not be empty;
- current time must be less than or equal to the milestone deadline;
- all previous milestones must already be `Released`.

**Effects:**
- milestone proof is stored;
- `submittedAt` is recorded;
- milestone state becomes `Submitted`.

**Reverts if:**
- caller is not provider;
- agreement is not funded;
- milestone ID is invalid;
- milestone is not pending;
- proof is empty;
- deadline has passed;
- a previous milestone has not been released.

---

### 12.4 `approveMilestone(uint256 milestoneId)`

**Caller:** Client only.

**Preconditions:**
- agreement state must be `Funded`;
- `milestoneId` must be valid;
- milestone state must be `Submitted`;
- the contract has enough balance;
- all previous milestones must already be `Released`.

**Effects:**
- milestone amount is transferred to provider;
- milestone state becomes `Released`;
- `releasedAmount` is increased;
- if all milestones are resolved, agreement state becomes `Completed`.

**Reverts if:**
- caller is not client;
- agreement is not funded;
- milestone ID is invalid;
- milestone is not submitted;
- a previous milestone has not been released;
- transfer fails.

---

### 12.5 `refundExpiredMilestone(uint256 milestoneId)`

**Caller:** Client only.

**Preconditions:**
- agreement state must be `Funded`;
- `milestoneId` must be valid;
- current time must be greater than the milestone deadline;
- milestone state must be `Pending`;
- all previous milestones must already be resolved.

**Effects:**
- milestone amount is transferred back to the client;
- milestone state becomes `Refunded`;
- `refundedAmount` is increased;
- if all milestones are resolved, agreement state becomes `Completed`.

**Reverts if:**
- caller is not client;
- agreement is not funded;
- milestone ID is invalid;
- deadline has not passed;
- milestone is not in the `Pending` state;
- a previous milestone is still unresolved;
- transfer fails.

## 13. Resolution Logic

A milestone is considered **resolved** if its state is either:
- `Released`, or
- `Refunded`.

The agreement is considered **completed** when all milestones are resolved.

## 14. Events

The contract should emit events for important actions.

Suggested events:

```solidity
event AgreementAccepted(address indexed provider);
event AgreementFunded(address indexed client, uint256 amount);
event MilestoneSubmitted(uint256 indexed milestoneId, string proof);
event MilestoneReleased(uint256 indexed milestoneId, uint256 amount);
event MilestoneRefunded(uint256 indexed milestoneId, uint256 amount);
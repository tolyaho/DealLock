# DealLock Round 8 — Factory Contract + On-Chain Agreement Registry

## Status

Planned.

## Goal

Add a canonical `DealLockFactory` contract so all new DealLock agreements are created through one known factory address per network. The factory deploys independent V4-compatible escrow contracts, records them in an on-chain registry, and emits `AgreementCreated` events that the backend indexer can watch for automatic discovery.

This fixes the current Round 7 limitation: the backend indexer only watches agreements already known to the backend `Agreement` table.

After Round 8:

```text
Frontend creates agreement through factory
→ factory emits AgreementCreated
→ backend indexes factory event
→ backend upserts Agreement registry entry
→ normal agreement indexer starts watching that agreement
```

The escrow model remains unchanged: each agreement is still its own contract, and the wallet roles inside that agreement remain the only source of on-chain authority.

---

## Product Decision

### Before Round 8

```text
CreateAgreementForm
  → walletClient.deployContract(DealLockV4 bytecode)
  → frontend/backend sync stores contract address
  → indexer watches only after backend learns the address
```

This works, but discovery is fragile. If frontend sync fails, the backend may never know the agreement exists.

### After Round 8

```text
CreateAgreementForm
  → factory.createAgreement(...)
  → factory deploys a V4-compatible agreement
  → factory emits AgreementCreated(...)
  → backend indexes factory logs
  → backend discovers all factory-created agreements automatically
```

The factory does **not** hold funds, approve work, release payments, refund clients, arbitrate disputes, collect fees, or upgrade agreements.

---

## In Scope

- New `contracts/DealLockFactory.sol`
- Factory-compatible V4 agreement deployment
- Factory deployment script
- Factory ABI + frontend config
- `CreateAgreementForm` deploys through factory by default
- Backend factory configuration per chain
- Event indexer watches `AgreementCreated` factory events
- Backend auto-discovers factory-created agreements
- Agreement registry marks creation source: `factory` or `direct`
- Activity feed includes agreement creation events
- Tests and docs

---

## Out of Scope

- No `DealLockV5`
- No changes to escrow business logic
- No platform fees
- No fee recipient
- No upgradeable proxy pattern
- No factory admin control over agreements
- No ERC-20 / USDC payments
- No AI arbitration
- No Google OAuth
- No reputation system
- No migration of old agreements into the factory

---

## Critical Contract Issue

`DealLockV4` currently sets the client as `msg.sender` in its constructor. If the factory calls `new DealLockV4(...)`, the factory becomes the client, which is wrong.

Recommended solution:

```text
Add contracts/DealLockV4FactoryCreated.sol
```

This contract should preserve V4 behavior but accept an explicit `_client` constructor argument:

```solidity
constructor(
    address _client,
    address _provider,
    string[] memory descriptions,
    uint256[] memory amounts,
    uint256[] memory deadlines,
    uint256 _reviewPeriod
)
```

Then the factory deploys:

```solidity
new DealLockV4FactoryCreated(
    msg.sender,
    provider,
    descriptions,
    amounts,
    deadlines,
    reviewPeriod
);
```

The deployed agreement must still behave as V4 and return `contractVersion() == 4`.

Direct `DealLockV4.sol` deployments should remain supported for legacy/dev fallback.

---

## Smart Contract Requirements

### New file

```text
contracts/DealLockFactory.sol
```

### Event

```solidity
event AgreementCreated(
    address indexed agreement,
    address indexed client,
    address indexed provider,
    uint256 chainId,
    uint256 contractVersion,
    uint256 milestoneCount,
    uint256 totalAmount,
    uint256 reviewPeriod,
    bytes32 metadataHash
);
```

Notes:

- `agreement`, `client`, and `provider` are indexed.
- `chainId` should be `block.chainid`.
- `contractVersion` should be `4`.
- `metadataHash` is optional correlation metadata.
- Do **not** put email addresses, private proof links, dispute reasons, or private project details in the event.

### Storage

Minimum registry:

```solidity
address[] private _agreements;
mapping(address => bool) public isDealLockAgreement;
mapping(address => address[]) private _agreementsByClient;
mapping(address => address[]) private _agreementsByProvider;
```

### Main write function

```solidity
function createAgreement(
    address provider,
    string[] calldata descriptions,
    uint256[] calldata amounts,
    uint256[] calldata deadlines,
    uint256 reviewPeriod,
    bytes32 metadataHash
) external returns (address agreement);
```

### Read helpers

```solidity
function factoryVersion() external pure returns (uint256); // returns 1
function agreementCount() external view returns (uint256);
function getAgreement(uint256 index) external view returns (address);
function getAgreements(uint256 offset, uint256 limit) external view returns (address[] memory);
function getClientAgreementCount(address client) external view returns (uint256);
function getProviderAgreementCount(address provider) external view returns (uint256);
function getClientAgreements(address client, uint256 offset, uint256 limit) external view returns (address[] memory);
function getProviderAgreements(address provider, uint256 offset, uint256 limit) external view returns (address[] memory);
```

### Validation

The factory should validate:

- provider is not zero address,
- provider is not `msg.sender`,
- milestone arrays are non-empty,
- milestone arrays have equal lengths,
- `msg.value == 0`.

The deployed agreement constructor should continue validating milestone amounts, deadlines, and review period.

### No admin powers

The factory must not have:

- owner-only upgrades,
- pause over agreements,
- admin withdrawal,
- fee recipient,
- arbitrary registry edits,
- any ability to move funds from deployed agreements.

The factory improves discovery, not authority.

---

## Contract Tests

Add:

```text
test/DealLockFactory.ts
```

Tests should cover:

1. Factory deploys successfully.
2. `factoryVersion()` returns expected value if implemented.
3. `createAgreement` deploys a V4-compatible agreement.
4. Created agreement has `client == caller`, not factory.
5. Created agreement has correct provider.
6. Created agreement has correct total amount and milestones.
7. Created agreement has correct review period.
8. `AgreementCreated` emits correct agreement, client, provider, chainId, version, milestone count, total amount, review period, metadata hash.
9. Factory records agreement in global registry.
10. Factory records agreement by client.
11. Factory records agreement by provider.
12. Pagination helpers work.
13. `isDealLockAgreement[agreement] == true`.
14. Cannot create with zero provider.
15. Cannot create with provider equal to client.
16. Cannot create with empty milestones.
17. Cannot create with mismatched milestone arrays.
18. Cannot send ETH to factory creation.
19. Deployed agreement workflow still works: provider accepts, client funds, provider submits, client approves.
20. Existing V1/V2/V3/V4 tests still pass.

---

## Deployment Scripts

Add:

```text
scripts/deploy-factory-sepolia.ts
```

The script should:

1. Deploy `DealLockFactory`.
2. Print factory address.
3. Print chain id.
4. Print Etherscan link.
5. Print env suggestions:

```text
VITE_DEALLOCK_FACTORY_SEPOLIA=0x...
FACTORY_CONTRACTS=11155111:0x...
```

Optional local script is allowed, but not required:

```text
scripts/deploy-factory-local.ts
```

---

## Backend Changes

### Prisma Schema

Add to `Agreement`:

```prisma
creationSource      String   @default("direct") // direct | factory
factoryAddress      String?
factoryTxHash       String?
factoryLogIndex     Int?
metadataHash        String?
```

If `createdByUserId` is required, make it nullable:

```prisma
createdByUserId String?
```

Reason: the indexer can discover a factory-created agreement before the client/provider has signed in.

Add:

```prisma
model FactoryContract {
  id                String   @id @default(cuid())
  chainId           Int
  address           String
  contractVersion   Int      @default(4)
  deploymentBlock   BigInt?
  lastIndexedBlock  BigInt?
  lastIndexedAt     DateTime?
  indexerStatus     String   @default("active")
  indexerError      String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([chainId, address])
  @@index([chainId, indexerStatus])
}
```

Factory creation events can be stored in existing `ChainEvent` using:

```text
eventName = "AgreementCreated"
contractAddress = factoryAddress
payloadJson.agreementAddress = created agreement address
```

### Environment Variables

Add one clear factory config format. Recommended:

```env
FACTORY_CONTRACTS=11155111:0xFactorySepolia,31337:0xFactoryLocal
FACTORY_INDEXER_ENABLED=true
```

### Indexer Changes

The Round 7 indexer should now have two phases:

```text
1. Index configured factory contracts for AgreementCreated events.
2. Index known agreement contracts for lifecycle events.
```

When `AgreementCreated` is indexed:

1. Decode event.
2. Upsert `Agreement`:
   - `contractAddress = agreement`
   - `chainId`
   - `clientAddress`
   - `providerAddress`
   - `contractVersion = 4`
   - `creationSource = "factory"`
   - `factoryAddress`
   - `factoryTxHash = txHash`
   - `factoryLogIndex = logIndex`
   - `metadataHash`
   - `deploymentTxHash = txHash`
   - `deploymentBlockNumber = blockNumber`
   - `indexingStartBlock = blockNumber`
   - `indexerStatus = "active"`
3. Insert `ChainEvent` for `AgreementCreated`.
4. Let the normal agreement indexer pick up this new agreement.

Indexing must be idempotent:

- same `(chainId, txHash, logIndex)` must not duplicate,
- agreement upsert must not overwrite user-edited metadata/contact emails,
- if an agreement already exists from frontend sync, merge factory metadata into it.

### API Changes

Add:

```text
GET /factory/contracts
```

It should return configured factory contracts and their current indexing status.

Extend:

```text
GET /health/indexer
```

Include factory indexer status, configured factory contracts, latest factory run, and factory errors.

### Backend Tests

Add tests for:

1. Factory env config parsing.
2. `AgreementCreated` event decoding.
3. Idempotent `ChainEvent` insert for factory event.
4. Agreement upsert from factory event.
5. Factory event does not overwrite existing agreement metadata/contact emails.
6. Factory-created agreement can be listed for a user whose linked wallet matches client/provider.
7. Activity endpoint includes `AgreementCreated`.
8. Indexed notification does not duplicate an app fallback email.

---

## Frontend Changes

### New file

Add:

```text
frontend/src/contractFactory.ts
```

Exports:

```ts
DEALLOCK_FACTORY_ABI
getFactoryAddress(chainId)
isFactoryConfigured(chainId)
```

Add env variables:

```env
VITE_DEALLOCK_FACTORY_SEPOLIA=0x...
VITE_DEALLOCK_FACTORY_HARDHAT=0x...
```

### CreateAgreementForm

Update deployment flow:

```text
If factory is configured for current chain:
  call factory.createAgreement(...)
  wait for receipt
  parse AgreementCreated event
  extract agreement address
  save/sync backend registry
else:
  production: disable creation with clear setup message
  development: allow explicit legacy direct V4 deployment fallback with warning
```

### Metadata Hash

The frontend may compute a safe metadata hash:

```ts
metadataHash = keccak256(toUtf8Bytes(canonicalJson))
```

Do not include emails, private proof links, private dispute text, or sensitive data in the hashed material. A zero hash is acceptable for the first implementation.

### Backend Sync

When frontend creates through factory, `saveAgreementToBackend` should include:

```ts
creationSource: "factory"
factoryAddress
factoryTxHash
factoryLogIndex
metadataHash
deploymentTxHash
deploymentBlockNumber
contractVersion: 4
```

### UI

Show a small indicator in the workspace/sidebar:

```text
Created via DealLock Factory
```

or:

```text
Direct legacy deployment
```

Activity feed should show:

```text
Agreement created through DealLock Factory
```

---

## Documentation Updates

Update `docs/state.md`:

1. Mention canonical factory and on-chain registry in the project overview.
2. Add `DealLockFactory` under Smart Contracts.
3. Clarify factory is not `DealLockV5`; V4 remains the default escrow version.
4. Add factory-backed discovery to backend/indexer section.
5. Add factory deployment/env vars.
6. Update file structure.
7. Remove `No factory contract` from scope limits.
8. Add `No platform fees` and `No upgradeable proxy system` to scope limits.
9. Add Round 8 summary.

Update `README.md`:

- How to deploy factory locally/Sepolia.
- Required frontend/backend env vars.
- How factory creation works.
- How backend auto-discovers agreements.
- How direct legacy deployments remain supported.
- Security statement: factory does not custody funds or control agreements.

---

## Acceptance Criteria

Round 8 is complete when:

1. `DealLockFactory` deploys V4-compatible agreement contracts.
2. Created agreement client is the wallet caller, not the factory.
3. Factory emits `AgreementCreated`.
4. Factory stores agreement registry on-chain.
5. Frontend creates new agreements through factory when configured.
6. Frontend extracts agreement address from factory event.
7. Backend indexes factory `AgreementCreated` events.
8. Backend auto-upserts factory-created agreements.
9. Round 7 agreement indexer starts indexing factory-discovered agreements.
10. Activity feed shows agreement creation event.
11. Old V1/V2/V3/V4 direct-deployed agreements remain supported.
12. No fees, admin agreement control, proxy upgradeability, or V5 contract is introduced.
13. Tests pass.
14. `docs/state.md` and `README.md` are updated.

---

## Security Notes

- Do not let the factory become the client of deployed agreements.
- Do not make the factory privileged over deployed agreements.
- Do not send or hold ETH in the factory.
- Do not store private metadata, emails, proof links, dispute reasons, or settlement notes in factory events.
- The factory improves discovery, not authority.
- The deployed agreement still holds funds and enforces escrow.
- Wallets still authorize all contract actions.

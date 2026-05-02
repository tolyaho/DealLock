/**
 * Indexer integration test — requires a running local Hardhat node + test PostgreSQL.
 *
 * Prerequisites:
 *   1. npx hardhat node                    (in a separate terminal)
 *   2. npm run db:test:reset               (resets/creates the test database)
 *   3. npm run test:indexer                (runs this file)
 *
 * Skipped automatically if HARDHAT_RPC_URL is unreachable or DATABASE_URL is missing.
 *
 * What this tests:
 *   - Factory V2 AgreementCreated event is indexed and creates Agreement rows.
 *   - Agreement rows have correct factory/payment metadata.
 *   - Re-running syncFactory is idempotent (no duplicate rows).
 *   - Agreement lifecycle events (fundAgreement) are indexed by syncAgreement.
 *   - ChainEvent rows are created with correct fields.
 *   - Re-running syncAgreement is idempotent.
 */
import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { createPublicClient, createWalletClient, http, parseEther, parseUnits, type PublicClient } from "viem";
import { hardhat as hardhatChain } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db.js";
import { syncFactory } from "./syncFactory.js";
import { syncAgreement } from "./syncAgreement.js";
import type { IndexerConfig } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_ROOT = resolve(__dirname, "../../../artifacts/contracts");

// Hardhat default private keys (well-known test accounts, never use in production).
const DEPLOYER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const PROVIDER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

const HARDHAT_RPC = process.env.HARDHAT_RPC_URL ?? "http://127.0.0.1:8545";
const CHAIN_ID = 31337;
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const CREATION_CODE_CHUNK_BYTES = 24_000;

function loadArtifact(relPath: string): { abi: readonly unknown[]; bytecode: `0x${string}` } {
  const fullPath = resolve(ARTIFACTS_ROOT, relPath);
  const raw = JSON.parse(readFileSync(fullPath, "utf-8")) as { abi: readonly unknown[]; bytecode: string };
  return { abi: raw.abi, bytecode: raw.bytecode as `0x${string}` };
}

function splitBytecode(bytecode: `0x${string}`): readonly [`0x${string}`, `0x${string}`] {
  const hex = bytecode.slice(2);
  const splitAt = CREATION_CODE_CHUNK_BYTES * 2;
  return [
    `0x${hex.slice(0, splitAt)}` as `0x${string}`,
    (hex.length > splitAt ? `0x${hex.slice(splitAt)}` : "0x") as `0x${string}`,
  ];
}

async function isHardhatReachable(): Promise<boolean> {
  try {
    const res = await fetch(HARDHAT_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
      signal: AbortSignal.timeout(2000),
    });
    const json = (await res.json()) as { result?: string };
    return json.result !== undefined;
  } catch {
    return false;
  }
}

async function isDatabaseReachable(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

function makeIndexerConfig(factoryAddress: string, factoryVersion: 1 | 2 | 3 = 2): IndexerConfig {
  const rpcUrls = new Map<number, string>();
  rpcUrls.set(CHAIN_ID, HARDHAT_RPC);
  return {
    enabled: true,
    pollMs: 5000,
    confirmations: 0n,
    blockBatchSize: 10000n,
    lookbackBlocks: 100000n,
    maxAgreementsPerTick: 25,
    logLevel: "silent",
    rpcUrls,
    factoryContracts: [{ chainId: CHAIN_ID, address: factoryAddress.toLowerCase(), factoryVersion }],
    factoryIndexerEnabled: true,
  };
}

// State shared across tests.
let factoryAddress = "";
let factoryV3Address = "";
let usdcAddress = "";
let ethAgreementAddress = "";
let usdcAgreementAddress = "";
let v6AgreementAddress = "";
let deployerAddress = "";

before(async () => {
  const reachable = await isHardhatReachable();
  if (!reachable) {
    console.warn("  [skip] Hardhat node not reachable — skipping indexer integration tests.");
    process.exit(0);
  }
  const dbReachable = await isDatabaseReachable();
  if (!dbReachable) {
    console.warn("  [skip] Test database not reachable — skipping indexer integration tests.");
    process.exit(0);
  }

  const deployer = privateKeyToAccount(DEPLOYER_KEY);
  const provider = privateKeyToAccount(PROVIDER_KEY);
  deployerAddress = deployer.address.toLowerCase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const publicClient = createPublicClient({ chain: hardhatChain, transport: http(HARDHAT_RPC) }) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walletClient = createWalletClient({ account: deployer, chain: hardhatChain, transport: http(HARDHAT_RPC) }) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providerWallet = createWalletClient({ account: provider, chain: hardhatChain, transport: http(HARDHAT_RPC) }) as any;

  // Deploy MockUSDC.
  const usdc = loadArtifact("mocks/MockUSDC.sol/MockUSDC.json");
  const usdcHash = await walletClient.deployContract({ abi: usdc.abi, bytecode: usdc.bytecode });
  const usdcReceipt = await publicClient.waitForTransactionReceipt({ hash: usdcHash });
  if (!usdcReceipt.contractAddress) throw new Error("MockUSDC deploy failed");
  usdcAddress = usdcReceipt.contractAddress.toLowerCase();

  // Deploy DealLockFactoryV2.
  const factoryArtifact = loadArtifact("DealLockFactoryV2.sol/DealLockFactoryV2.json");
  const factoryHash = await walletClient.deployContract({ abi: factoryArtifact.abi, bytecode: factoryArtifact.bytecode });
  const factoryReceipt = await publicClient.waitForTransactionReceipt({ hash: factoryHash });
  if (!factoryReceipt.contractAddress) throw new Error("DealLockFactoryV2 deploy failed");
  factoryAddress = factoryReceipt.contractAddress.toLowerCase();

  // Deploy DealLockFactoryV3 with its chunked V6 deployer.
  const v6AgreementArtifact = loadArtifact("DealLockMultiAssetV2.sol/DealLockMultiAssetV2.json");
  const v6DeployerArtifact = loadArtifact("DealLockMultiAssetV2Deployer.sol/DealLockMultiAssetV2Deployer.json");
  const v6DeployerHash = await walletClient.deployContract({
    abi: v6DeployerArtifact.abi,
    bytecode: v6DeployerArtifact.bytecode,
    args: splitBytecode(v6AgreementArtifact.bytecode),
  });
  const v6DeployerReceipt = await publicClient.waitForTransactionReceipt({ hash: v6DeployerHash });
  if (!v6DeployerReceipt.contractAddress) throw new Error("DealLockMultiAssetV2Deployer deploy failed");

  const factoryV3Artifact = loadArtifact("DealLockFactoryV3.sol/DealLockFactoryV3.json");
  const factoryV3Hash = await walletClient.deployContract({
    abi: factoryV3Artifact.abi,
    bytecode: factoryV3Artifact.bytecode,
    args: [v6DeployerReceipt.contractAddress],
  });
  const factoryV3Receipt = await publicClient.waitForTransactionReceipt({ hash: factoryV3Hash });
  if (!factoryV3Receipt.contractAddress) throw new Error("DealLockFactoryV3 deploy failed");
  factoryV3Address = factoryV3Receipt.contractAddress.toLowerCase();

  const now = BigInt(Math.floor(Date.now() / 1000));
  const deadline = now + 86400n * 30n; // 30 days from now

  // Create ETH agreement through Factory V2.
  const ethTx = await walletClient.writeContract({
    address: factoryAddress as `0x${string}`,
    abi: factoryArtifact.abi,
    functionName: "createAgreement",
    args: [provider.address, ZERO_ADDRESS, ["Integration test ETH milestone"], [parseEther("0.01")], [deadline], BigInt(3 * 24 * 60 * 60), ZERO_BYTES32],
  });
  const ethTxReceipt = await publicClient.waitForTransactionReceipt({ hash: ethTx });

  for (const log of ethTxReceipt.logs) {
    if (log.address.toLowerCase() !== factoryAddress) continue;
    try {
      const { decodeEventLog } = await import("viem");
      const decoded = decodeEventLog({ abi: factoryArtifact.abi, data: log.data, topics: log.topics });
      if (decoded.eventName === "AgreementCreated") {
        ethAgreementAddress = ((decoded.args as { agreement: string }).agreement).toLowerCase();
        break;
      }
    } catch { /* not AgreementCreated */ }
  }
  if (!ethAgreementAddress) throw new Error("ETH AgreementCreated event not found");

  // Mint USDC to deployer.
  await walletClient.writeContract({
    address: usdcAddress as `0x${string}`,
    abi: [{ name: "mint", type: "function", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" }] as const,
    functionName: "mint",
    args: [deployer.address, parseUnits("10000", 6)],
  });

  // Create USDC agreement through Factory V2.
  const usdcTx = await walletClient.writeContract({
    address: factoryAddress as `0x${string}`,
    abi: factoryArtifact.abi,
    functionName: "createAgreement",
    args: [provider.address, usdcAddress as `0x${string}`, ["Integration test USDC milestone"], [parseUnits("10", 6)], [deadline], BigInt(3 * 24 * 60 * 60), ZERO_BYTES32],
  });
  const usdcTxReceipt = await publicClient.waitForTransactionReceipt({ hash: usdcTx });

  for (const log of usdcTxReceipt.logs) {
    if (log.address.toLowerCase() !== factoryAddress) continue;
    try {
      const { decodeEventLog } = await import("viem");
      const decoded = decodeEventLog({ abi: factoryArtifact.abi, data: log.data, topics: log.topics });
      if (decoded.eventName === "AgreementCreated") {
        usdcAgreementAddress = ((decoded.args as { agreement: string }).agreement).toLowerCase();
        break;
      }
    } catch { /* not AgreementCreated */ }
  }
  if (!usdcAgreementAddress) throw new Error("USDC AgreementCreated event not found");

  // Create V6 ETH agreement through Factory V3.
  const v6Tx = await walletClient.writeContract({
    address: factoryV3Address as `0x${string}`,
    abi: factoryV3Artifact.abi,
    functionName: "createAgreement",
    args: [provider.address, ZERO_ADDRESS, ["Integration test V6 milestone"], [parseEther("0.02")], [deadline], BigInt(3 * 24 * 60 * 60), ZERO_BYTES32],
  });
  const v6TxReceipt = await publicClient.waitForTransactionReceipt({ hash: v6Tx });

  for (const log of v6TxReceipt.logs) {
    if (log.address.toLowerCase() !== factoryV3Address) continue;
    try {
      const { decodeEventLog } = await import("viem");
      const decoded = decodeEventLog({ abi: factoryV3Artifact.abi, data: log.data, topics: log.topics });
      if (decoded.eventName === "AgreementCreated") {
        v6AgreementAddress = ((decoded.args as { agreement: string }).agreement).toLowerCase();
        break;
      }
    } catch { /* not AgreementCreated */ }
  }
  if (!v6AgreementAddress) throw new Error("V6 AgreementCreated event not found");

  // Clean up any prior test data for these addresses.
  await db.chainEvent.deleteMany({ where: { chainId: CHAIN_ID, contractAddress: { in: [factoryAddress, factoryV3Address, ethAgreementAddress, usdcAgreementAddress, v6AgreementAddress] } } });
  await db.agreement.deleteMany({ where: { chainId: CHAIN_ID, contractAddress: { in: [ethAgreementAddress, usdcAgreementAddress, v6AgreementAddress] } } });
  await db.factoryContract.deleteMany({ where: { chainId: CHAIN_ID, address: { in: [factoryAddress, factoryV3Address] } } });

  // Store provider wallet for the funding test.
  (globalThis as unknown as Record<string, unknown>).__integrationProviderWallet = providerWallet;
  (globalThis as unknown as Record<string, unknown>).__integrationWalletClient = walletClient;
  (globalThis as unknown as Record<string, unknown>).__integrationPublicClient = publicClient;
  (globalThis as unknown as Record<string, unknown>).__integrationFactoryArtifact = factoryArtifact;
});

test("syncFactory creates V6 Agreement rows from Factory V3 events", async () => {
  const config = makeIndexerConfig(factoryV3Address, 3);
  const client = createPublicClient({ chain: hardhatChain, transport: http(HARDHAT_RPC) }) as unknown as PublicClient;
  const latestBlock = await client.getBlockNumber();

  const factory = config.factoryContracts[0]!;
  const result = await syncFactory({ factory, client, config, confirmedHead: latestBlock });
  assert.ok(result.eventsFound >= 1, `Expected at least 1 Factory V3 event, got ${result.eventsFound}`);

  const v6Row = await db.agreement.findUnique({ where: { chainId_contractAddress: { chainId: CHAIN_ID, contractAddress: v6AgreementAddress } } });
  assert.ok(v6Row, "V6 agreement row should exist");
  assert.equal(v6Row.creationSource, "factory");
  assert.equal(v6Row.factoryVersion, 3);
  assert.equal(v6Row.contractVersion, 6);
  assert.equal(v6Row.paymentAssetKind, "native");
  assert.equal(v6Row.paymentSymbol, "ETH");
});

test("syncAgreement indexes V6 deadline extension events", async () => {
  const config = makeIndexerConfig(factoryV3Address, 3);
  const client = createPublicClient({ chain: hardhatChain, transport: http(HARDHAT_RPC) }) as unknown as PublicClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providerWallet = (globalThis as any).__integrationProviderWallet;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walletClient = (globalThis as any).__integrationWalletClient;
  const AGREEMENT_V6_ABI = loadArtifact("DealLockMultiAssetV2.sol/DealLockMultiAssetV2.json").abi;

  await providerWallet.writeContract({
    address: v6AgreementAddress as `0x${string}`,
    abi: AGREEMENT_V6_ABI,
    functionName: "acceptAgreement",
    args: [],
  });

  const totalAmountRaw = await client.readContract({
    address: v6AgreementAddress as `0x${string}`,
    abi: AGREEMENT_V6_ABI,
    functionName: "totalAmount",
    args: [],
  }) as bigint;

  await walletClient.writeContract({
    address: v6AgreementAddress as `0x${string}`,
    abi: AGREEMENT_V6_ABI,
    functionName: "fundAgreement",
    args: [],
    value: totalAmountRaw,
  });

  const milestone = await client.readContract({
    address: v6AgreementAddress as `0x${string}`,
    abi: AGREEMENT_V6_ABI,
    functionName: "getMilestone",
    args: [0n],
  }) as readonly unknown[];
  const deadline = milestone[2] as bigint;

  await providerWallet.writeContract({
    address: v6AgreementAddress as `0x${string}`,
    abi: AGREEMENT_V6_ABI,
    functionName: "requestMilestoneDeadlineExtension",
    args: [0n, deadline + 3600n, "Indexer test extension"],
  });

  const latestBlock = await client.getBlockNumber();
  const v6Row = await db.agreement.findUnique({ where: { chainId_contractAddress: { chainId: CHAIN_ID, contractAddress: v6AgreementAddress } } });
  assert.ok(v6Row, "V6 agreement row must exist before syncAgreement");

  const result = await syncAgreement({ agreement: v6Row, client, config, confirmedHead: latestBlock });
  assert.ok(result.eventsFound >= 1, `Expected at least 1 V6 agreement event, got ${result.eventsFound}`);

  const event = await db.chainEvent.findFirst({
    where: {
      chainId: CHAIN_ID,
      contractAddress: v6AgreementAddress,
      eventName: "MilestoneDeadlineExtensionRequested",
    },
  });
  assert.ok(event, "MilestoneDeadlineExtensionRequested ChainEvent should exist");
  assert.equal(event.itemType, "milestone");
  assert.equal(event.itemId, 0);
  assert.equal(event.contractVersion, 6);
});

after(async () => {
  await db.$disconnect();
});

test("syncFactory creates Agreement rows from AgreementCreated events", async () => {
  const config = makeIndexerConfig(factoryAddress);
  const client = createPublicClient({ chain: hardhatChain, transport: http(HARDHAT_RPC) }) as unknown as PublicClient;
  const latestBlock = await client.getBlockNumber();

  const factory = config.factoryContracts[0]!;
  const result = await syncFactory({ factory, client, config, confirmedHead: latestBlock });

  assert.ok(result.eventsFound >= 2, `Expected at least 2 factory events, got ${result.eventsFound}`);

  const ethRow = await db.agreement.findUnique({ where: { chainId_contractAddress: { chainId: CHAIN_ID, contractAddress: ethAgreementAddress } } });
  assert.ok(ethRow, "ETH agreement row should exist");
  assert.equal(ethRow.creationSource, "factory");
  assert.equal(ethRow.factoryVersion, 2);
  assert.equal(ethRow.contractVersion, 5);
  assert.equal(ethRow.paymentAssetKind, "native");
  assert.equal(ethRow.paymentTokenAddress, null);
  assert.equal(ethRow.paymentSymbol, "ETH");

  const usdcRow = await db.agreement.findUnique({ where: { chainId_contractAddress: { chainId: CHAIN_ID, contractAddress: usdcAgreementAddress } } });
  assert.ok(usdcRow, "USDC agreement row should exist");
  assert.equal(usdcRow.creationSource, "factory");
  assert.equal(usdcRow.factoryVersion, 2);
  assert.equal(usdcRow.contractVersion, 5);
  assert.equal(usdcRow.paymentAssetKind, "erc20");
  assert.equal(usdcRow.paymentTokenAddress, usdcAddress);
});

test("syncFactory is idempotent — second run does not create duplicate rows", async () => {
  const config = makeIndexerConfig(factoryAddress);
  const client = createPublicClient({ chain: hardhatChain, transport: http(HARDHAT_RPC) }) as unknown as PublicClient;
  const latestBlock = await client.getBlockNumber();

  const factory = config.factoryContracts[0]!;
  const beforeCount = await db.chainEvent.count({ where: { chainId: CHAIN_ID, contractAddress: factoryAddress } });
  await syncFactory({ factory, client, config, confirmedHead: latestBlock });
  const afterCount = await db.chainEvent.count({ where: { chainId: CHAIN_ID, contractAddress: factoryAddress } });

  assert.equal(afterCount, beforeCount, "Second syncFactory run should not add new ChainEvent rows");
});

test("syncAgreement indexes AgreementFunded event after client funds", async () => {
  const config = makeIndexerConfig(factoryAddress);
  const client = createPublicClient({ chain: hardhatChain, transport: http(HARDHAT_RPC) }) as unknown as PublicClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providerWallet = (globalThis as any).__integrationProviderWallet;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walletClient = (globalThis as any).__integrationWalletClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const factoryArtifact = (globalThis as any).__integrationFactoryArtifact;
  const AGREEMENT_ABI = loadArtifact("DealLockMultiAsset.sol/DealLockMultiAsset.json").abi;

  // Provider accepts.
  await providerWallet.writeContract({
    address: ethAgreementAddress as `0x${string}`,
    abi: AGREEMENT_ABI,
    functionName: "acceptAgreement",
    args: [],
  });

  // Read totalAmount.
  const totalAmountRaw = await client.readContract({
    address: ethAgreementAddress as `0x${string}`,
    abi: AGREEMENT_ABI,
    functionName: "totalAmount",
    args: [],
  }) as bigint;

  // Client funds the ETH agreement.
  await walletClient.writeContract({
    address: ethAgreementAddress as `0x${string}`,
    abi: AGREEMENT_ABI,
    functionName: "fundAgreement",
    args: [],
    value: totalAmountRaw,
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void factoryArtifact; // silence unused warning

  const latestBlock = await client.getBlockNumber();
  const ethRow = await db.agreement.findUnique({ where: { chainId_contractAddress: { chainId: CHAIN_ID, contractAddress: ethAgreementAddress } } });
  assert.ok(ethRow, "ETH agreement row must exist before syncAgreement");

  const result = await syncAgreement({ agreement: ethRow, client, config, confirmedHead: latestBlock });
  assert.ok(result.eventsFound >= 1, `Expected at least 1 agreement event, got ${result.eventsFound}`);

  const events = await db.chainEvent.findMany({ where: { chainId: CHAIN_ID, contractAddress: ethAgreementAddress } });
  const funded = events.find((e) => e.eventName === "AgreementFunded");
  assert.ok(funded, "AgreementFunded ChainEvent should exist");
  assert.equal(funded.actorAddress, deployerAddress);
  assert.equal(funded.paymentSymbol, "ETH");
  assert.ok(BigInt(funded.amountRaw ?? "0") > 0n, "amountRaw should be > 0");
});

test("syncAgreement is idempotent — second run does not add duplicate events", async () => {
  const config = makeIndexerConfig(factoryAddress);
  const client = createPublicClient({ chain: hardhatChain, transport: http(HARDHAT_RPC) }) as unknown as PublicClient;
  const latestBlock = await client.getBlockNumber();

  const ethRow = await db.agreement.findUnique({ where: { chainId_contractAddress: { chainId: CHAIN_ID, contractAddress: ethAgreementAddress } } });
  assert.ok(ethRow);

  const beforeCount = await db.chainEvent.count({ where: { chainId: CHAIN_ID, contractAddress: ethAgreementAddress } });
  await syncAgreement({ agreement: ethRow, client, config, confirmedHead: latestBlock });
  const afterCount = await db.chainEvent.count({ where: { chainId: CHAIN_ID, contractAddress: ethAgreementAddress } });

  assert.equal(afterCount, beforeCount, "Second syncAgreement run should not add new ChainEvent rows");
});

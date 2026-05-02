/**
 * bootstrap-local-rc.ts
 *
 * Deploys MockUSDC plus DealLockFactoryV2 and DealLockFactoryV3 to a running local Hardhat node,
 * writes Vite and backend env files with the deployed addresses, mints
 * test USDC to the first two accounts, and prints next steps.
 *
 * Run:
 *   npx hardhat run scripts/bootstrap-local-rc.ts --network localhost
 */
import hre from "hardhat";
import fs from "fs";
import path from "path";

// Amount of MockUSDC to mint per wallet (10_000 USDC, 6 decimals).
const MINT_USDC_AMOUNT = 10_000n * 10n ** 6n;
const CREATION_CODE_CHUNK_BYTES = 24_000;

// Keys we write / update in the frontend .env.local.
const FRONTEND_ENV_KEYS = [
  "VITE_DEALLOCK_FACTORY_V2_HARDHAT",
  "VITE_DEALLOCK_FACTORY_V3_HARDHAT",
  "VITE_USDC_HARDHAT_ADDRESS",
];

// Keys we write / update in the backend .env.local.
const BACKEND_ENV_KEYS = [
  "FACTORY_V2_CONTRACTS",
  "FACTORY_V3_CONTRACTS",
  "FACTORY_INDEXER_ENABLED",
  "INDEXER_ENABLED",
  "USDC_HARDHAT_ADDRESS",
  "HARDHAT_RPC_URL",
];

function splitBytecode(bytecode: string): readonly [string, string] {
  const hex = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
  const splitAt = CREATION_CODE_CHUNK_BYTES * 2;
  return [`0x${hex.slice(0, splitAt)}`, hex.length > splitAt ? `0x${hex.slice(splitAt)}` : "0x"];
}

function parseEnvFile(filePath: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(filePath)) return map;
  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    map.set(key, value);
  }
  return map;
}

function writeEnvFile(filePath: string, existing: Map<string, string>, updates: Record<string, string>): void {
  for (const [key, value] of Object.entries(updates)) {
    existing.set(key, value);
  }
  const lines: string[] = [];
  for (const [key, value] of existing) {
    lines.push(`${key}=${value}`);
  }
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf-8");
}

async function main(): Promise<void> {
  const connection = await hre.network.create();
  const { ethers } = connection;

  console.log(`\n=== DealLock Local RC Bootstrap ===\n`);
  console.log(`Network: ${connection.networkName}`);

  const signers = await ethers.getSigners();
  const deployer = signers[0]!;
  const client = signers[0]!;
  const provider = signers[1]!;

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Client (account 0): ${client.address}`);
  console.log(`Provider (account 1): ${provider?.address ?? "(only one signer)"}`);
  console.log();

  // --- Deploy MockUSDC ---
  console.log("Deploying MockUSDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUsdc = await MockUSDC.deploy();
  await mockUsdc.waitForDeployment();
  const usdcAddress = await mockUsdc.getAddress();
  console.log(`  MockUSDC deployed: ${usdcAddress}`);

  // --- Deploy DealLockFactoryV2 ---
  console.log("Deploying DealLockFactoryV2...");
  const Factory = await ethers.getContractFactory("DealLockFactoryV2");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  console.log(`  DealLockFactoryV2 deployed: ${factoryAddress}`);
  console.log(`  Chain ID: ${chainId}`);

  // --- Deploy DealLockFactoryV3 ---
  console.log("Deploying DealLockFactoryV3...");
  const V6Agreement = await ethers.getContractFactory("DealLockMultiAssetV2");
  const V6Deployer = await ethers.getContractFactory("DealLockMultiAssetV2Deployer");
  const v6Deployer = await V6Deployer.deploy(...splitBytecode(V6Agreement.bytecode));
  await v6Deployer.waitForDeployment();
  const v6DeployerAddress = await v6Deployer.getAddress();

  const FactoryV3 = await ethers.getContractFactory("DealLockFactoryV3");
  const factoryV3 = await FactoryV3.deploy(v6DeployerAddress);
  await factoryV3.waitForDeployment();
  const factoryV3Address = await factoryV3.getAddress();
  console.log(`  DealLockMultiAssetV2Deployer deployed: ${v6DeployerAddress}`);
  console.log(`  DealLockFactoryV3 deployed: ${factoryV3Address}`);

  // --- Mint MockUSDC ---
  console.log("\nMinting test USDC...");
  const mintTargets: { address: string; label: string }[] = [
    { address: client.address, label: "account 0 (client)" },
  ];
  if (provider) {
    mintTargets.push({ address: provider.address, label: "account 1 (provider)" });
  }
  for (const target of mintTargets) {
    await mockUsdc.mint(target.address, MINT_USDC_AMOUNT);
    console.log(`  Minted 10,000 USDC to ${target.address} (${target.label})`);
  }

  // --- Write frontend/.env.local ---
  const frontendEnvPath = path.resolve(process.cwd(), "frontend/.env.local");
  const frontendEnv = parseEnvFile(frontendEnvPath);
  const frontendUpdates: Record<string, string> = {
    VITE_DEALLOCK_FACTORY_V2_HARDHAT: factoryAddress,
    VITE_DEALLOCK_FACTORY_V3_HARDHAT: factoryV3Address,
    VITE_USDC_HARDHAT_ADDRESS: usdcAddress,
  };
  writeEnvFile(frontendEnvPath, frontendEnv, frontendUpdates);
  console.log(`\nWrote frontend/.env.local (updated ${FRONTEND_ENV_KEYS.join(", ")})`);

  // --- Write backend/.env.local ---
  const backendEnvPath = path.resolve(process.cwd(), "backend/.env.local");
  const backendEnv = parseEnvFile(backendEnvPath);
  const backendUpdates: Record<string, string> = {
    FACTORY_V2_CONTRACTS: `${chainId}:${factoryAddress}`,
    FACTORY_V3_CONTRACTS: `${chainId}:${factoryV3Address}`,
    FACTORY_INDEXER_ENABLED: "true",
    INDEXER_ENABLED: "true",
    USDC_HARDHAT_ADDRESS: usdcAddress,
    HARDHAT_RPC_URL: "http://127.0.0.1:8545",
  };
  writeEnvFile(backendEnvPath, backendEnv, backendUpdates);
  console.log(`Wrote backend/.env.local (updated ${BACKEND_ENV_KEYS.join(", ")})`);
  console.log(`  backend/.env.local is auto-loaded by npm run dev and npm run indexer.`);

  // --- Summary ---
  console.log(`
┌─────────────────────────────────────────────────────────┐
│  Bootstrap complete                                     │
│                                                         │
│  MockUSDC:          ${usdcAddress.padEnd(43)}│
│  DealLockFactoryV2: ${factoryAddress.padEnd(43)}│
│  DealLockFactoryV3: ${factoryV3Address.padEnd(43)}│
│  Chain ID:          ${String(chainId).padEnd(43)}│
└─────────────────────────────────────────────────────────┘

Next steps:
  1. cd backend && cp .env.example .env
  2. Edit backend/.env for DATABASE_URL, SESSION_SECRET, FRONTEND_ORIGIN, and APP_URL
  3. cd backend && npm run db:migrate && npm run dev
  4. cd frontend && npm run dev
  5. Open http://localhost:5173 — connect with account 0 (${client.address})
  6. Create an ETH agreement or a USDC agreement (Factory V3 is preferred)
  7. Run indexer: cd backend && npm run indexer
  8. See activity: GET http://localhost:4000/agreements/<addr>/activity
`);

  await connection.close();
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  if (
    (message.includes("Failed to make POST request") ||
      message.includes("Cannot connect to the network") ||
      message.includes("Connection to http://localhost:8545 was refused")) &&
    (message.includes("localhost") || message.includes("8545"))
  ) {
    console.error("Local Hardhat RPC is not reachable. Start it first with `npm run rc:hardhat`, then rerun `npm run rc:bootstrap`.");
  }
  console.error(err);
  process.exitCode = 1;
});

import hre from "hardhat";

const CREATION_CODE_CHUNK_BYTES = 24_000;

function splitBytecode(bytecode: string): readonly [string, string] {
  const hex = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
  const splitAt = CREATION_CODE_CHUNK_BYTES * 2;
  return [`0x${hex.slice(0, splitAt)}`, hex.length > splitAt ? `0x${hex.slice(splitAt)}` : "0x"];
}

async function main() {
  const connection = await hre.network.create();
  const { ethers } = connection;

  console.log(`Deploying DealLockFactoryV3 to ${connection.networkName}...`);

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No signer — check PRIVATE_KEY env var");
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  const Agreement = await ethers.getContractFactory("DealLockMultiAssetV2");
  const Deployer = await ethers.getContractFactory("DealLockMultiAssetV2Deployer");
  const agreementDeployer = await Deployer.deploy(...splitBytecode(Agreement.bytecode));
  await agreementDeployer.waitForDeployment();
  const agreementDeployerAddress = await agreementDeployer.getAddress();

  const Factory = await ethers.getContractFactory("DealLockFactoryV3");
  const factory = await Factory.deploy(agreementDeployerAddress);
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  const factoryTx = factory.deploymentTransaction();
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log("\nDealLockFactoryV3 deployed");
  console.log(`  V6 deployer: ${agreementDeployerAddress}`);
  console.log(`  Factory:     ${factoryAddress}`);
  console.log(`  Chain ID:    ${chainId}`);
  console.log(`  Tx hash:     ${factoryTx?.hash ?? "unknown"}`);

  if (connection.networkName === "sepolia") {
    const explorerBase = process.env.VITE_SEPOLIA_EXPLORER ?? "https://sepolia.etherscan.io";
    console.log(`  Deployer:    ${explorerBase}/address/${agreementDeployerAddress}`);
    console.log(`  Factory:     ${explorerBase}/address/${factoryAddress}`);
  }

  console.log("\n-- Add these to your env files ----------------------------------");
  console.log("\nFrontend (frontend/.env):");
  console.log(`  VITE_DEALLOCK_FACTORY_V3_SEPOLIA=${factoryAddress}`);
  console.log("\nBackend (backend/.env):");
  console.log(`  FACTORY_V3_CONTRACTS=${chainId}:${factoryAddress}`);
  console.log("  FACTORY_INDEXER_ENABLED=true");
  console.log("\n-----------------------------------------------------------------");

  await connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

import hre from "hardhat";

async function main() {
  const connection = await hre.network.create();
  const { ethers } = connection;

  console.log(`Deploying DealLockFactoryV2 to ${connection.networkName}...`);

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No signer — check PRIVATE_KEY env var");
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  const Factory = await ethers.getContractFactory("DealLockFactoryV2");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  const deployTx = factory.deploymentTransaction();
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log("\nDealLockFactoryV2 deployed");
  console.log(`  Address:  ${factoryAddress}`);
  console.log(`  Chain ID: ${chainId}`);
  console.log(`  Tx hash:  ${deployTx?.hash ?? "unknown"}`);

  if (connection.networkName === "sepolia") {
    const explorerBase = process.env.VITE_SEPOLIA_EXPLORER ?? "https://sepolia.etherscan.io";
    console.log(`  Etherscan: ${explorerBase}/address/${factoryAddress}`);
  }

  console.log("\n-- Add these to your env files ----------------------------------");
  console.log("\nFrontend (frontend/.env):");
  console.log(`  VITE_DEALLOCK_FACTORY_V2_SEPOLIA=${factoryAddress}`);
  console.log("\nBackend (backend/.env):");
  console.log(`  FACTORY_V2_CONTRACTS=${chainId}:${factoryAddress}`);
  console.log("  FACTORY_INDEXER_ENABLED=true");
  console.log("\n-----------------------------------------------------------------");

  await connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

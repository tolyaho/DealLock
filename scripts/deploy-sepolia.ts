/**
 * Deploy a sample DealLock agreement to Sepolia from the CLI.
 *
 * Usage:
 *   SEPOLIA_RPC_URL=https://... PRIVATE_KEY=0x... \
 *     npx hardhat run scripts/deploy-sepolia.ts --network sepolia
 *
 * The deployer becomes the client. Adjust PROVIDER, milestone data below.
 */

import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error("No signer — check PRIVATE_KEY env var");

  console.log("Deploying DealLock from:", deployer.address);
  console.log("Network:", hre.network.name);

  // ---- Sample agreement parameters (edit as needed) ----
  const PROVIDER = process.env.PROVIDER_ADDRESS ?? deployer.address;

  const now = Math.floor(Date.now() / 1000);
  const DAY = 86_400;

  const descriptions = [
    "Wireframe / landing page structure",
    "Functional frontend build",
    "Final deployment handoff",
  ];
  const amounts = [
    hre.ethers.parseEther("0.01"),
    hre.ethers.parseEther("0.02"),
    hre.ethers.parseEther("0.01"),
  ];
  const deadlines = [
    BigInt(now + 7 * DAY),
    BigInt(now + 14 * DAY),
    BigInt(now + 21 * DAY),
  ];

  const DealLock = await hre.ethers.getContractFactory("DealLock");
  const contract = await DealLock.deploy(PROVIDER, descriptions, amounts, deadlines);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("DealLock deployed at:", address);
  console.log(`Explorer: https://sepolia.etherscan.io/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

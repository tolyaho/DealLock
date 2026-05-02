import "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hre from "hardhat";

async function main() {
  const connection = await hre.network.create();
  const { ethers } = connection;
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No signer — check PRIVATE_KEY env var");

  console.log("Deploying DealLock from:", deployer.address);
  console.log("Network:", connection.networkName);

  const PROVIDER = process.env.PROVIDER_ADDRESS ?? deployer.address;

  const now = Math.floor(Date.now() / 1000);
  const DAY = 86_400;

  const descriptions = [
    "Wireframe / landing page structure",
    "Functional frontend build",
    "Final deployment handoff",
  ];
  const amounts = [
    ethers.parseEther("0.01"),
    ethers.parseEther("0.02"),
    ethers.parseEther("0.01"),
  ];
  const deadlines = [
    BigInt(now + 7 * DAY),
    BigInt(now + 14 * DAY),
    BigInt(now + 21 * DAY),
  ];
  const reviewPeriod = BigInt(3 * DAY);

  const DealLock = await ethers.getContractFactory("DealLockV4");
  const contract = await DealLock.deploy(PROVIDER, descriptions, amounts, deadlines, reviewPeriod);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("DealLockV4 deployed at:", address);
  console.log("Review period:", reviewPeriod.toString(), "seconds");
  console.log(`Explorer: https://sepolia.etherscan.io/address/${address}`);
  await connection.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

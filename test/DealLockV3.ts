import "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { expect } from "chai";
import hre from "hardhat";
import type { Contract, ContractRunner } from "ethers";

type DealLockV3Contract = Omit<Contract, "connect"> & {
  connect(runner: null | ContractRunner): DealLockV3Contract;
};

const { ethers, networkHelpers } = await hre.network.create();

const GRACE = 24n; // REFUND_GRACE_PERIOD constant

// ── Fixtures ────────────────────────────────────────────────────────────────

async function deployV3Fixture() {
  const [client, provider, other] = await ethers.getSigners();
  const now = await networkHelpers.time.latest();

  const descriptions = ["Alpha", "Beta", "Gamma"];
  const amounts = [
    ethers.parseEther("1"),
    ethers.parseEther("2"),
    ethers.parseEther("3"),
  ];
  const deadlines = [now + 100, now + 200, now + 300];
  const totalAmount = amounts.reduce((a, b) => a + b, 0n);

  const v3 = (await ethers.deployContract(
    "DealLockV3",
    [provider.address, descriptions, amounts, deadlines],
    client,
  )) as unknown as DealLockV3Contract;

  await v3.waitForDeployment();

  return { v3, client, provider, other, descriptions, amounts, deadlines, totalAmount };
}

async function fundedV3Fixture() {
  const base = await deployV3Fixture();
  const { v3, client, provider, totalAmount } = base;
  await v3.connect(provider).acceptAgreement();
  await v3.connect(client).fundAgreement({ value: totalAmount });
  return base;
}

async function fundedAdjustmentFixture() {
  const base = await fundedV3Fixture();
  const { v3, client, provider } = base;

  // Submit milestone 0 so we have a target for an adjustment
  await v3.connect(provider).submitMilestone(0, "ipfs://m0");

  // Set up an adjustment with a near deadline for timing tests
  const now = await networkHelpers.time.latest();
  const adjDeadline = now + 500;
  const adjAmount = ethers.parseEther("0.05");

  await v3.connect(client).requestAdjustment(0, "Extra work", adjAmount, adjDeadline);
  await v3.connect(provider).acceptAdjustment(0);
  await v3.connect(client).fundAdjustment(0, { value: adjAmount });

  return { ...base, adjDeadline, adjAmount };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("DealLockV3", function () {
  // 1 ─────────────────────────────────────────────────────────────────────────
  it("contractVersion() returns 3", async function () {
    const { v3 } = await networkHelpers.loadFixture(deployV3Fixture);
    expect(await v3.contractVersion()).to.equal(3n);
  });

  // 2 ─────────────────────────────────────────────────────────────────────────
  it("REFUND_GRACE_PERIOD returns 24", async function () {
    const { v3 } = await networkHelpers.loadFixture(deployV3Fixture);
    expect(await v3.REFUND_GRACE_PERIOD()).to.equal(GRACE);
  });

  // 3 ─────────────────────────────────────────────────────────────────────────
  it("getMilestoneRefundAvailableAt(id) returns deadline + 24", async function () {
    const { v3, deadlines } = await networkHelpers.loadFixture(deployV3Fixture);
    const refundAt = await v3.getMilestoneRefundAvailableAt(0);
    expect(refundAt).to.equal(BigInt(deadlines[0]) + GRACE);
  });

  // 4 ─────────────────────────────────────────────────────────────────────────
  it("client cannot refund a pending milestone before the deadline", async function () {
    const { v3, client } = await networkHelpers.loadFixture(fundedV3Fixture);
    // No time advance — deadline has not passed
    await expect(v3.connect(client).refundExpiredMilestone(0))
      .to.be.revertedWith("Refund not available yet");
  });

  // 5 ─────────────────────────────────────────────────────────────────────────
  it("client cannot refund a pending milestone exactly at the deadline", async function () {
    const { v3, client, deadlines } = await networkHelpers.loadFixture(fundedV3Fixture);
    await networkHelpers.time.increaseTo(deadlines[0]);
    await expect(v3.connect(client).refundExpiredMilestone(0))
      .to.be.revertedWith("Refund not available yet");
  });

  // 6 ─────────────────────────────────────────────────────────────────────────
  it("client cannot refund during the 24-second grace period", async function () {
    const { v3, client, deadlines } = await networkHelpers.loadFixture(fundedV3Fixture);
    // deadline + 10 is inside the grace window
    await networkHelpers.time.increaseTo(deadlines[0] + 10);
    await expect(v3.connect(client).refundExpiredMilestone(0))
      .to.be.revertedWith("Refund not available yet");
  });

  // 7 ─────────────────────────────────────────────────────────────────────────
  it("client can refund a pending milestone at deadline + 24", async function () {
    const { v3, client, amounts, deadlines } = await networkHelpers.loadFixture(fundedV3Fixture);
    await networkHelpers.time.increaseTo(deadlines[0] + Number(GRACE));

    const tx = v3.connect(client).refundExpiredMilestone(0);
    await expect(tx).to.emit(v3, "MilestoneRefunded").withArgs(0n, amounts[0]);
    await expect(tx).to.changeEtherBalance(ethers, client, amounts[0]);

    expect((await v3.getMilestone(0))[5]).to.equal(3n); // Refunded
  });

  // 8 ─────────────────────────────────────────────────────────────────────────
  it("provider can submit a milestone during the grace period", async function () {
    const { v3, provider, deadlines } = await networkHelpers.loadFixture(fundedV3Fixture);
    // deadline + 10 — inside grace window, past the old deadline
    await networkHelpers.time.increaseTo(deadlines[0] + 10);

    await expect(v3.connect(provider).submitMilestone(0, "ipfs://late-proof"))
      .to.emit(v3, "MilestoneSubmitted")
      .withArgs(0n, "ipfs://late-proof");

    expect((await v3.getMilestone(0))[5]).to.equal(1n); // Submitted
  });

  // 9 ─────────────────────────────────────────────────────────────────────────
  it("if provider submits during grace, client can no longer refund the milestone as pending", async function () {
    const { v3, client, provider, deadlines } = await networkHelpers.loadFixture(fundedV3Fixture);

    await networkHelpers.time.increaseTo(deadlines[0] + 10);
    await v3.connect(provider).submitMilestone(0, "ipfs://grace-submit");

    // Advance past grace window — but the state is now Submitted, not Pending
    await networkHelpers.time.increaseTo(deadlines[0] + Number(GRACE) + 10);
    await expect(v3.connect(client).refundExpiredMilestone(0))
      .to.be.revertedWith("Milestone not pending");
  });

  // 10 ────────────────────────────────────────────────────────────────────────
  it("getAdjustmentRefundAvailableAt(id) returns adjustment.deadline + 24", async function () {
    const { v3, adjDeadline } = await networkHelpers.loadFixture(fundedAdjustmentFixture);
    const refundAt = await v3.getAdjustmentRefundAvailableAt(0);
    expect(refundAt).to.equal(BigInt(adjDeadline) + GRACE);
  });

  // 11 ────────────────────────────────────────────────────────────────────────
  it("client cannot refund a funded adjustment during the grace period", async function () {
    const { v3, client, adjDeadline } = await networkHelpers.loadFixture(fundedAdjustmentFixture);
    await networkHelpers.time.increaseTo(adjDeadline + 10);
    await expect(v3.connect(client).refundExpiredAdjustment(0))
      .to.be.revertedWith("Refund not available yet");
  });

  // 12 ────────────────────────────────────────────────────────────────────────
  it("client can refund a funded adjustment at deadline + 24", async function () {
    const { v3, client, adjDeadline, adjAmount } =
      await networkHelpers.loadFixture(fundedAdjustmentFixture);
    await networkHelpers.time.increaseTo(adjDeadline + Number(GRACE));

    const tx = v3.connect(client).refundExpiredAdjustment(0);
    await expect(tx).to.emit(v3, "AdjustmentRefunded").withArgs(0n, adjAmount);
    await expect(tx).to.changeEtherBalance(ethers, client, adjAmount);

    expect((await v3.getAdjustment(0))[6]).to.equal(5n); // Refunded
  });

  // 13 ────────────────────────────────────────────────────────────────────────
  it("provider can submit a funded adjustment during the grace period", async function () {
    const { v3, provider, adjDeadline } =
      await networkHelpers.loadFixture(fundedAdjustmentFixture);
    await networkHelpers.time.increaseTo(adjDeadline + 10);

    await expect(v3.connect(provider).submitAdjustment(0, "ipfs://adj-grace"))
      .to.emit(v3, "AdjustmentSubmitted")
      .withArgs(0n, "ipfs://adj-grace");

    expect((await v3.getAdjustment(0))[6]).to.equal(3n); // Submitted
  });

  // 14 ────────────────────────────────────────────────────────────────────────
  it("if provider submits during grace, client cannot refund the adjustment", async function () {
    const { v3, client, provider, adjDeadline } =
      await networkHelpers.loadFixture(fundedAdjustmentFixture);

    await networkHelpers.time.increaseTo(adjDeadline + 10);
    await v3.connect(provider).submitAdjustment(0, "ipfs://adj-grace");

    await networkHelpers.time.increaseTo(adjDeadline + Number(GRACE) + 10);
    await expect(v3.connect(client).refundExpiredAdjustment(0))
      .to.be.revertedWith("Adjustment not funded");
  });

  // 15 ────────────────────────────────────────────────────────────────────────
  it("DealLockV2 milestone and adjustment workflow still works unchanged", async function () {
    const [client, provider] = await ethers.getSigners();
    const now = await networkHelpers.time.latest();

    const v2 = (await ethers.deployContract(
      "DealLockV2",
      [provider.address, ["Step A"], [ethers.parseEther("1")], [now + 100]],
      client,
    )) as unknown as DealLockV3Contract;
    await v2.waitForDeployment();
    await v2.connect(provider).acceptAgreement();
    await v2.connect(client).fundAgreement({ value: ethers.parseEther("1") });

    // V2 still enforces old deadline on submit
    await networkHelpers.time.increaseTo(now + 101);
    await expect(v2.connect(provider).submitMilestone(0, "proof"))
      .to.be.revertedWith("Deadline passed");

    // V2 still allows refund after deadline (no grace)
    await expect(v2.connect(client).refundExpiredMilestone(0))
      .to.emit(v2, "MilestoneRefunded");
  });

  // 16 ────────────────────────────────────────────────────────────────────────
  it("DealLockV1 contract still deploys and completes unchanged", async function () {
    const [client, provider] = await ethers.getSigners();
    const now = await networkHelpers.time.latest();

    const v1 = (await ethers.deployContract(
      "DealLock",
      [provider.address, ["Only step"], [ethers.parseEther("1")], [now + 100]],
      client,
    )) as unknown as DealLockV3Contract;
    await v1.waitForDeployment();
    await v1.connect(provider).acceptAgreement();
    await v1.connect(client).fundAgreement({ value: ethers.parseEther("1") });
    await v1.connect(provider).submitMilestone(0, "ipfs://v1");
    await v1.connect(client).approveMilestone(0);
    expect(await v1.isAgreementCompleted()).to.equal(true);
  });
});

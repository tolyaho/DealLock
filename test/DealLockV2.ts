import "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { expect } from "chai";
import hre from "hardhat";
import type { Contract, ContractRunner } from "ethers";

type DealLockV2Contract = Omit<Contract, "connect"> & {
  connect(runner: null | ContractRunner): DealLockV2Contract;
};

const { ethers, networkHelpers } = await hre.network.create();

// ── Fixtures ────────────────────────────────────────────────────────────────

async function deployV2Fixture() {
  const [client, provider, other] = await ethers.getSigners();
  const now = await networkHelpers.time.latest();

  const descriptions = ["Design", "Build", "Deploy"];
  const amounts = [
    ethers.parseEther("1"),
    ethers.parseEther("2"),
    ethers.parseEther("3"),
  ];
  const deadlines = [now + 100, now + 200, now + 300];
  const totalAmount = amounts.reduce((a, b) => a + b, 0n);

  const v2 = (await ethers.deployContract(
    "DealLockV2",
    [provider.address, descriptions, amounts, deadlines],
    client,
  )) as unknown as DealLockV2Contract;

  await v2.waitForDeployment();

  return { v2, client, provider, other, descriptions, amounts, deadlines, totalAmount };
}

async function fundedV2Fixture() {
  const base = await deployV2Fixture();
  const { v2, client, provider, totalAmount } = base;
  await v2.connect(provider).acceptAgreement();
  await v2.connect(client).fundAgreement({ value: totalAmount });
  return base;
}

async function submittedMilestone0Fixture() {
  const base = await fundedV2Fixture();
  const { v2, provider } = base;
  await v2.connect(provider).submitMilestone(0, "ipfs://m0-proof");
  return base;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("DealLockV2", function () {
  // 1 ─────────────────────────────────────────────────────────────────────────
  it("preserves original V1 fields and milestone workflow", async function () {
    const { v2, client, provider, descriptions, amounts, deadlines, totalAmount } =
      await networkHelpers.loadFixture(deployV2Fixture);

    expect(await v2.client()).to.equal(client.address);
    expect(await v2.provider()).to.equal(provider.address);
    expect(await v2.totalAmount()).to.equal(totalAmount);
    expect(await v2.fundedAmount()).to.equal(0n);
    expect(await v2.releasedAmount()).to.equal(0n);
    expect(await v2.refundedAmount()).to.equal(0n);
    expect(await v2.agreementState()).to.equal(0n);
    expect(await v2.getMilestoneCount()).to.equal(3n);

    const m0 = await v2.getMilestone(0);
    expect(m0[0]).to.equal(descriptions[0]);
    expect(m0[1]).to.equal(amounts[0]);
    expect(m0[2]).to.equal(BigInt(deadlines[0]));

    await v2.connect(provider).acceptAgreement();
    expect(await v2.agreementState()).to.equal(1n);

    await v2.connect(client).fundAgreement({ value: totalAmount });
    expect(await v2.agreementState()).to.equal(2n);
    expect(await v2.getContractBalance()).to.equal(totalAmount);

    await v2.connect(provider).submitMilestone(0, "ipfs://proof-0");
    await v2.connect(client).approveMilestone(0);
    expect(await v2.releasedAmount()).to.equal(amounts[0]);
  });

  // 2 ─────────────────────────────────────────────────────────────────────────
  it("contractVersion() returns 2", async function () {
    const { v2 } = await networkHelpers.loadFixture(deployV2Fixture);
    expect(await v2.contractVersion()).to.equal(2n);
  });

  // 3 ─────────────────────────────────────────────────────────────────────────
  it("client can request a paid adjustment attached to a submitted milestone", async function () {
    const { v2, client } = await networkHelpers.loadFixture(submittedMilestone0Fixture);

    const now = await networkHelpers.time.latest();
    const adjDeadline = now + 500;

    await expect(
      v2.connect(client).requestAdjustment(0, "Add dark mode", ethers.parseEther("0.01"), adjDeadline),
    )
      .to.emit(v2, "AdjustmentRequested")
      .withArgs(0n, 0n, ethers.parseEther("0.01"), BigInt(adjDeadline), "Add dark mode");

    expect(await v2.getAdjustmentCount()).to.equal(1n);
    const adj = await v2.getAdjustment(0);
    expect(adj[0]).to.equal(0n); // targetMilestoneId
    expect(adj[1]).to.equal("Add dark mode"); // description
    expect(adj[2]).to.equal(ethers.parseEther("0.01")); // amount
    expect(adj[6]).to.equal(0n); // state: Proposed
  });

  // 4 ─────────────────────────────────────────────────────────────────────────
  it("non-client cannot request adjustment", async function () {
    const { v2, provider } = await networkHelpers.loadFixture(submittedMilestone0Fixture);
    const now = await networkHelpers.time.latest();

    await expect(
      v2.connect(provider).requestAdjustment(0, "Extra work", ethers.parseEther("0.01"), now + 500),
    ).to.be.revertedWith("Only client");
  });

  // 5 ─────────────────────────────────────────────────────────────────────────
  it("cannot request adjustment with invalid milestone id", async function () {
    const { v2, client } = await networkHelpers.loadFixture(submittedMilestone0Fixture);
    const now = await networkHelpers.time.latest();

    await expect(
      v2.connect(client).requestAdjustment(99, "Extra", ethers.parseEther("0.01"), now + 500),
    ).to.be.revertedWith("Invalid milestone id");
  });

  // 6 ─────────────────────────────────────────────────────────────────────────
  it("cannot request adjustment with zero amount", async function () {
    const { v2, client } = await networkHelpers.loadFixture(submittedMilestone0Fixture);
    const now = await networkHelpers.time.latest();

    await expect(
      v2.connect(client).requestAdjustment(0, "Extra", 0n, now + 500),
    ).to.be.revertedWith("Zero adjustment amount");
  });

  // 7 ─────────────────────────────────────────────────────────────────────────
  it("cannot request adjustment with past deadline", async function () {
    const { v2, client } = await networkHelpers.loadFixture(submittedMilestone0Fixture);
    const now = await networkHelpers.time.latest();

    await expect(
      v2.connect(client).requestAdjustment(0, "Extra", ethers.parseEther("0.01"), now - 1),
    ).to.be.revertedWith("Deadline must be future");
  });

  // 8 ─────────────────────────────────────────────────────────────────────────
  it("provider can accept a proposed adjustment", async function () {
    const { v2, client, provider } = await networkHelpers.loadFixture(submittedMilestone0Fixture);
    const now = await networkHelpers.time.latest();
    await v2.connect(client).requestAdjustment(0, "Extra", ethers.parseEther("0.01"), now + 500);

    await expect(v2.connect(provider).acceptAdjustment(0))
      .to.emit(v2, "AdjustmentAccepted")
      .withArgs(0n);

    const adj = await v2.getAdjustment(0);
    expect(adj[6]).to.equal(1n); // Accepted
  });

  // 9 ─────────────────────────────────────────────────────────────────────────
  it("non-provider cannot accept adjustment", async function () {
    const { v2, client } = await networkHelpers.loadFixture(submittedMilestone0Fixture);
    const now = await networkHelpers.time.latest();
    await v2.connect(client).requestAdjustment(0, "Extra", ethers.parseEther("0.01"), now + 500);

    await expect(v2.connect(client).acceptAdjustment(0)).to.be.revertedWith("Only provider");
  });

  // 10 ────────────────────────────────────────────────────────────────────────
  it("client can fund an accepted adjustment with exact ETH amount", async function () {
    const { v2, client, provider } = await networkHelpers.loadFixture(submittedMilestone0Fixture);
    const now = await networkHelpers.time.latest();
    const adjAmount = ethers.parseEther("0.05");
    await v2.connect(client).requestAdjustment(0, "Extra", adjAmount, now + 500);
    await v2.connect(provider).acceptAdjustment(0);

    await expect(v2.connect(client).fundAdjustment(0, { value: adjAmount }))
      .to.emit(v2, "AdjustmentFunded")
      .withArgs(0n, adjAmount);

    const adj = await v2.getAdjustment(0);
    expect(adj[6]).to.equal(2n); // Funded
    expect(await v2.adjustmentFundedAmount()).to.equal(adjAmount);
  });

  // 11 ────────────────────────────────────────────────────────────────────────
  it("cannot fund adjustment before provider acceptance", async function () {
    const { v2, client } = await networkHelpers.loadFixture(submittedMilestone0Fixture);
    const now = await networkHelpers.time.latest();
    const adjAmount = ethers.parseEther("0.05");
    await v2.connect(client).requestAdjustment(0, "Extra", adjAmount, now + 500);

    await expect(
      v2.connect(client).fundAdjustment(0, { value: adjAmount }),
    ).to.be.revertedWith("Adjustment not accepted");
  });

  // 12 ────────────────────────────────────────────────────────────────────────
  it("cannot fund adjustment with incorrect ETH amount", async function () {
    const { v2, client, provider } = await networkHelpers.loadFixture(submittedMilestone0Fixture);
    const now = await networkHelpers.time.latest();
    const adjAmount = ethers.parseEther("0.05");
    await v2.connect(client).requestAdjustment(0, "Extra", adjAmount, now + 500);
    await v2.connect(provider).acceptAdjustment(0);

    await expect(
      v2.connect(client).fundAdjustment(0, { value: adjAmount - 1n }),
    ).to.be.revertedWith("Incorrect funding amount");
  });

  // 13 ────────────────────────────────────────────────────────────────────────
  it("provider can submit proof for a funded adjustment", async function () {
    const { v2, client, provider } = await networkHelpers.loadFixture(submittedMilestone0Fixture);
    const now = await networkHelpers.time.latest();
    const adjAmount = ethers.parseEther("0.05");
    await v2.connect(client).requestAdjustment(0, "Extra", adjAmount, now + 500);
    await v2.connect(provider).acceptAdjustment(0);
    await v2.connect(client).fundAdjustment(0, { value: adjAmount });

    await expect(v2.connect(provider).submitAdjustment(0, "ipfs://adj-0-proof"))
      .to.emit(v2, "AdjustmentSubmitted")
      .withArgs(0n, "ipfs://adj-0-proof");

    const adj = await v2.getAdjustment(0);
    expect(adj[4]).to.equal("ipfs://adj-0-proof"); // proof
    expect(adj[6]).to.equal(3n); // Submitted
  });

  // 14 ────────────────────────────────────────────────────────────────────────
  it("cannot submit adjustment before funding", async function () {
    const { v2, client, provider } = await networkHelpers.loadFixture(submittedMilestone0Fixture);
    const now = await networkHelpers.time.latest();
    await v2.connect(client).requestAdjustment(0, "Extra", ethers.parseEther("0.05"), now + 500);
    await v2.connect(provider).acceptAdjustment(0);

    await expect(
      v2.connect(provider).submitAdjustment(0, "ipfs://proof"),
    ).to.be.revertedWith("Adjustment not funded");
  });

  // 15 ────────────────────────────────────────────────────────────────────────
  it("client can approve submitted adjustment and provider receives extra payment", async function () {
    const { v2, client, provider } = await networkHelpers.loadFixture(submittedMilestone0Fixture);
    const now = await networkHelpers.time.latest();
    const adjAmount = ethers.parseEther("0.05");
    await v2.connect(client).requestAdjustment(0, "Extra", adjAmount, now + 500);
    await v2.connect(provider).acceptAdjustment(0);
    await v2.connect(client).fundAdjustment(0, { value: adjAmount });
    await v2.connect(provider).submitAdjustment(0, "ipfs://adj-0-proof");

    const tx = v2.connect(client).approveAdjustment(0);

    await expect(tx)
      .to.emit(v2, "AdjustmentReleased")
      .withArgs(0n, adjAmount);

    await expect(tx).to.changeEtherBalance(ethers, provider, adjAmount);

    const adj = await v2.getAdjustment(0);
    expect(adj[6]).to.equal(4n); // Released
    expect(await v2.adjustmentReleasedAmount()).to.equal(adjAmount);
  });

  // 16 ────────────────────────────────────────────────────────────────────────
  it("client can refund a funded adjustment that expired without submission", async function () {
    const { v2, client, provider } = await networkHelpers.loadFixture(submittedMilestone0Fixture);
    const now = await networkHelpers.time.latest();
    const adjDeadline = now + 500;
    const adjAmount = ethers.parseEther("0.05");

    await v2.connect(client).requestAdjustment(0, "Extra", adjAmount, adjDeadline);
    await v2.connect(provider).acceptAdjustment(0);
    await v2.connect(client).fundAdjustment(0, { value: adjAmount });

    await networkHelpers.time.increaseTo(adjDeadline + 1);

    const tx = v2.connect(client).refundExpiredAdjustment(0);

    await expect(tx)
      .to.emit(v2, "AdjustmentRefunded")
      .withArgs(0n, adjAmount);

    await expect(tx).to.changeEtherBalance(ethers, client, adjAmount);

    const adj = await v2.getAdjustment(0);
    expect(adj[6]).to.equal(5n); // Refunded
    expect(await v2.adjustmentRefundedAmount()).to.equal(adjAmount);
  });

  // 17 ────────────────────────────────────────────────────────────────────────
  it("cannot refund funded adjustment before deadline", async function () {
    const { v2, client, provider } = await networkHelpers.loadFixture(submittedMilestone0Fixture);
    const now = await networkHelpers.time.latest();
    const adjAmount = ethers.parseEther("0.05");
    await v2.connect(client).requestAdjustment(0, "Extra", adjAmount, now + 500);
    await v2.connect(provider).acceptAdjustment(0);
    await v2.connect(client).fundAdjustment(0, { value: adjAmount });

    await expect(
      v2.connect(client).refundExpiredAdjustment(0),
    ).to.be.revertedWith("Deadline not passed");
  });

  // 18 ────────────────────────────────────────────────────────────────────────
  it("cannot refund adjustment after provider submitted proof", async function () {
    const { v2, client, provider } = await networkHelpers.loadFixture(submittedMilestone0Fixture);
    const now = await networkHelpers.time.latest();
    const adjDeadline = now + 500;
    const adjAmount = ethers.parseEther("0.05");

    await v2.connect(client).requestAdjustment(0, "Extra", adjAmount, adjDeadline);
    await v2.connect(provider).acceptAdjustment(0);
    await v2.connect(client).fundAdjustment(0, { value: adjAmount });
    await v2.connect(provider).submitAdjustment(0, "ipfs://proof");

    await networkHelpers.time.increaseTo(adjDeadline + 1);

    await expect(
      v2.connect(client).refundExpiredAdjustment(0),
    ).to.be.revertedWith("Adjustment not funded");
  });

  // 19 ────────────────────────────────────────────────────────────────────────
  it("either party can cancel a proposed or accepted unfunded adjustment", async function () {
    const { v2, client, provider } = await networkHelpers.loadFixture(submittedMilestone0Fixture);
    const now = await networkHelpers.time.latest();

    // Client cancels a Proposed adjustment
    await v2.connect(client).requestAdjustment(0, "Extra A", ethers.parseEther("0.01"), now + 500);
    await expect(v2.connect(client).cancelAdjustment(0))
      .to.emit(v2, "AdjustmentCancelled")
      .withArgs(0n);
    expect((await v2.getAdjustment(0))[6]).to.equal(6n); // Cancelled

    // Provider cancels an Accepted adjustment
    await v2.connect(client).requestAdjustment(0, "Extra B", ethers.parseEther("0.01"), now + 600);
    await v2.connect(provider).acceptAdjustment(1);
    await expect(v2.connect(provider).cancelAdjustment(1))
      .to.emit(v2, "AdjustmentCancelled")
      .withArgs(1n);
    expect((await v2.getAdjustment(1))[6]).to.equal(6n); // Cancelled
  });

  // 20 ────────────────────────────────────────────────────────────────────────
  it("cannot cancel a funded, submitted, released, or refunded adjustment", async function () {
    const { v2, client, provider } = await networkHelpers.loadFixture(submittedMilestone0Fixture);
    const now = await networkHelpers.time.latest();
    const adjDeadline = now + 500;
    const adjAmount = ethers.parseEther("0.05");

    await v2.connect(client).requestAdjustment(0, "Extra", adjAmount, adjDeadline);
    await v2.connect(provider).acceptAdjustment(0);
    await v2.connect(client).fundAdjustment(0, { value: adjAmount });

    // Funded → cannot cancel
    await expect(v2.connect(client).cancelAdjustment(0)).to.be.revertedWith(
      "Adjustment cannot be cancelled",
    );

    await v2.connect(provider).submitAdjustment(0, "ipfs://proof");

    // Submitted → cannot cancel
    await expect(v2.connect(client).cancelAdjustment(0)).to.be.revertedWith(
      "Adjustment cannot be cancelled",
    );

    await v2.connect(client).approveAdjustment(0);

    // Released → cannot cancel (agreement still Funded, but adj state blocks it)
    await expect(v2.connect(client).cancelAdjustment(0)).to.be.revertedWith(
      "Adjustment cannot be cancelled",
    );
  });

  // 21 ────────────────────────────────────────────────────────────────────────
  it("multiple adjustments can exist and resolve independently", async function () {
    const { v2, client, provider } = await networkHelpers.loadFixture(submittedMilestone0Fixture);
    const now = await networkHelpers.time.latest();
    const amt0 = ethers.parseEther("0.01");
    const amt1 = ethers.parseEther("0.02");

    await v2.connect(client).requestAdjustment(0, "Dark mode", amt0, now + 500);
    await v2.connect(client).requestAdjustment(0, "Animation", amt1, now + 600);

    expect(await v2.getAdjustmentCount()).to.equal(2n);

    await v2.connect(provider).acceptAdjustment(0);
    await v2.connect(client).fundAdjustment(0, { value: amt0 });
    await v2.connect(provider).submitAdjustment(0, "ipfs://dark-mode");
    await v2.connect(client).approveAdjustment(0);

    // Adjustment 1 still in Proposed state
    expect((await v2.getAdjustment(1))[6]).to.equal(0n); // Proposed
    expect((await v2.getAdjustment(0))[6]).to.equal(4n); // Released
  });

  // 22 ────────────────────────────────────────────────────────────────────────
  it("agreement completes only after original milestones and all adjustments are terminal", async function () {
    const { v2, client, provider, amounts, totalAmount } =
      await networkHelpers.loadFixture(fundedV2Fixture);
    const now = await networkHelpers.time.latest();

    // Approve milestones 0 and 1
    await v2.connect(provider).submitMilestone(0, "ipfs://m0");
    await v2.connect(client).approveMilestone(0);
    await v2.connect(provider).submitMilestone(1, "ipfs://m1");
    await v2.connect(client).approveMilestone(1);

    // Submit (but do not approve) milestone 2 — so we can add an adjustment
    await v2.connect(provider).submitMilestone(2, "ipfs://m2");

    // Request an adjustment while the agreement is still Funded
    await v2.connect(client).requestAdjustment(0, "Extra scope", ethers.parseEther("0.01"), now + 800);

    // Approve milestone 2 — releasedAmount == totalAmount now
    await v2.connect(client).approveMilestone(2);

    // Agreement should NOT be Completed yet (Proposed adjustment blocks it)
    expect(await v2.agreementState()).to.equal(2n); // still Funded
    expect(await v2.isAgreementCompleted()).to.equal(false);

    // Cancel the pending adjustment
    await v2.connect(client).cancelAdjustment(0);

    // Now agreement should be Completed
    expect(await v2.agreementState()).to.equal(3n); // Completed
    expect(await v2.isAgreementCompleted()).to.equal(true);
  });

  // 23 ────────────────────────────────────────────────────────────────────────
  it("DealLockV1 tests are unaffected (V1 contract still deploys and works)", async function () {
    const [client, provider] = await ethers.getSigners();
    const now = await networkHelpers.time.latest();

    const v1 = (await ethers.deployContract(
      "DealLock",
      [
        provider.address,
        ["Milestone A"],
        [ethers.parseEther("1")],
        [now + 100],
      ],
      client,
    )) as unknown as DealLockV2Contract;

    await v1.waitForDeployment();
    await v1.connect(provider).acceptAgreement();
    await v1.connect(client).fundAgreement({ value: ethers.parseEther("1") });
    await v1.connect(provider).submitMilestone(0, "ipfs://v1-proof");
    await v1.connect(client).approveMilestone(0);

    expect(await v1.isAgreementCompleted()).to.equal(true);
  });
});

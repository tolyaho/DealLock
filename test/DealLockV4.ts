import "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { expect } from "chai";
import hre from "hardhat";
import type { Contract, ContractRunner } from "ethers";

type DealLockV4Contract = Omit<Contract, "connect"> & {
  connect(runner: null | ContractRunner): DealLockV4Contract;
};

const { ethers, networkHelpers } = await hre.network.create();

const REVIEW_PERIOD = 3 * 24 * 60 * 60; // 3 days in seconds
const GRACE = 24n; // REFUND_GRACE_PERIOD

// ── Fixtures ────────────────────────────────────────────────────────────────

async function deployV4Fixture() {
  const [client, provider, other] = await ethers.getSigners();
  const now = await networkHelpers.time.latest();

  const descriptions = ["Alpha", "Beta", "Gamma"];
  const amounts = [
    ethers.parseEther("1"),
    ethers.parseEther("2"),
    ethers.parseEther("3"),
  ];
  const deadlines = [now + 1000, now + 2000, now + 3000];
  const totalAmount = amounts.reduce((a, b) => a + b, 0n);

  const v4 = (await ethers.deployContract(
    "DealLockV4",
    [provider.address, descriptions, amounts, deadlines, REVIEW_PERIOD],
    client,
  )) as unknown as DealLockV4Contract;

  await v4.waitForDeployment();

  return { v4, client, provider, other, descriptions, amounts, deadlines, totalAmount };
}

async function fundedV4Fixture() {
  const base = await deployV4Fixture();
  const { v4, client, provider, totalAmount } = base;
  await v4.connect(provider).acceptAgreement();
  await v4.connect(client).fundAgreement({ value: totalAmount });
  return base;
}

// Fixture with milestone 0 submitted
async function submittedMilestoneFixture() {
  const base = await fundedV4Fixture();
  const { v4, provider } = base;
  await v4.connect(provider).submitMilestone(0, "ipfs://m0-proof");
  return base;
}

// Fixture with a funded adjustment, milestone 0 submitted
async function fundedAdjustmentV4Fixture() {
  const base = await fundedV4Fixture();
  const { v4, client, provider } = base;

  // Submit milestone 0 (target for adjustment)
  await v4.connect(provider).submitMilestone(0, "ipfs://m0-proof");

  const now = await networkHelpers.time.latest();
  const adjDeadline = now + 2000;
  const adjAmount = ethers.parseEther("0.1");

  await v4.connect(client).requestAdjustment(0, "Extra work", adjAmount, adjDeadline);
  await v4.connect(provider).acceptAdjustment(0);
  await v4.connect(client).fundAdjustment(0, { value: adjAmount });

  return { ...base, adjDeadline, adjAmount };
}

// Fixture with milestone 0 disputed
async function disputedMilestoneFixture() {
  const base = await submittedMilestoneFixture();
  const { v4, client } = base;
  await v4.connect(client).disputeMilestone(0, "Work is incomplete");
  return base;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("DealLockV4", function () {
  // 1 ─────────────────────────────────────────────────────────────────────────
  it("contractVersion() returns 4", async function () {
    const { v4 } = await networkHelpers.loadFixture(deployV4Fixture);
    expect(await v4.contractVersion()).to.equal(4n);
  });

  // 2 ─────────────────────────────────────────────────────────────────────────
  it("constructor stores reviewPeriod", async function () {
    const { v4 } = await networkHelpers.loadFixture(deployV4Fixture);
    expect(await v4.reviewPeriod()).to.equal(BigInt(REVIEW_PERIOD));
  });

  // 3 ─────────────────────────────────────────────────────────────────────────
  it("constructor rejects review period shorter than 1 hour", async function () {
    const [client, provider] = await ethers.getSigners();
    const now = await networkHelpers.time.latest();
    await expect(
      ethers.deployContract(
        "DealLockV4",
        [provider.address, ["Step"], [ethers.parseEther("1")], [now + 1000], 3599],
        client,
      ),
    ).to.be.revertedWith("Review period too short");
  });

  // 4 ─────────────────────────────────────────────────────────────────────────
  it("constructor rejects review period longer than 14 days", async function () {
    const [client, provider] = await ethers.getSigners();
    const now = await networkHelpers.time.latest();
    await expect(
      ethers.deployContract(
        "DealLockV4",
        [
          provider.address,
          ["Step"],
          [ethers.parseEther("1")],
          [now + 1000],
          14 * 24 * 60 * 60 + 1,
        ],
        client,
      ),
    ).to.be.revertedWith("Review period too long");
  });

  // 5 ─────────────────────────────────────────────────────────────────────────
  it("original milestone workflow still works (submit → approve)", async function () {
    const { v4, client, provider, amounts } = await networkHelpers.loadFixture(fundedV4Fixture);

    await v4.connect(provider).submitMilestone(0, "ipfs://proof0");
    const tx = v4.connect(client).approveMilestone(0);
    await expect(tx).to.emit(v4, "MilestoneReleased").withArgs(0n, amounts[0]);
    await expect(tx).to.changeEtherBalance(ethers, provider, amounts[0]);

    expect((await v4.getMilestone(0))[5]).to.equal(2n); // Released
  });

  // 6 ─────────────────────────────────────────────────────────────────────────
  it("client can approve submitted milestone during review period", async function () {
    const { v4, client, amounts } = await networkHelpers.loadFixture(submittedMilestoneFixture);

    // Advance time to partway through review period
    await networkHelpers.time.increase(REVIEW_PERIOD / 2);

    const tx = v4.connect(client).approveMilestone(0);
    await expect(tx).to.emit(v4, "MilestoneReleased").withArgs(0n, amounts[0]);
  });

  // 7 ─────────────────────────────────────────────────────────────────────────
  it("client can dispute submitted milestone during review period", async function () {
    const { v4, client } = await networkHelpers.loadFixture(submittedMilestoneFixture);

    const tx = v4.connect(client).disputeMilestone(0, "Missing deliverable");
    await expect(tx).to.emit(v4, "MilestoneDisputed").withArgs(0n, "Missing deliverable");

    expect((await v4.getMilestone(0))[5]).to.equal(4n); // Disputed

    const dispute = await v4.getMilestoneDispute(0);
    expect(dispute.exists).to.equal(true);
    expect(dispute.reason).to.equal("Missing deliverable");
  });

  // 8 ─────────────────────────────────────────────────────────────────────────
  it("client cannot dispute a pending milestone", async function () {
    const { v4, client } = await networkHelpers.loadFixture(fundedV4Fixture);
    await expect(v4.connect(client).disputeMilestone(0, "reason"))
      .to.be.revertedWith("Milestone not submitted");
  });

  // 9 ─────────────────────────────────────────────────────────────────────────
  it("client cannot dispute after review period expires", async function () {
    const { v4, client } = await networkHelpers.loadFixture(submittedMilestoneFixture);

    await networkHelpers.time.increase(REVIEW_PERIOD + 1);

    await expect(v4.connect(client).disputeMilestone(0, "too late"))
      .to.be.revertedWith("Review period expired");
  });

  // 10 ────────────────────────────────────────────────────────────────────────
  it("non-client cannot dispute milestone", async function () {
    const { v4, provider } = await networkHelpers.loadFixture(submittedMilestoneFixture);
    await expect(v4.connect(provider).disputeMilestone(0, "reason"))
      .to.be.revertedWith("Only client");
  });

  // 11 ────────────────────────────────────────────────────────────────────────
  it("provider cannot auto-release before review period expires", async function () {
    const { v4, provider } = await networkHelpers.loadFixture(submittedMilestoneFixture);

    // Still within review period
    await networkHelpers.time.increase(REVIEW_PERIOD / 2);

    await expect(v4.connect(provider).claimMilestoneAfterReview(0))
      .to.be.revertedWith("Review period not expired");
  });

  // 12 ────────────────────────────────────────────────────────────────────────
  it("provider can auto-release after review period expires", async function () {
    const { v4, provider, amounts } = await networkHelpers.loadFixture(submittedMilestoneFixture);

    await networkHelpers.time.increase(REVIEW_PERIOD + 1);

    const tx = v4.connect(provider).claimMilestoneAfterReview(0);
    await expect(tx).to.emit(v4, "MilestoneAutoReleased").withArgs(0n, amounts[0]);
    await expect(tx).to.changeEtherBalance(ethers, provider, amounts[0]);

    expect((await v4.getMilestone(0))[5]).to.equal(2n); // Released
  });

  // 13 ────────────────────────────────────────────────────────────────────────
  it("non-provider cannot auto-release milestone", async function () {
    const { v4, client } = await networkHelpers.loadFixture(submittedMilestoneFixture);
    await networkHelpers.time.increase(REVIEW_PERIOD + 1);
    await expect(v4.connect(client).claimMilestoneAfterReview(0))
      .to.be.revertedWith("Only provider");
  });

  // 14 ────────────────────────────────────────────────────────────────────────
  it("client cannot refund a submitted milestone", async function () {
    const { v4, client } = await networkHelpers.loadFixture(submittedMilestoneFixture);
    // Advance far past any deadline or grace period
    await networkHelpers.time.increase(REVIEW_PERIOD + 1000);
    await expect(v4.connect(client).refundExpiredMilestone(0))
      .to.be.revertedWith("Milestone not pending");
  });

  // 15 ────────────────────────────────────────────────────────────────────────
  it("either party can propose milestone settlement when disputed", async function () {
    const { v4, client, provider, amounts } = await networkHelpers.loadFixture(disputedMilestoneFixture);

    // Provider proposes
    await expect(
      v4.connect(provider).proposeMilestoneSettlement(0, amounts[0] / 2n, "50/50 split"),
    ).to.emit(v4, "MilestoneSettlementProposed");

    let proposal = await v4.getMilestoneSettlementProposal(0);
    expect(proposal.exists).to.equal(true);
    expect(proposal.proposer).to.equal(provider.address);

    // Client overwrites with their own proposal
    await expect(
      v4.connect(client).proposeMilestoneSettlement(0, 0n, "all back to client"),
    ).to.emit(v4, "MilestoneSettlementProposed");

    proposal = await v4.getMilestoneSettlementProposal(0);
    expect(proposal.proposer).to.equal(client.address);
    expect(proposal.providerAmount).to.equal(0n);
  });

  // 16 ────────────────────────────────────────────────────────────────────────
  it("milestone settlement reverts when provider amount exceeds milestone amount", async function () {
    const { v4, client, amounts } = await networkHelpers.loadFixture(disputedMilestoneFixture);
    await expect(
      v4.connect(client).proposeMilestoneSettlement(0, amounts[0] + 1n, "bad"),
    ).to.be.revertedWith("Provider amount exceeds milestone amount");
  });

  // 17 ────────────────────────────────────────────────────────────────────────
  it("proposal creator cannot accept their own milestone settlement", async function () {
    const { v4, provider, amounts } = await networkHelpers.loadFixture(disputedMilestoneFixture);

    await v4.connect(provider).proposeMilestoneSettlement(0, amounts[0] / 2n, "split");

    await expect(v4.connect(provider).acceptMilestoneSettlement(0))
      .to.be.revertedWith("Cannot accept own proposal");
  });

  // 18 ────────────────────────────────────────────────────────────────────────
  it("counterparty can accept milestone settlement", async function () {
    const { v4, client, provider, amounts } = await networkHelpers.loadFixture(disputedMilestoneFixture);

    const pAmount = amounts[0] / 2n;
    const cAmount = amounts[0] - pAmount;

    await v4.connect(provider).proposeMilestoneSettlement(0, pAmount, "50/50");

    const tx = v4.connect(client).acceptMilestoneSettlement(0);
    await expect(tx)
      .to.emit(v4, "MilestoneSettlementAccepted")
      .withArgs(0n, pAmount, cAmount);
  });

  // 19 ────────────────────────────────────────────────────────────────────────
  it("milestone settlement correctly splits funds between provider and client", async function () {
    const { v4, client, provider, amounts } = await networkHelpers.loadFixture(disputedMilestoneFixture);

    const pAmount = amounts[0] * 3n / 4n; // 75% to provider
    const cAmount = amounts[0] - pAmount;  // 25% to client

    await v4.connect(provider).proposeMilestoneSettlement(0, pAmount, "75/25");
    const tx = v4.connect(client).acceptMilestoneSettlement(0);

    await expect(tx).to.changeEtherBalance(ethers, provider, pAmount);
    await expect(tx).to.changeEtherBalance(ethers, client, cAmount);

    expect((await v4.getMilestone(0))[5]).to.equal(5n); // Settled

    const settlementProposal = await v4.getMilestoneSettlementProposal(0);
    expect(settlementProposal.exists).to.equal(false);
  });

  // 20 ────────────────────────────────────────────────────────────────────────
  it("milestone settlement updates releasedAmount and refundedAmount", async function () {
    const { v4, client, provider, amounts } = await networkHelpers.loadFixture(disputedMilestoneFixture);

    const pAmount = amounts[0] / 2n;
    const cAmount = amounts[0] - pAmount;

    await v4.connect(provider).proposeMilestoneSettlement(0, pAmount, "split");
    await v4.connect(client).acceptMilestoneSettlement(0);

    expect(await v4.releasedAmount()).to.equal(pAmount);
    expect(await v4.refundedAmount()).to.equal(cAmount);
  });

  // 21 ────────────────────────────────────────────────────────────────────────
  it("proposal creator can cancel milestone settlement proposal", async function () {
    const { v4, client, amounts } = await networkHelpers.loadFixture(disputedMilestoneFixture);

    await v4.connect(client).proposeMilestoneSettlement(0, 0n, "all back to me");
    await expect(v4.connect(client).cancelMilestoneSettlement(0))
      .to.emit(v4, "MilestoneSettlementCancelled")
      .withArgs(0n);

    const proposal = await v4.getMilestoneSettlementProposal(0);
    expect(proposal.exists).to.equal(false);

    // Milestone remains Disputed
    expect((await v4.getMilestone(0))[5]).to.equal(4n);
  });

  // 22 ────────────────────────────────────────────────────────────────────────
  it("cannot settle milestone twice", async function () {
    const { v4, client, provider, amounts } = await networkHelpers.loadFixture(disputedMilestoneFixture);

    await v4.connect(provider).proposeMilestoneSettlement(0, amounts[0], "all to provider");
    await v4.connect(client).acceptMilestoneSettlement(0);

    // State is now Settled — cannot propose or accept again
    await expect(
      v4.connect(client).proposeMilestoneSettlement(0, 0n, "retry"),
    ).to.be.revertedWith("Milestone not disputed");
    await expect(
      v4.connect(provider).acceptMilestoneSettlement(0),
    ).to.be.revertedWith("Milestone not disputed");
  });

  // 23 ────────────────────────────────────────────────────────────────────────
  it("disputed milestone blocks agreement completion until settled", async function () {
    const { v4, client, provider } =
      await networkHelpers.loadFixture(disputedMilestoneFixture);

    // While milestone 0 is Disputed, provider cannot submit milestone 1
    await expect(v4.connect(provider).submitMilestone(1, "ipfs://m1"))
      .to.be.revertedWith("Previous milestone not released");

    expect(await v4.isAgreementCompleted()).to.equal(false);

    // Settle milestone 0 — all back to client
    await v4.connect(provider).proposeMilestoneSettlement(0, 0n, "all back");
    await v4.connect(client).acceptMilestoneSettlement(0);

    // Milestone 0 is now Settled; provider can submit milestone 1
    await v4.connect(provider).submitMilestone(1, "ipfs://m1");
    // Agreement still not complete — milestones 1 and 2 are pending
    expect(await v4.isAgreementCompleted()).to.equal(false);
  });

  // 24 ────────────────────────────────────────────────────────────────────────
  it("provider auto-release completes agreement when all milestones resolved", async function () {
    const { v4, client, provider, amounts } = await networkHelpers.loadFixture(fundedV4Fixture);

    // Submit and auto-release all three milestones sequentially
    for (let i = 0; i < 3; i++) {
      await v4.connect(provider).submitMilestone(i, `ipfs://m${i}`);
      await networkHelpers.time.increase(REVIEW_PERIOD + 1);
      await v4.connect(provider).claimMilestoneAfterReview(i);
    }

    expect(await v4.isAgreementCompleted()).to.equal(true);
    expect(await v4.agreementState()).to.equal(3n); // Completed
  });

  // 25 ────────────────────────────────────────────────────────────────────────
  it("adjustment review/dispute/auto-release flow works", async function () {
    const { v4, client, provider, adjAmount } =
      await networkHelpers.loadFixture(fundedAdjustmentV4Fixture);

    // Submit adjustment
    await v4.connect(provider).submitAdjustment(0, "ipfs://adj-proof");
    expect((await v4.getAdjustment(0))[6]).to.equal(3n); // Submitted

    // Try dispute during review period
    await v4.connect(client).disputeAdjustment(0, "Incomplete adjustment");
    expect((await v4.getAdjustment(0))[6]).to.equal(7n); // Disputed

    const dispute = await v4.getAdjustmentDispute(0);
    expect(dispute.exists).to.equal(true);
    expect(dispute.reason).to.equal("Incomplete adjustment");

    // Settle the adjustment dispute
    await v4.connect(provider).proposeAdjustmentSettlement(0, adjAmount / 2n, "half-half");
    const tx = v4.connect(client).acceptAdjustmentSettlement(0);
    await expect(tx).to.emit(v4, "AdjustmentSettlementAccepted");

    expect((await v4.getAdjustment(0))[6]).to.equal(8n); // Settled
  });

  // 26 ────────────────────────────────────────────────────────────────────────
  it("adjustment settlement correctly splits funds and updates adjustment accounting", async function () {
    const { v4, client, provider, adjAmount } =
      await networkHelpers.loadFixture(fundedAdjustmentV4Fixture);

    await v4.connect(provider).submitAdjustment(0, "ipfs://adj-proof");
    await v4.connect(client).disputeAdjustment(0, "Insufficient work");

    const pAmount = adjAmount * 3n / 4n;
    const cAmount = adjAmount - pAmount;

    await v4.connect(provider).proposeAdjustmentSettlement(0, pAmount, "75% provider");
    const tx = v4.connect(client).acceptAdjustmentSettlement(0);

    await expect(tx).to.changeEtherBalance(ethers, provider, pAmount);
    await expect(tx).to.changeEtherBalance(ethers, client, cAmount);

    expect(await v4.adjustmentReleasedAmount()).to.equal(pAmount);
    expect(await v4.adjustmentRefundedAmount()).to.equal(cAmount);

    const proposal = await v4.getAdjustmentSettlementProposal(0);
    expect(proposal.exists).to.equal(false);
  });

  // 27 ────────────────────────────────────────────────────────────────────────
  it("multiple adjustments and milestones can resolve independently", async function () {
    const { v4, client, provider, amounts } = await networkHelpers.loadFixture(fundedV4Fixture);

    // Submit and dispute milestone 0
    await v4.connect(provider).submitMilestone(0, "ipfs://m0");
    await v4.connect(client).disputeMilestone(0, "incomplete");
    // Settle milestone 0
    await v4.connect(client).proposeMilestoneSettlement(0, 0n, "all back to client");
    await v4.connect(provider).acceptMilestoneSettlement(0);
    // Milestone 0 is now Settled — provider can proceed

    // Submit milestone 1 (previous is Settled ✓), approve normally
    await v4.connect(provider).submitMilestone(1, "ipfs://m1");
    await v4.connect(client).approveMilestone(1);

    // Milestone 2: submit, let review period expire, auto-release
    await v4.connect(provider).submitMilestone(2, "ipfs://m2");
    await networkHelpers.time.increase(REVIEW_PERIOD + 1);
    await v4.connect(provider).claimMilestoneAfterReview(2);

    expect(await v4.isAgreementCompleted()).to.equal(true);
  });

  // 28 ────────────────────────────────────────────────────────────────────────
  it("agreement completion requires all milestones and adjustments to be terminal", async function () {
    const { v4, client, provider } =
      await networkHelpers.loadFixture(fundedAdjustmentV4Fixture);

    // Approve milestone 0 (already submitted in the fixture)
    await v4.connect(client).approveMilestone(0);

    // Submit and approve milestones 1 and 2
    await v4.connect(provider).submitMilestone(1, "ipfs://m1");
    await v4.connect(client).approveMilestone(1);
    await v4.connect(provider).submitMilestone(2, "ipfs://m2");
    await v4.connect(client).approveMilestone(2);

    // All milestones done but adjustment 0 is still Funded — not complete
    expect(await v4.isAgreementCompleted()).to.equal(false);

    // Submit the adjustment then approve it
    await v4.connect(provider).submitAdjustment(0, "ipfs://adj0");
    await v4.connect(client).approveAdjustment(0);

    expect(await v4.isAgreementCompleted()).to.equal(true);
  });

  // 29 ────────────────────────────────────────────────────────────────────────
  it("V1/V2/V3 contracts still deploy and work unchanged", async function () {
    const [client, provider] = await ethers.getSigners();
    const now = await networkHelpers.time.latest();

    // V1
    const v1 = (await ethers.deployContract(
      "DealLock",
      [provider.address, ["Step"], [ethers.parseEther("1")], [now + 1000]],
      client,
    )) as unknown as DealLockV4Contract;
    await v1.waitForDeployment();
    await v1.connect(provider).acceptAgreement();
    await v1.connect(client).fundAgreement({ value: ethers.parseEther("1") });
    await v1.connect(provider).submitMilestone(0, "ipfs://v1");
    await v1.connect(client).approveMilestone(0);
    expect(await v1.isAgreementCompleted()).to.equal(true);

    // V2
    const v2 = (await ethers.deployContract(
      "DealLockV2",
      [provider.address, ["Step"], [ethers.parseEther("1")], [now + 1000]],
      client,
    )) as unknown as DealLockV4Contract;
    await v2.waitForDeployment();
    await v2.connect(provider).acceptAgreement();
    await v2.connect(client).fundAgreement({ value: ethers.parseEther("1") });
    await v2.connect(provider).submitMilestone(0, "ipfs://v2");
    await v2.connect(client).approveMilestone(0);
    expect(await v2.isAgreementCompleted()).to.equal(true);

    // V3
    const v3 = (await ethers.deployContract(
      "DealLockV3",
      [provider.address, ["Step"], [ethers.parseEther("1")], [now + 1000]],
      client,
    )) as unknown as DealLockV4Contract;
    await v3.waitForDeployment();
    await v3.connect(provider).acceptAgreement();
    await v3.connect(client).fundAgreement({ value: ethers.parseEther("1") });
    await v3.connect(provider).submitMilestone(0, "ipfs://v3");
    await v3.connect(client).approveMilestone(0);
    expect(await v3.isAgreementCompleted()).to.equal(true);
  });
});

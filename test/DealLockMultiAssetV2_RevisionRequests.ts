import "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { expect } from "chai";
import hre from "hardhat";
import type { Contract, ContractRunner } from "ethers";

type C = Omit<Contract, "connect"> & { connect(runner: null | ContractRunner): C };

const { ethers, networkHelpers } = await hre.network.create();

const REVIEW = 3 * 24 * 60 * 60;
const REVISION_RESPONSE = 3 * 24 * 60 * 60;
const USDC = 1_000_000n;

async function deadlines(offset = 1000) {
  const now = await networkHelpers.time.latest();
  return [now + offset, now + offset * 2];
}

async function deployAgreement(paymentToken = ethers.ZeroAddress, amountUnit = ethers.parseEther("1")) {
  const [client, provider, other] = await ethers.getSigners();
  const amounts = [amountUnit, amountUnit * 2n];
  const agreement = (await ethers.deployContract(
    "DealLockMultiAssetV2",
    [
      client.address,
      provider.address,
      paymentToken,
      ["Alpha", "Beta"],
      amounts,
      (await deadlines()).slice(0, amounts.length),
      REVIEW,
    ],
    client,
  )) as C;
  await agreement.waitForDeployment();
  return { agreement, client, provider, other, amounts, total: amounts.reduce((a, b) => a + b, 0n) };
}

async function fundedFixture() {
  const f = await deployAgreement();
  await f.agreement.connect(f.provider).acceptAgreement();
  await f.agreement.connect(f.client).fundAgreement({ value: f.total });
  return f;
}

async function submittedFixture() {
  const f = await fundedFixture();
  await f.agreement.connect(f.provider).submitMilestone(0, "initial-proof");
  return f;
}

async function revisionDeadlineTs(offset = 2 * 24 * 60 * 60) {
  const now = await networkHelpers.time.latest();
  return BigInt(now + offset);
}

describe("DealLockMultiAssetV2 revision requests", function () {
  it("client can request revision during review period", async () => {
    const { agreement, client } = await submittedFixture();
    const revDl = await revisionDeadlineTs();
    await expect(
      agreement.connect(client).requestMilestoneRevision(0, "Needs edge case handling", revDl),
    )
      .to.emit(agreement, "MilestoneRevisionRequested")
      .withArgs(0n, 1n, "Needs edge case handling", revDl);

    expect((await agreement.getMilestone(0)).state).to.equal(6n);
    const rev = await agreement.getMilestoneRevision(0);
    expect(rev.exists).to.equal(true);
    expect(rev.reason).to.equal("Needs edge case handling");
    expect(rev.revisionDeadline).to.equal(revDl);
    expect(rev.revisionRound).to.equal(1n);
  });

  it("client cannot request revision after review period", async () => {
    const { agreement, client } = await submittedFixture();
    const milestone = await agreement.getMilestone(0);
    await networkHelpers.time.increaseTo(milestone.submittedAt + BigInt(REVIEW) + 1n);

    await expect(
      agreement.connect(client).requestMilestoneRevision(0, "Too late", await revisionDeadlineTs()),
    ).to.be.revertedWith("Review period expired");
  });

  it("provider accepts revision and milestone returns to pending with new deadline", async () => {
    const { agreement, client, provider } = await submittedFixture();
    const revDl = await revisionDeadlineTs();
    await agreement.connect(client).requestMilestoneRevision(0, "Fix the edge case", revDl);

    await expect(agreement.connect(provider).acceptMilestoneRevision(0))
      .to.emit(agreement, "MilestoneRevisionAccepted")
      .withArgs(0n, 1n, revDl);

    const m = await agreement.getMilestone(0);
    expect(m.state).to.equal(0n);
    expect(m.deadline).to.equal(revDl);
    expect(m.submittedAt).to.equal(0n);
    expect(m.proof).to.equal("");
    expect(await agreement.getMilestoneRevisionCount(0)).to.equal(1n);

    const rev = await agreement.getMilestoneRevision(0);
    expect(rev.exists).to.equal(false);
  });

  it("provider can resubmit after accepting revision", async () => {
    const { agreement, client, provider } = await submittedFixture();
    const revDl = await revisionDeadlineTs();
    await agreement.connect(client).requestMilestoneRevision(0, "Fix it", revDl);
    await agreement.connect(provider).acceptMilestoneRevision(0);

    await agreement.connect(provider).submitMilestone(0, "revised-proof");
    expect((await agreement.getMilestone(0)).state).to.equal(1n);
    expect((await agreement.getMilestone(0)).proof).to.equal("revised-proof");
  });

  it("supports multiple revision rounds with revisionCount tracking", async () => {
    const { agreement, client, provider } = await submittedFixture();

    // Round 1
    await agreement.connect(client).requestMilestoneRevision(0, "Fix round 1", await revisionDeadlineTs());
    await agreement.connect(provider).acceptMilestoneRevision(0);
    expect(await agreement.getMilestoneRevisionCount(0)).to.equal(1n);

    // Resubmit
    await agreement.connect(provider).submitMilestone(0, "proof-v2");

    // Round 2
    await agreement.connect(client).requestMilestoneRevision(0, "Fix round 2", await revisionDeadlineTs(3 * 24 * 3600));
    expect((await agreement.getMilestoneRevision(0)).revisionRound).to.equal(2n);
    await agreement.connect(provider).acceptMilestoneRevision(0);
    expect(await agreement.getMilestoneRevisionCount(0)).to.equal(2n);

    // Final approval
    await agreement.connect(provider).submitMilestone(0, "proof-v3");
    await agreement.connect(client).approveMilestone(0);
    expect((await agreement.getMilestone(0)).state).to.equal(2n);
    expect(await agreement.getMilestoneRevisionCount(0)).to.equal(2n);
  });

  it("provider can request a different deadline but it does not update the milestone deadline", async () => {
    const { agreement, client, provider } = await submittedFixture();
    const revDl = await revisionDeadlineTs(2 * 24 * 3600);
    await agreement.connect(client).requestMilestoneRevision(0, "Fix it", revDl);

    const providerProposed = revDl + BigInt(7 * 24 * 3600);
    await expect(
      agreement.connect(provider).requestRevisionDeadline(0, providerProposed, "Need more time for edge cases"),
    )
      .to.emit(agreement, "MilestoneRevisionDeadlineRequested")
      .withArgs(0n, 1n, providerProposed, "Need more time for edge cases");

    const rev = await agreement.getMilestoneRevision(0);
    expect(rev.providerDeadlineRequestExists).to.equal(true);
    expect(rev.providerRequestedDeadline).to.equal(providerProposed);
    expect(rev.revisionDeadline).to.equal(revDl);
  });

  it("exposes revision response deadline and blocks client escalation before timeout", async () => {
    const { agreement, client } = await submittedFixture();
    const revDl = await revisionDeadlineTs();
    await agreement.connect(client).requestMilestoneRevision(0, "Fix it", revDl);

    const rev = await agreement.getMilestoneRevision(0);
    expect(await agreement.REVISION_RESPONSE_PERIOD()).to.equal(BigInt(REVISION_RESPONSE));
    expect(await agreement.getMilestoneRevisionResponseDeadline(0))
      .to.equal(rev.requestedAt + BigInt(REVISION_RESPONSE));

    await expect(
      agreement.connect(client).escalateMilestoneRevisionToDispute(0, "Provider has not responded"),
    ).to.be.revertedWith("Revision response period active");
  });

  it("client can escalate ignored revision request to dispute after response period", async () => {
    const { agreement, client } = await submittedFixture();
    await agreement.connect(client).requestMilestoneRevision(0, "Fix it", await revisionDeadlineTs());

    const responseDeadline = await agreement.getMilestoneRevisionResponseDeadline(0);
    await networkHelpers.time.increaseTo(responseDeadline + 1n);

    await expect(
      agreement.connect(client).escalateMilestoneRevisionToDispute(0, "No provider response"),
    )
      .to.emit(agreement, "MilestoneRevisionEscalated")
      .withArgs(0n, 1n, "No provider response");

    expect((await agreement.getMilestone(0)).state).to.equal(4n);
    const dispute = await agreement.getMilestoneDispute(0);
    expect(dispute.exists).to.equal(true);
    expect(dispute.openedBy).to.equal(client.address);
    expect(dispute.reason).to.equal("No provider response");
    expect((await agreement.getMilestoneRevision(0)).exists).to.equal(false);
  });

  it("settlement works after client escalates an ignored revision request", async () => {
    const { agreement, client, provider, amounts } = await submittedFixture();
    await agreement.connect(client).requestMilestoneRevision(0, "Fix it", await revisionDeadlineTs());
    await networkHelpers.time.increaseTo((await agreement.getMilestoneRevisionResponseDeadline(0)) + 1n);
    await agreement.connect(client).escalateMilestoneRevisionToDispute(0, "No provider response");

    await agreement.connect(provider).proposeMilestoneSettlement(0, amounts[0] / 2n, "split");
    await agreement.connect(client).acceptMilestoneSettlement(0);
    expect((await agreement.getMilestone(0)).state).to.equal(5n);
  });

  it("direct dispute remains available during V6 review period", async () => {
    const { agreement, client } = await submittedFixture();

    await expect(agreement.connect(client).disputeMilestone(0, "Escalate directly"))
      .to.emit(agreement, "MilestoneDisputed")
      .withArgs(0n, "Escalate directly");

    expect((await agreement.getMilestone(0)).state).to.equal(4n);
  });

  it("client can update revision deadline and provider accepts with the updated deadline", async () => {
    const { agreement, client, provider } = await submittedFixture();
    const deadlineA = await revisionDeadlineTs(2 * 24 * 3600);
    await agreement.connect(client).requestMilestoneRevision(0, "Fix it", deadlineA);

    const deadlineC = deadlineA + BigInt(5 * 24 * 3600);
    await expect(agreement.connect(client).setRevisionDeadline(0, deadlineC))
      .to.emit(agreement, "MilestoneRevisionDeadlineUpdated")
      .withArgs(0n, 1n, deadlineC);

    expect((await agreement.getMilestoneRevision(0)).revisionDeadline).to.equal(deadlineC);

    await agreement.connect(provider).acceptMilestoneRevision(0);
    expect((await agreement.getMilestone(0)).deadline).to.equal(deadlineC);
  });

  it("provider rejects revision and milestone becomes disputed", async () => {
    const { agreement, client, provider } = await submittedFixture();
    await agreement.connect(client).requestMilestoneRevision(0, "Fix it", await revisionDeadlineTs());

    await expect(
      agreement.connect(provider).rejectMilestoneRevision(0, "Work is complete as agreed"),
    )
      .to.emit(agreement, "MilestoneRevisionRejected")
      .withArgs(0n, 1n, "Work is complete as agreed");

    expect((await agreement.getMilestone(0)).state).to.equal(4n);
    const dispute = await agreement.getMilestoneDispute(0);
    expect(dispute.exists).to.equal(true);
    expect(dispute.reason).to.equal("Work is complete as agreed");
    expect((await agreement.getMilestoneRevision(0)).exists).to.equal(false);
  });

  it("provider cannot auto-claim while revision is requested", async () => {
    const { agreement, client, provider } = await submittedFixture();
    await agreement.connect(client).requestMilestoneRevision(0, "Fix it", await revisionDeadlineTs());

    const milestone = await agreement.getMilestone(0);
    await networkHelpers.time.increaseTo(milestone.submittedAt + BigInt(REVIEW) + 1n);

    await expect(
      agreement.connect(provider).claimMilestoneAfterReview(0),
    ).to.be.revertedWith("Milestone not submitted");
  });

  it("settlement works after provider rejects revision (milestone disputed)", async () => {
    const { agreement, client, provider, amounts } = await submittedFixture();
    await agreement.connect(client).requestMilestoneRevision(0, "Fix it", await revisionDeadlineTs());
    await agreement.connect(provider).rejectMilestoneRevision(0, "Work is done");

    expect((await agreement.getMilestone(0)).state).to.equal(4n);

    await agreement.connect(client).proposeMilestoneSettlement(0, amounts[0] / 2n, "split");
    await agreement.connect(provider).acceptMilestoneSettlement(0);
    expect((await agreement.getMilestone(0)).state).to.equal(5n);
  });

  it("paid adjustment remains separate from revision request", async () => {
    const f = await submittedFixture();

    // Client approves original milestone
    await f.agreement.connect(f.client).approveMilestone(0);
    expect((await f.agreement.getMilestone(0)).state).to.equal(2n);

    // Client requests a paid adjustment
    const adjDl = BigInt(await networkHelpers.time.latest()) + 1000n;
    await f.agreement.connect(f.client).requestAdjustment(0, "Extra feature", ethers.parseEther("0.5"), adjDl);
    await f.agreement.connect(f.provider).acceptAdjustment(0);
    await f.agreement.connect(f.client).fundAdjustment(0, { value: ethers.parseEther("0.5") });

    expect((await f.agreement.getMilestone(0)).state).to.equal(2n);
    expect((await f.agreement.getAdjustment(0)).state).to.equal(2n);
  });

  it("guards: empty reason, not-submitted state, provider-only request deadline", async () => {
    const { agreement, client, provider } = await submittedFixture();

    await expect(
      agreement.connect(client).requestMilestoneRevision(0, "", await revisionDeadlineTs()),
    ).to.be.revertedWith("Empty reason");

    await expect(
      agreement.connect(client).requestRevisionDeadline(0, await revisionDeadlineTs(), "wrong caller"),
    ).to.be.revertedWith("Only provider");

    await agreement.connect(client).requestMilestoneRevision(0, "Fix it", await revisionDeadlineTs());

    await expect(
      agreement.connect(provider).rejectMilestoneRevision(0, ""),
    ).to.be.revertedWith("Empty reason");

    await expect(
      agreement.connect(provider).requestRevisionDeadline(0, 1n, "bad deadline"),
    ).to.be.revertedWith("Deadline must be future");
  });
});

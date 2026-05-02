import "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { expect } from "chai";
import hre from "hardhat";
import type { Contract, ContractRunner } from "ethers";

type C = Omit<Contract, "connect"> & { connect(runner: null | ContractRunner): C };

const { ethers, networkHelpers } = await hre.network.create();

const REVIEW = 3 * 24 * 60 * 60;
const GRACE = 30 * 60;
const USDC = 1_000_000n;
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
const CREATION_CODE_CHUNK_BYTES = 24_000;

function splitBytecode(bytecode: string) {
  const hex = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
  const splitAt = CREATION_CODE_CHUNK_BYTES * 2;
  return [`0x${hex.slice(0, splitAt)}`, hex.length > splitAt ? `0x${hex.slice(splitAt)}` : "0x"] as const;
}

async function deadlines(offset = 1000) {
  const now = await networkHelpers.time.latest();
  return [now + offset, now + offset * 2, now + offset * 3];
}

async function deployToken() {
  const token = (await ethers.deployContract("MockUSDC")) as C;
  await token.waitForDeployment();
  return token;
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

async function fundedEthFixture() {
  const f = await deployAgreement();
  await f.agreement.connect(f.provider).acceptAgreement();
  await f.agreement.connect(f.client).fundAgreement({ value: f.total });
  return f;
}

async function fundedTokenFixture() {
  const token = await deployToken();
  const f = await deployAgreement(await token.getAddress(), 100n * USDC);
  await token.mint(f.client.address, f.total + 1000n * USDC);
  await f.agreement.connect(f.provider).acceptAgreement();
  await token.connect(f.client).approve(await f.agreement.getAddress(), f.total);
  await f.agreement.connect(f.client).fundAgreement();
  return { ...f, token };
}

async function deadlineOf(agreement: C, milestoneId = 0): Promise<bigint> {
  const milestone = await agreement.getMilestone(milestoneId);
  return milestone.deadline as bigint;
}

async function createFundedAdjustment(f?: Awaited<ReturnType<typeof fundedEthFixture>>) {
  const fixture = f ?? await fundedEthFixture();
  const deadline = BigInt(await networkHelpers.time.latest()) + 1000n;
  await fixture.agreement.connect(fixture.client).requestAdjustment(0, "Extra scope", ethers.parseEther("0.25"), deadline);
  await fixture.agreement.connect(fixture.provider).acceptAdjustment(0);
  await fixture.agreement.connect(fixture.client).fundAdjustment(0, { value: ethers.parseEther("0.25") });
  return { ...fixture, adjustmentDeadline: deadline };
}

describe("DealLockMultiAssetV2 deadline extensions", function () {
  it("reports protocol version 6 and a 30-minute grace alias", async () => {
    const { agreement } = await deployAgreement();
    expect(await agreement.contractVersion()).to.equal(6n);
    expect(await agreement.DEADLINE_GRACE_PERIOD()).to.equal(1800n);
    expect(await agreement.REFUND_GRACE_PERIOD()).to.equal(1800n);
  });

  it("allows milestone submission before deadline and during the grace window", async () => {
    const f1 = await fundedEthFixture();
    await f1.agreement.connect(f1.provider).submitMilestone(0, "before-deadline");
    expect((await f1.agreement.getMilestone(0)).state).to.equal(1n);

    const f2 = await fundedEthFixture();
    const deadline = await deadlineOf(f2.agreement);
    await networkHelpers.time.increaseTo(deadline + 10n);
    await f2.agreement.connect(f2.provider).submitMilestone(0, "inside-grace");
    expect((await f2.agreement.getMilestone(0)).state).to.equal(1n);
  });

  it("blocks milestone submission after the grace window", async () => {
    const { agreement, provider } = await fundedEthFixture();
    const deadline = await deadlineOf(agreement);
    await networkHelpers.time.increaseTo(deadline + BigInt(GRACE) + 1n);
    await expect(agreement.connect(provider).submitMilestone(0, "late")).to.be.revertedWith("Submission window closed");
  });

  it("blocks refund during grace and allows refund after grace", async () => {
    const { agreement, client, amounts } = await fundedEthFixture();
    const deadline = await deadlineOf(agreement);
    await networkHelpers.time.increaseTo(deadline + 10n);
    await expect(agreement.connect(client).refundExpiredMilestone(0)).to.be.revertedWith("Refund not available yet");

    await networkHelpers.time.increaseTo(deadline + BigInt(GRACE));
    await expect(agreement.connect(client).refundExpiredMilestone(0))
      .to.emit(agreement, "MilestoneRefunded")
      .withArgs(0n, amounts[0]);
  });

  it("lets provider request, replace, cancel, and client reject milestone extensions", async () => {
    const { agreement, provider, client } = await fundedEthFixture();
    const deadline = await deadlineOf(agreement);
    await networkHelpers.time.increaseTo(deadline + 5n);

    await expect(agreement.connect(provider).requestMilestoneDeadlineExtension(0, deadline + 3600n, "Need one hour"))
      .to.emit(agreement, "MilestoneDeadlineExtensionRequested")
      .withArgs(0n, deadline, deadline + 3600n, "Need one hour");
    expect((await agreement.getMilestoneDeadlineExtensionRequest(0)).active).to.equal(true);

    await agreement.connect(provider).requestMilestoneDeadlineExtension(0, deadline + 7200n, "Need two hours");
    expect((await agreement.getMilestoneDeadlineExtensionRequest(0)).proposedDeadline).to.equal(deadline + 7200n);

    await expect(agreement.connect(provider).cancelMilestoneDeadlineExtension(0))
      .to.emit(agreement, "MilestoneDeadlineExtensionCancelled")
      .withArgs(0n);
    expect((await agreement.getMilestoneDeadlineExtensionRequest(0)).active).to.equal(false);

    await agreement.connect(provider).requestMilestoneDeadlineExtension(0, deadline + 3600n, "Need one hour");
    await expect(agreement.connect(client).rejectMilestoneDeadlineExtension(0))
      .to.emit(agreement, "MilestoneDeadlineExtensionRejected")
      .withArgs(0n);
    expect((await agreement.getMilestoneDeadlineExtensionRequest(0)).active).to.equal(false);
  });

  it("enforces milestone extension request guards", async () => {
    const { agreement, provider, client } = await fundedEthFixture();
    const deadline = await deadlineOf(agreement);
    await expect(agreement.connect(provider).requestMilestoneDeadlineExtension(0, deadline + 1n, ""))
      .to.be.revertedWith("Empty reason");
    await expect(agreement.connect(provider).requestMilestoneDeadlineExtension(0, deadline, "same"))
      .to.be.revertedWith("Proposed deadline must be later");

    await agreement.connect(provider).requestMilestoneDeadlineExtension(0, deadline + 3600n, "Need time");
    await expect(agreement.connect(provider).acceptMilestoneDeadlineExtension(0)).to.be.revertedWith("Only client");
    await agreement.connect(client).acceptMilestoneDeadlineExtension(0);

    await networkHelpers.time.increaseTo(deadline + 3600n + BigInt(GRACE) + 1n);
    await expect(agreement.connect(provider).requestMilestoneDeadlineExtension(0, deadline + 7200n, "Too late"))
      .to.be.revertedWith("Submission window closed");
  });

  it("accepted milestone extension updates refund timing and request alone does not block refund", async () => {
    const f1 = await fundedEthFixture();
    const deadline1 = await deadlineOf(f1.agreement);
    await f1.agreement.connect(f1.provider).requestMilestoneDeadlineExtension(0, deadline1 + 3600n, "Need time");
    await f1.agreement.connect(f1.client).acceptMilestoneDeadlineExtension(0);
    expect(await deadlineOf(f1.agreement)).to.equal(deadline1 + 3600n);
    await networkHelpers.time.increaseTo(deadline1 + BigInt(GRACE));
    await expect(f1.agreement.connect(f1.client).refundExpiredMilestone(0)).to.be.revertedWith("Refund not available yet");
    await networkHelpers.time.increaseTo(deadline1 + 3600n + BigInt(GRACE));
    await expect(f1.agreement.connect(f1.client).refundExpiredMilestone(0)).to.emit(f1.agreement, "MilestoneRefunded");

    const f2 = await fundedEthFixture();
    const deadline2 = await deadlineOf(f2.agreement);
    await f2.agreement.connect(f2.provider).requestMilestoneDeadlineExtension(0, deadline2 + 3600n, "Ignore me");
    await networkHelpers.time.increaseTo(deadline2 + BigInt(GRACE));
    await expect(f2.agreement.connect(f2.client).refundExpiredMilestone(0)).to.emit(f2.agreement, "MilestoneRefunded");
    await expect(f2.agreement.connect(f2.client).acceptMilestoneDeadlineExtension(0)).to.be.revertedWith("Milestone not pending");
  });

  it("does not allow accepting milestone extensions after submitted, released, disputed, or settled states", async () => {
    const submitted = await fundedEthFixture();
    const submittedDeadline = await deadlineOf(submitted.agreement);
    await submitted.agreement.connect(submitted.provider).requestMilestoneDeadlineExtension(0, submittedDeadline + 3600n, "Need time");
    await submitted.agreement.connect(submitted.provider).submitMilestone(0, "proof");
    await expect(submitted.agreement.connect(submitted.client).acceptMilestoneDeadlineExtension(0)).to.be.revertedWith("Milestone not pending");

    const released = await fundedEthFixture();
    const releasedDeadline = await deadlineOf(released.agreement);
    await released.agreement.connect(released.provider).requestMilestoneDeadlineExtension(0, releasedDeadline + 3600n, "Need time");
    await released.agreement.connect(released.provider).submitMilestone(0, "proof");
    await released.agreement.connect(released.client).approveMilestone(0);
    await expect(released.agreement.connect(released.client).acceptMilestoneDeadlineExtension(0)).to.be.revertedWith("Milestone not pending");

    const disputed = await fundedEthFixture();
    const disputedDeadline = await deadlineOf(disputed.agreement);
    await disputed.agreement.connect(disputed.provider).requestMilestoneDeadlineExtension(0, disputedDeadline + 3600n, "Need time");
    await disputed.agreement.connect(disputed.provider).submitMilestone(0, "proof");
    await disputed.agreement.connect(disputed.client).disputeMilestone(0, "bad");
    await expect(disputed.agreement.connect(disputed.client).acceptMilestoneDeadlineExtension(0)).to.be.revertedWith("Milestone not pending");

    const settled = await fundedEthFixture();
    const settledDeadline = await deadlineOf(settled.agreement);
    await settled.agreement.connect(settled.provider).requestMilestoneDeadlineExtension(0, settledDeadline + 3600n, "Need time");
    await settled.agreement.connect(settled.provider).submitMilestone(0, "proof");
    await settled.agreement.connect(settled.client).disputeMilestone(0, "bad");
    await settled.agreement.connect(settled.provider).proposeMilestoneSettlement(0, 1n, "split");
    await settled.agreement.connect(settled.client).acceptMilestoneSettlement(0);
    await expect(settled.agreement.connect(settled.client).acceptMilestoneDeadlineExtension(0)).to.be.revertedWith("Milestone not pending");
  });

  it("applies the same deadline window to adjustment submission and refund", async () => {
    const duringGrace = await createFundedAdjustment();
    await networkHelpers.time.increaseTo(duringGrace.adjustmentDeadline + 10n);
    await duringGrace.agreement.connect(duringGrace.provider).submitAdjustment(0, "adj-proof");
    expect((await duringGrace.agreement.getAdjustment(0)).state).to.equal(3n);

    const lateSubmit = await createFundedAdjustment();
    await networkHelpers.time.increaseTo(lateSubmit.adjustmentDeadline + BigInt(GRACE) + 1n);
    await expect(lateSubmit.agreement.connect(lateSubmit.provider).submitAdjustment(0, "late")).to.be.revertedWith("Submission window closed");

    const refund = await createFundedAdjustment();
    await networkHelpers.time.increaseTo(refund.adjustmentDeadline + 10n);
    await expect(refund.agreement.connect(refund.client).refundExpiredAdjustment(0)).to.be.revertedWith("Refund not available yet");
    await networkHelpers.time.increaseTo(refund.adjustmentDeadline + BigInt(GRACE));
    await expect(refund.agreement.connect(refund.client).refundExpiredAdjustment(0)).to.emit(refund.agreement, "AdjustmentRefunded");
  });

  it("supports adjustment extension request, accept, reject, cancel, and refund despite ignored request", async () => {
    const reject = await createFundedAdjustment();
    await reject.agreement.connect(reject.provider).requestAdjustmentDeadlineExtension(0, reject.adjustmentDeadline + 3600n, "Need time");
    await expect(reject.agreement.connect(reject.client).rejectAdjustmentDeadlineExtension(0))
      .to.emit(reject.agreement, "AdjustmentDeadlineExtensionRejected")
      .withArgs(0n);

    const cancel = await createFundedAdjustment();
    await cancel.agreement.connect(cancel.provider).requestAdjustmentDeadlineExtension(0, cancel.adjustmentDeadline + 3600n, "Need time");
    await expect(cancel.agreement.connect(cancel.provider).cancelAdjustmentDeadlineExtension(0))
      .to.emit(cancel.agreement, "AdjustmentDeadlineExtensionCancelled")
      .withArgs(0n);

    const accept = await createFundedAdjustment();
    await accept.agreement.connect(accept.provider).requestAdjustmentDeadlineExtension(0, accept.adjustmentDeadline + 3600n, "Need time");
    await expect(accept.agreement.connect(accept.client).acceptAdjustmentDeadlineExtension(0))
      .to.emit(accept.agreement, "AdjustmentDeadlineExtensionAccepted")
      .withArgs(0n, accept.adjustmentDeadline, accept.adjustmentDeadline + 3600n);
    expect((await accept.agreement.getAdjustment(0)).deadline).to.equal(accept.adjustmentDeadline + 3600n);

    const ignored = await createFundedAdjustment();
    await ignored.agreement.connect(ignored.provider).requestAdjustmentDeadlineExtension(0, ignored.adjustmentDeadline + 3600n, "Ignore me");
    await networkHelpers.time.increaseTo(ignored.adjustmentDeadline + BigInt(GRACE));
    await expect(ignored.agreement.connect(ignored.client).refundExpiredAdjustment(0)).to.emit(ignored.agreement, "AdjustmentRefunded");
  });

  it("enforces adjustment extension guards and terminal-state acceptance checks", async () => {
    const f = await createFundedAdjustment();
    await expect(f.agreement.connect(f.provider).requestAdjustmentDeadlineExtension(0, f.adjustmentDeadline + 1n, ""))
      .to.be.revertedWith("Empty reason");
    await expect(f.agreement.connect(f.provider).requestAdjustmentDeadlineExtension(0, f.adjustmentDeadline, "same"))
      .to.be.revertedWith("Proposed deadline must be later");
    await f.agreement.connect(f.provider).requestAdjustmentDeadlineExtension(0, f.adjustmentDeadline + 3600n, "Need time");
    await expect(f.agreement.connect(f.provider).acceptAdjustmentDeadlineExtension(0)).to.be.revertedWith("Only client");
    await f.agreement.connect(f.provider).submitAdjustment(0, "proof");
    await expect(f.agreement.connect(f.client).acceptAdjustmentDeadlineExtension(0)).to.be.revertedWith("Adjustment not funded");
  });

  it("keeps V5-equivalent ETH and ERC-20 payment behavior", async () => {
    const eth = await fundedEthFixture();
    await eth.agreement.connect(eth.provider).submitMilestone(0, "proof");
    await expect(eth.agreement.connect(eth.client).approveMilestone(0))
      .to.changeEtherBalance(ethers, eth.provider, eth.amounts[0]);

    const erc20 = await fundedTokenFixture();
    await erc20.agreement.connect(erc20.provider).submitMilestone(0, "proof");
    await erc20.agreement.connect(erc20.client).approveMilestone(0);
    expect(await erc20.token.balanceOf(erc20.provider.address)).to.equal(erc20.amounts[0]);
  });

  it("Factory V3 deploys V6 agreements with payment metadata", async () => {
    const [client, provider] = await ethers.getSigners();
    const token = await deployToken();
    const V6 = await ethers.getContractFactory("DealLockMultiAssetV2");
    const deployer = (await ethers.deployContract("DealLockMultiAssetV2Deployer", splitBytecode(V6.bytecode))) as C;
    await deployer.waitForDeployment();
    const factory = (await ethers.deployContract("DealLockFactoryV3", [await deployer.getAddress()])) as C;
    await factory.waitForDeployment();
    const deadline = BigInt(await networkHelpers.time.latest()) + 3600n;

    const data = factory.interface.encodeFunctionData("createAgreement", [
      provider.address,
      await token.getAddress(),
      ["USDC milestone"],
      [10n * USDC],
      [deadline],
      REVIEW,
      ZERO_BYTES32,
    ]);
    const tx = await client.sendTransaction({ to: await factory.getAddress(), data });
    const receipt = await tx.wait();
    const parsed = receipt!.logs
      .map((log: unknown) => {
        try {
          return factory.interface.parseLog(log as { topics: string[]; data: string });
        } catch {
          return null;
        }
      })
      .find((log: { name?: string } | null) => log?.name === "AgreementCreated");
    expect(parsed?.args.client).to.equal(client.address);
    expect(parsed?.args.provider).to.equal(provider.address);
    expect(parsed?.args.contractVersion).to.equal(6n);
    expect(parsed?.args.paymentToken).to.equal(await token.getAddress());
    expect(parsed?.args.totalAmount).to.equal(10n * USDC);

    const agreementAddress = await factory.getAgreement(0);
    const agreement = await ethers.getContractAt("DealLockMultiAssetV2", agreementAddress);
    expect(await agreement.contractVersion()).to.equal(6n);
    expect(await agreement.paymentToken()).to.equal(await token.getAddress());
    expect(await factory.factoryVersion()).to.equal(3n);
  });

  it("Factory V3 rejects accidental ETH sent to agreement creation", async () => {
    const [client, provider] = await ethers.getSigners();
    const V6 = await ethers.getContractFactory("DealLockMultiAssetV2");
    const deployer = (await ethers.deployContract("DealLockMultiAssetV2Deployer", splitBytecode(V6.bytecode))) as C;
    await deployer.waitForDeployment();
    const factory = (await ethers.deployContract("DealLockFactoryV3", [await deployer.getAddress()])) as C;
    await factory.waitForDeployment();
    const deadline = BigInt(await networkHelpers.time.latest()) + 3600n;

    let rejected = false;
    try {
      await client.sendTransaction({
        to: await factory.getAddress(),
        data: factory.interface.encodeFunctionData("createAgreement", [
          provider.address,
          ethers.ZeroAddress,
          ["ETH milestone"],
          [ethers.parseEther("0.01")],
          [deadline],
          REVIEW,
          ZERO_BYTES32,
        ]),
        value: 1n,
      });
    } catch {
      rejected = true;
    }
    expect(rejected).to.equal(true);
  });

  it("Factory V2 still deploys V5 agreements unchanged", async () => {
    const [client, provider] = await ethers.getSigners();
    const factory = (await ethers.deployContract("DealLockFactoryV2")) as C;
    await factory.waitForDeployment();
    const deadline = BigInt(await networkHelpers.time.latest()) + 3600n;
    await factory.connect(client).createAgreement(
      provider.address,
      ethers.ZeroAddress,
      ["ETH milestone"],
      [ethers.parseEther("0.01")],
      [deadline],
      REVIEW,
      ZERO_BYTES32,
    );
    const agreement = await ethers.getContractAt("DealLockMultiAsset", await factory.getAgreement(0));
    expect(await agreement.contractVersion()).to.equal(5n);
  });
});

import "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { expect } from "chai";
import hre from "hardhat";
import type { Contract, ContractRunner } from "ethers";

/** `connect` is typed as `BaseContract`; keep chained contract calls typed. */
type DealLockContract = Omit<Contract, "connect"> & {
  connect(runner: null | ContractRunner): DealLockContract;
};

const { ethers, networkHelpers } = await hre.network.connect();

describe("DealLock", function () {
  async function deployDealLockFixture() {
    const [client, provider, other] = await ethers.getSigners();

    const now = await networkHelpers.time.latest();

    const descriptions = ["Prototype", "Beta", "Final"];
    const amounts = [
      ethers.parseEther("1"),
      ethers.parseEther("2"),
      ethers.parseEther("3"),
    ];
    const deadlines = [now + 100, now + 200, now + 300];
    const totalAmount = amounts.reduce((a, b) => a + b, 0n);

    const dealLock = (await ethers.deployContract(
      "DealLock",
      [provider.address, descriptions, amounts, deadlines],
      client,
    )) as unknown as DealLockContract;

    await dealLock.waitForDeployment();

    return {
      dealLock,
      client,
      provider,
      other,
      descriptions,
      amounts,
      deadlines,
      totalAmount,
    };
  }

  it("deploys with correct initial values", async function () {
    const {
      dealLock,
      client,
      provider,
      descriptions,
      amounts,
      deadlines,
      totalAmount,
    } = await networkHelpers.loadFixture(deployDealLockFixture);

    expect(await dealLock.client()).to.equal(client.address);
    expect(await dealLock.provider()).to.equal(provider.address);
    expect(await dealLock.totalAmount()).to.equal(totalAmount);
    expect(await dealLock.fundedAmount()).to.equal(0n);
    expect(await dealLock.releasedAmount()).to.equal(0n);
    expect(await dealLock.refundedAmount()).to.equal(0n);
    expect(await dealLock.agreementState()).to.equal(0n);
    expect(await dealLock.getMilestoneCount()).to.equal(3n);

    const m0 = await dealLock.getMilestone(0);
    expect(m0[0]).to.equal(descriptions[0]);
    expect(m0[1]).to.equal(amounts[0]);
    expect(m0[2]).to.equal(BigInt(deadlines[0]));
    expect(m0[3]).to.equal("");
    expect(m0[4]).to.equal(0n);
    expect(m0[5]).to.equal(0n);
  });

  it("only the provider can accept the agreement", async function () {
    const { dealLock, provider, other } =
      await networkHelpers.loadFixture(deployDealLockFixture);

    await expect(dealLock.connect(other).acceptAgreement()).to.be.revertedWith(
      "Only provider",
    );

    await expect(dealLock.connect(provider).acceptAgreement())
      .to.emit(dealLock, "AgreementAccepted")
      .withArgs(provider.address);

    expect(await dealLock.agreementState()).to.equal(1n);
  });

  it("client can fund only after acceptance and only with the exact amount", async function () {
    const { dealLock, client, provider, totalAmount } =
      await networkHelpers.loadFixture(deployDealLockFixture);

    await expect(
      dealLock.connect(client).fundAgreement({ value: totalAmount }),
    ).to.be.revertedWith("Invalid agreement state");

    await dealLock.connect(provider).acceptAgreement();

    await expect(
      dealLock.connect(client).fundAgreement({ value: totalAmount - 1n }),
    ).to.be.revertedWith("Incorrect funding amount");

    await expect(
      dealLock.connect(client).fundAgreement({ value: totalAmount }),
    )
      .to.emit(dealLock, "AgreementFunded")
      .withArgs(client.address, totalAmount);

    expect(await dealLock.fundedAmount()).to.equal(totalAmount);
    expect(await dealLock.agreementState()).to.equal(2n);
    expect(await dealLock.getContractBalance()).to.equal(totalAmount);
  });

  it("provider can submit milestone 0 after funding", async function () {
    const { dealLock, client, provider, totalAmount } =
      await networkHelpers.loadFixture(deployDealLockFixture);

    await dealLock.connect(provider).acceptAgreement();
    await dealLock.connect(client).fundAgreement({ value: totalAmount });

    await expect(
      dealLock.connect(provider).submitMilestone(0, "ipfs://proof-0"),
    )
      .to.emit(dealLock, "MilestoneSubmitted")
      .withArgs(0n, "ipfs://proof-0");

    const m0 = await dealLock.getMilestone(0);
    expect(m0[3]).to.equal("ipfs://proof-0");
    expect(m0[5]).to.equal(1n);
    expect(m0[4]).to.be.greaterThan(0n);
  });

  it("does not allow submitting milestone 1 before milestone 0 is released", async function () {
    const { dealLock, client, provider, totalAmount } =
      await networkHelpers.loadFixture(deployDealLockFixture);

    await dealLock.connect(provider).acceptAgreement();
    await dealLock.connect(client).fundAgreement({ value: totalAmount });

    await expect(
      dealLock.connect(provider).submitMilestone(1, "ipfs://proof-1"),
    ).to.be.revertedWith("Previous milestone not released");
  });

  it("client can approve milestone 0 and provider receives the payment", async function () {
    const { dealLock, client, provider, amounts, totalAmount } =
      await networkHelpers.loadFixture(deployDealLockFixture);

    await dealLock.connect(provider).acceptAgreement();
    await dealLock.connect(client).fundAgreement({ value: totalAmount });
    await dealLock.connect(provider).submitMilestone(0, "ipfs://proof-0");

    const tx = dealLock.connect(client).approveMilestone(0);

    await expect(tx).to.changeEtherBalance(ethers, provider, amounts[0]);

    const m0 = await dealLock.getMilestone(0);
    expect(m0[5]).to.equal(2n);
    expect(await dealLock.releasedAmount()).to.equal(amounts[0]);
  });

  it("does not allow approving a milestone that wasn't submitted", async function () {
    const { dealLock, client, provider, totalAmount } =
      await networkHelpers.loadFixture(deployDealLockFixture);

    await dealLock.connect(provider).acceptAgreement();
    await dealLock.connect(client).fundAgreement({ value: totalAmount });

    await expect(dealLock.connect(client).approveMilestone(0)).to.be.revertedWith(
      "Milestone not submitted",
    );
  });

  it("client can refund an expired pending milestone", async function () {
    const { dealLock, client, provider, amounts, deadlines, totalAmount } =
      await networkHelpers.loadFixture(deployDealLockFixture);

    await dealLock.connect(provider).acceptAgreement();
    await dealLock.connect(client).fundAgreement({ value: totalAmount });

    await networkHelpers.time.increaseTo(deadlines[0] + 1);

    const tx = dealLock.connect(client).refundExpiredMilestone(0);

    await expect(tx).to.changeEtherBalance(ethers, client, amounts[0]);

    const m0 = await dealLock.getMilestone(0);
    expect(m0[5]).to.equal(3n);
    expect(await dealLock.refundedAmount()).to.equal(amounts[0]);
  });

  it("does not allow refunding before the deadline", async function () {
    const { dealLock, client, provider, totalAmount } =
      await networkHelpers.loadFixture(deployDealLockFixture);

    await dealLock.connect(provider).acceptAgreement();
    await dealLock.connect(client).fundAgreement({ value: totalAmount });

    await expect(
      dealLock.connect(client).refundExpiredMilestone(0),
    ).to.be.revertedWith("Deadline not passed");
  });

  it("does not allow refunding a later milestone while an earlier milestone is unresolved", async function () {
    const { dealLock, client, provider, deadlines, totalAmount } =
      await networkHelpers.loadFixture(deployDealLockFixture);

    await dealLock.connect(provider).acceptAgreement();
    await dealLock.connect(client).fundAgreement({ value: totalAmount });

    await networkHelpers.time.increaseTo(deadlines[1] + 1);

    await expect(
      dealLock.connect(client).refundExpiredMilestone(1),
    ).to.be.revertedWith("Previous milestone not resolved");
  });

  it("marks the agreement completed after all milestones are released", async function () {
    const { dealLock, client, provider, totalAmount } =
      await networkHelpers.loadFixture(deployDealLockFixture);

    await dealLock.connect(provider).acceptAgreement();
    await dealLock.connect(client).fundAgreement({ value: totalAmount });

    await dealLock.connect(provider).submitMilestone(0, "ipfs://proof-0");
    await dealLock.connect(client).approveMilestone(0);

    await dealLock.connect(provider).submitMilestone(1, "ipfs://proof-1");
    await dealLock.connect(client).approveMilestone(1);

    await dealLock.connect(provider).submitMilestone(2, "ipfs://proof-2");
    await dealLock.connect(client).approveMilestone(2);

    expect(await dealLock.agreementState()).to.equal(3n);
    expect(await dealLock.isAgreementCompleted()).to.equal(true);
  });
});
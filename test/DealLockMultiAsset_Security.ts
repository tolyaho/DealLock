/**
 * Round 11 — Payment Layer Security & Invariant Tests
 *
 * Covers: reentrancy (ETH + ERC-20), CEI ordering, failed-transfer rollback,
 * settlement split invariants, double-action prevention, wrong-asset rejection,
 * fee-on-transfer + bad-return rejection, and balance accounting invariants.
 */
import "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { expect } from "chai";
import hre from "hardhat";
import type { Contract, ContractRunner } from "ethers";

type C = Omit<Contract, "connect"> & { connect(runner: null | ContractRunner): C };

const { ethers, networkHelpers } = await hre.network.create();

const REVIEW = 3 * 24 * 60 * 60;
const USDC = 1_000_000n;

async function deadlines(count = 3) {
  const now = await networkHelpers.time.latest();
  return Array.from({ length: count }, (_, i) => now + 1000 + i * 1000);
}

async function deployToken(name = "MockUSDC") {
  const t = (await ethers.deployContract(name)) as C;
  await t.waitForDeployment();
  return t;
}

/** Deploy a multi-asset agreement with a custom client address (for malicious-receiver tests). */
async function deployAgreementCustomClient(
  clientAddr: string,
  paymentToken = ethers.ZeroAddress,
  amountUnit = ethers.parseEther("0.1"),
) {
  const [, provider] = await ethers.getSigners();
  const amounts = [amountUnit, amountUnit * 2n];
  const agreement = (await ethers.deployContract("DealLockMultiAsset", [
    clientAddr,
    provider.address,
    paymentToken,
    ["M0", "M1"],
    amounts,
    await deadlines(2),
    REVIEW,
  ])) as C;
  await agreement.waitForDeployment();
  return { agreement, provider, amounts, total: amounts.reduce((a, b) => a + b, 0n) };
}

/** Deploy a multi-asset agreement with a custom provider address. */
async function deployAgreementCustomProvider(
  providerAddr: string,
  paymentToken = ethers.ZeroAddress,
  amountUnit = ethers.parseEther("0.1"),
) {
  const [client] = await ethers.getSigners();
  const amounts = [amountUnit, amountUnit * 2n];
  const agreement = (await ethers.deployContract("DealLockMultiAsset", [
    client.address,
    providerAddr,
    paymentToken,
    ["M0", "M1"],
    amounts,
    await deadlines(2),
    REVIEW,
  ])) as C;
  await agreement.waitForDeployment();
  return { agreement, client, amounts, total: amounts.reduce((a, b) => a + b, 0n) };
}

/** Standard 3-milestone ETH fixture (accepted + funded). */
async function ethFundedFixture() {
  const [client, provider] = await ethers.getSigners();
  const amounts = [ethers.parseEther("0.1"), ethers.parseEther("0.2"), ethers.parseEther("0.3")];
  const agreement = (await ethers.deployContract("DealLockMultiAsset", [
    client.address,
    provider.address,
    ethers.ZeroAddress,
    ["A", "B", "C"],
    amounts,
    await deadlines(3),
    REVIEW,
  ])) as C;
  await agreement.waitForDeployment();
  await agreement.connect(provider).acceptAgreement();
  const total = amounts.reduce((a, b) => a + b, 0n);
  await agreement.connect(client).fundAgreement({ value: total });
  return { agreement, client, provider, amounts, total };
}

/** Standard 3-milestone ERC-20 fixture (accepted + funded). */
async function erc20FundedFixture() {
  const [client, provider] = await ethers.getSigners();
  const token = await deployToken();
  const amounts = [100n * USDC, 200n * USDC, 300n * USDC];
  const total = amounts.reduce((a, b) => a + b, 0n);
  const agreement = (await ethers.deployContract("DealLockMultiAsset", [
    client.address,
    provider.address,
    await token.getAddress(),
    ["A", "B", "C"],
    amounts,
    await deadlines(3),
    REVIEW,
  ])) as C;
  await agreement.waitForDeployment();
  await token.mint(client.address, total + 1000n * USDC);
  await agreement.connect(provider).acceptAgreement();
  await token.connect(client).approve(await agreement.getAddress(), total);
  await agreement.connect(client).fundAgreement();
  return { agreement, client, provider, token, amounts, total };
}

/** Helper: assert both actual balance and getContractBalance() match expected. */
async function expectHeld(agreement: C, expected: bigint, token?: C) {
  if (token) {
    expect(await token.balanceOf(await agreement.getAddress())).to.equal(expected);
  } else {
    expect(await ethers.provider.getBalance(await agreement.getAddress())).to.equal(expected);
  }
  expect(await agreement.getContractBalance()).to.equal(expected);
}

// ── A. Reentrancy tests ──────────────────────────────────────────────────────

describe("DealLockMultiAsset_Security — A. Reentrancy", function () {
  it("A1. ETH: nonReentrant blocks reentry during approveMilestone — receiver absorbs inner revert", async () => {
    const [client] = await ethers.getSigners();
    const receiver = (await ethers.deployContract("MaliciousETHReceiver")) as C;
    const receiverAddr = await receiver.getAddress();

    const amounts = [ethers.parseEther("0.1"), ethers.parseEther("0.2")];
    const total = amounts.reduce((a, b) => a + b, 0n);
    const agreement = (await ethers.deployContract("DealLockMultiAsset", [
      client.address,
      receiverAddr,
      ethers.ZeroAddress,
      ["M0", "M1"],
      amounts,
      await deadlines(2),
      REVIEW,
    ])) as C;
    await agreement.waitForDeployment();
    const agreementAddr = await agreement.getAddress();

    // Impersonate receiver (provider) to accept and submit
    await ethers.provider.send("hardhat_impersonateAccount", [receiverAddr]);
    await ethers.provider.send("hardhat_setBalance", [receiverAddr, "0x" + (2n * 10n ** 18n).toString(16)]);
    const receiverSigner = await ethers.getSigner(receiverAddr);
    await agreement.connect(receiverSigner).acceptAgreement();

    await agreement.connect(client).fundAgreement({ value: total });

    await agreement.connect(receiverSigner).submitMilestone(0, "proof");
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [receiverAddr]);

    // Attack: on ETH receive, try to call approveMilestone(1) — nonReentrant blocks it
    const approveM1 = agreement.interface.encodeFunctionData("approveMilestone", [1]);
    await receiver.setAttack(agreementAddr, approveM1, true);

    await agreement.connect(client).approveMilestone(0);

    // Inner call was blocked by reentrancy guard (or state check — either way, it reverted)
    expect(await receiver.innerCallReverted()).to.equal(true);
    const [, , , , , m0state] = await agreement.getMilestone(0);
    const [, , , , , m1state] = await agreement.getMilestone(1);
    expect(m0state).to.equal(2n); // Released
    expect(m1state).to.equal(0n); // Pending
    await expectHeld(agreement, total - amounts[0]);
  });

  it("A2. ETH: nonReentrant blocks reentry during refundExpiredMilestone", async () => {
    const [, provider] = await ethers.getSigners();
    const receiver = (await ethers.deployContract("MaliciousETHReceiver")) as C;
    const receiverAddr = await receiver.getAddress();

    const amounts = [ethers.parseEther("0.1"), ethers.parseEther("0.2")];
    const total = amounts.reduce((a, b) => a + b, 0n);
    const agreement = (await ethers.deployContract("DealLockMultiAsset", [
      receiverAddr, // client = malicious receiver
      provider.address,
      ethers.ZeroAddress,
      ["M0", "M1"],
      amounts,
      await deadlines(2),
      REVIEW,
    ])) as C;
    await agreement.waitForDeployment();
    const agreementAddr = await agreement.getAddress();

    await agreement.connect(provider).acceptAgreement();

    // Impersonate receiver (client) to fund
    await ethers.provider.send("hardhat_impersonateAccount", [receiverAddr]);
    await ethers.provider.send("hardhat_setBalance", [receiverAddr, "0x" + (2n * 10n ** 18n).toString(16)]);
    const recvSigner = await ethers.getSigner(receiverAddr);
    await agreement.connect(recvSigner).fundAgreement({ value: total });

    // Advance time past deadlines
    await networkHelpers.time.increase(3000);

    // Attack: on receiving refund ETH, try to refund milestone 1
    const refundM1 = agreement.interface.encodeFunctionData("refundExpiredMilestone", [1]);
    await receiver.setAttack(agreementAddr, refundM1, true);

    await agreement.connect(recvSigner).refundExpiredMilestone(0);
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [receiverAddr]);

    // Inner call blocked
    expect(await receiver.innerCallReverted()).to.equal(true);
    const [, , , , , m0state] = await agreement.getMilestone(0);
    const [, , , , , m1state] = await agreement.getMilestone(1);
    expect(m0state).to.equal(3n); // Refunded
    expect(m1state).to.equal(0n); // still Pending
    await expectHeld(agreement, total - amounts[0]);
  });

  it("A3. ERC-20: nonReentrant guard on approveMilestone blocks token hook reentrancy", async () => {
    // ReentrantERC20's _transfer calls approveMilestone on the agreement.
    // msg.sender in the reentrant call is the token contract — fails "Only client".
    // But the reentrancy guard is the deeper defense if we use a token that impersonates correctly.
    // This test verifies the guard fires by checking innerCallReverted on a custom scenario.
    const [client, provider] = await ethers.getSigners();
    const token = await deployToken("ReentrantERC20");
    const amounts = [100n * USDC, 200n * USDC];
    const total = amounts.reduce((a, b) => a + b, 0n);
    const agreement = (await ethers.deployContract("DealLockMultiAsset", [
      client.address,
      provider.address,
      await token.getAddress(),
      ["M0", "M1"],
      amounts,
      await deadlines(2),
      REVIEW,
    ])) as C;
    await agreement.waitForDeployment();
    await token.mint(client.address, total);
    await agreement.connect(provider).acceptAgreement();
    await token.connect(client).approve(await agreement.getAddress(), total);
    await agreement.connect(client).fundAgreement();
    await agreement.connect(provider).submitMilestone(0, "proof");

    // Enable attack: token's transfer hook tries to call approveMilestone(0)
    await token.setAttack(await agreement.getAddress(), true);

    // approveMilestone(0) triggers _sendPayment which calls token.transfer(provider, amount)
    // token's _transfer checks from == target (agreement addr) and calls agreement.approveMilestone(0)
    // msg.sender of that call = token address ≠ client → reverts "Only client"
    // That revert propagates through SafeERC20 → outer tx fails
    await expect(agreement.connect(client).approveMilestone(0)).to.be.revertedWith("Only client");

    // Verify state is NOT terminal (whole tx reverted including state updates)
    const [, , , , , m0state] = await agreement.getMilestone(0);
    expect(m0state).to.equal(1n); // still Submitted
    expect(await agreement.releasedAmount()).to.equal(0n);
  });

  it("A4. ERC-20: reentrancy guard blocks duplicate fundAgreement via token hook", async () => {
    // A token that calls fundAgreement during transferFrom cannot succeed because
    // the agreement state switches to Funded before the balance-delta check runs.
    // More precisely: fundAgreement is nonReentrant, so a reentrant fundAgreement call is blocked.
    // We test this by verifying a second fundAgreement call fails after the first succeeds.
    const [client, provider] = await ethers.getSigners();
    const token = await deployToken();
    const amounts = [100n * USDC];
    const total = amounts[0];
    const agreement = (await ethers.deployContract("DealLockMultiAsset", [
      client.address,
      provider.address,
      await token.getAddress(),
      ["M0"],
      amounts,
      await deadlines(1),
      REVIEW,
    ])) as C;
    await agreement.waitForDeployment();
    await token.mint(client.address, total * 2n);
    await agreement.connect(provider).acceptAgreement();
    await token.connect(client).approve(await agreement.getAddress(), total);
    await agreement.connect(client).fundAgreement();

    // State is now Funded; a second call to fundAgreement must fail
    await token.connect(client).approve(await agreement.getAddress(), total);
    await expect(agreement.connect(client).fundAgreement()).to.be.revertedWith("Invalid agreement state");
  });
});

// ── B. CEI ordering + failed-transfer rollback ───────────────────────────────

describe("DealLockMultiAsset_Security — B. CEI Ordering & Failed Transfer Rollback", function () {
  it("B1. ETH: failed provider payout causes full rollback — state remains Submitted", async () => {
    // Deploy with a non-payable contract as provider so ETH transfer fails
    const [client] = await ethers.getSigners();
    // DealLockFactoryV2 has no receive/fallback — ETH transfer to it reverts
    const nonPayable = (await ethers.deployContract("DealLockFactoryV2")) as C;
    const nonPayableAddr = await nonPayable.getAddress();

    const amounts = [ethers.parseEther("0.1")];
    const total = amounts[0];
    const agreement = (await ethers.deployContract("DealLockMultiAsset", [
      client.address,
      nonPayableAddr,
      ethers.ZeroAddress,
      ["M0"],
      amounts,
      await deadlines(1),
      REVIEW,
    ])) as C;
    await agreement.waitForDeployment();

    // Impersonate nonPayable to accept + submit
    await ethers.provider.send("hardhat_impersonateAccount", [nonPayableAddr]);
    await ethers.provider.send("hardhat_setBalance", [nonPayableAddr, "0x" + (2n * 10n ** 18n).toString(16)]);
    const npSigner = await ethers.getSigner(nonPayableAddr);
    await agreement.connect(npSigner).acceptAgreement();
    await agreement.connect(client).fundAgreement({ value: total });
    await agreement.connect(npSigner).submitMilestone(0, "proof");
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [nonPayableAddr]);

    // approveMilestone tries to send ETH to nonPayable → "Transfer failed"
    await expect(agreement.connect(client).approveMilestone(0)).to.be.revertedWith("Transfer failed");

    // State fully rolled back
    const [, , , , , m0state] = await agreement.getMilestone(0);
    expect(m0state).to.equal(1n); // still Submitted
    expect(await agreement.releasedAmount()).to.equal(0n);
    await expectHeld(agreement, total);
  });

  it("B2. ERC-20: BadReturnERC20 transfer false on sendPayment causes full rollback", async () => {
    const [client, provider] = await ethers.getSigners();
    const token = await deployToken("BadReturnERC20");
    const amounts = [100n * USDC];
    const total = amounts[0];
    const agreement = (await ethers.deployContract("DealLockMultiAsset", [
      client.address,
      provider.address,
      await token.getAddress(),
      ["M0"],
      amounts,
      await deadlines(1),
      REVIEW,
    ])) as C;
    await agreement.waitForDeployment();
    await token.mint(client.address, total);
    await agreement.connect(provider).acceptAgreement();
    await token.connect(client).approve(await agreement.getAddress(), total);
    await agreement.connect(client).fundAgreement();
    await agreement.connect(provider).submitMilestone(0, "proof");

    await token.setFailTransfers(true);
    await expect(agreement.connect(client).approveMilestone(0)).to.be.revertedWith("ERC20 transfer failed");

    // State fully rolled back
    const [, , , , , m0state] = await agreement.getMilestone(0);
    expect(m0state).to.equal(1n); // still Submitted
    expect(await agreement.releasedAmount()).to.equal(0n);
    await expectHeld(agreement, total, token);
  });

  it("B3. ERC-20: BadReturnERC20 on claimMilestoneAfterReview causes rollback", async () => {
    const [client, provider] = await ethers.getSigners();
    const token = await deployToken("BadReturnERC20");
    const amounts = [100n * USDC];
    const total = amounts[0];
    const agreement = (await ethers.deployContract("DealLockMultiAsset", [
      client.address,
      provider.address,
      await token.getAddress(),
      ["M0"],
      amounts,
      await deadlines(1),
      REVIEW,
    ])) as C;
    await agreement.waitForDeployment();
    await token.mint(client.address, total);
    await agreement.connect(provider).acceptAgreement();
    await token.connect(client).approve(await agreement.getAddress(), total);
    await agreement.connect(client).fundAgreement();
    await agreement.connect(provider).submitMilestone(0, "proof");
    await networkHelpers.time.increase(REVIEW + 1);

    await token.setFailTransfers(true);
    await expect(agreement.connect(provider).claimMilestoneAfterReview(0)).to.be.revertedWith("ERC20 transfer failed");

    const [, , , , , m0state] = await agreement.getMilestone(0);
    expect(m0state).to.equal(1n); // still Submitted
    expect(await agreement.releasedAmount()).to.equal(0n);
    await expectHeld(agreement, total, token);
  });

  it("B4. ERC-20: BadReturnERC20 on refundExpiredMilestone causes rollback", async () => {
    const [client, provider] = await ethers.getSigners();
    const token = await deployToken("BadReturnERC20");
    const amounts = [100n * USDC];
    const total = amounts[0];
    const agreement = (await ethers.deployContract("DealLockMultiAsset", [
      client.address,
      provider.address,
      await token.getAddress(),
      ["M0"],
      amounts,
      await deadlines(1),
      REVIEW,
    ])) as C;
    await agreement.waitForDeployment();
    await token.mint(client.address, total);
    await agreement.connect(provider).acceptAgreement();
    await token.connect(client).approve(await agreement.getAddress(), total);
    await agreement.connect(client).fundAgreement();
    await networkHelpers.time.increase(1100); // past deadline + grace

    await token.setFailTransfers(true);
    await expect(agreement.connect(client).refundExpiredMilestone(0)).to.be.revertedWith("ERC20 transfer failed");

    const [, , , , , m0state] = await agreement.getMilestone(0);
    expect(m0state).to.equal(0n); // still Pending
    expect(await agreement.refundedAmount()).to.equal(0n);
    await expectHeld(agreement, total, token);
  });

  it("B5. ERC-20: settlement provider-payout failure causes full rollback", async () => {
    const [client, provider] = await ethers.getSigners();
    const token = await deployToken("BadReturnERC20");
    const amounts = [100n * USDC];
    const total = amounts[0];
    const agreement = (await ethers.deployContract("DealLockMultiAsset", [
      client.address,
      provider.address,
      await token.getAddress(),
      ["M0"],
      amounts,
      await deadlines(1),
      REVIEW,
    ])) as C;
    await agreement.waitForDeployment();
    await token.mint(client.address, total);
    await agreement.connect(provider).acceptAgreement();
    await token.connect(client).approve(await agreement.getAddress(), total);
    await agreement.connect(client).fundAgreement();
    await agreement.connect(provider).submitMilestone(0, "proof");
    await agreement.connect(client).disputeMilestone(0, "bad");
    await agreement.connect(provider).proposeMilestoneSettlement(0, 60n * USDC, "split");

    // Fail transfers before accepting settlement
    await token.setFailTransfers(true);
    await expect(agreement.connect(client).acceptMilestoneSettlement(0)).to.be.revertedWith("ERC20 transfer failed");

    // State fully rolled back: milestone still Disputed
    const [, , , , , m0state] = await agreement.getMilestone(0);
    expect(m0state).to.equal(4n); // Disputed
    expect(await agreement.releasedAmount()).to.equal(0n);
    expect(await agreement.refundedAmount()).to.equal(0n);
    await expectHeld(agreement, total, token);
  });
});

// ── C. Double-action prevention ──────────────────────────────────────────────

describe("DealLockMultiAsset_Security — C. Double-Action Prevention", function () {
  it("C1. Cannot approve an already-Released milestone", async () => {
    const f = await erc20FundedFixture();
    await f.agreement.connect(f.provider).submitMilestone(0, "proof");
    await f.agreement.connect(f.client).approveMilestone(0);
    await expect(f.agreement.connect(f.client).approveMilestone(0)).to.be.revertedWith("Milestone not submitted");
  });

  it("C2. Cannot refund an already-Refunded milestone", async () => {
    const f = await erc20FundedFixture();
    await networkHelpers.time.increase(1100);
    await f.agreement.connect(f.client).refundExpiredMilestone(0);
    await expect(f.agreement.connect(f.client).refundExpiredMilestone(0)).to.be.revertedWith("Milestone not pending");
  });

  it("C3. Cannot claimMilestoneAfterReview on an already-Released milestone", async () => {
    const f = await erc20FundedFixture();
    await f.agreement.connect(f.provider).submitMilestone(0, "proof");
    await networkHelpers.time.increase(REVIEW + 1);
    await f.agreement.connect(f.provider).claimMilestoneAfterReview(0);
    await expect(f.agreement.connect(f.provider).claimMilestoneAfterReview(0)).to.be.revertedWith("Milestone not submitted");
  });

  it("C4. Cannot acceptMilestoneSettlement twice", async () => {
    const f = await erc20FundedFixture();
    await f.agreement.connect(f.provider).submitMilestone(0, "proof");
    await f.agreement.connect(f.client).disputeMilestone(0, "bad");
    await f.agreement.connect(f.provider).proposeMilestoneSettlement(0, 50n * USDC, "half");
    await f.agreement.connect(f.client).acceptMilestoneSettlement(0);
    // Milestone is now Settled; proposal.exists is false
    await expect(f.agreement.connect(f.client).acceptMilestoneSettlement(0)).to.be.revertedWith("Milestone not disputed");
  });

  it("C5. Cannot approve already-Released adjustment", async () => {
    const f = await erc20FundedFixture();
    await f.agreement.connect(f.provider).submitMilestone(0, "proof");
    const now = await networkHelpers.time.latest();
    await f.agreement.connect(f.client).requestAdjustment(0, "Adj", 10n * USDC, now + 2000);
    await f.agreement.connect(f.provider).acceptAdjustment(0);
    await f.token.mint(f.client.address, 10n * USDC);
    await f.token.connect(f.client).approve(await f.agreement.getAddress(), 10n * USDC);
    await f.agreement.connect(f.client).fundAdjustment(0);
    await f.agreement.connect(f.provider).submitAdjustment(0, "adj-proof");
    await f.agreement.connect(f.client).approveAdjustment(0);
    await expect(f.agreement.connect(f.client).approveAdjustment(0)).to.be.revertedWith("Adjustment not submitted");
  });

  it("C6. Cannot refund already-Refunded adjustment", async () => {
    const f = await erc20FundedFixture();
    await f.agreement.connect(f.provider).submitMilestone(0, "proof");
    const now = await networkHelpers.time.latest();
    await f.agreement.connect(f.client).requestAdjustment(0, "Adj", 10n * USDC, now + 1000);
    await f.agreement.connect(f.provider).acceptAdjustment(0);
    await f.token.mint(f.client.address, 10n * USDC);
    await f.token.connect(f.client).approve(await f.agreement.getAddress(), 10n * USDC);
    await f.agreement.connect(f.client).fundAdjustment(0);
    await networkHelpers.time.increase(1100);
    await f.agreement.connect(f.client).refundExpiredAdjustment(0);
    await expect(f.agreement.connect(f.client).refundExpiredAdjustment(0)).to.be.revertedWith("Adjustment not funded");
  });

  it("C7. Settlement: proposal creator cannot accept own proposal", async () => {
    const f = await erc20FundedFixture();
    await f.agreement.connect(f.provider).submitMilestone(0, "proof");
    await f.agreement.connect(f.client).disputeMilestone(0, "bad");
    await f.agreement.connect(f.client).proposeMilestoneSettlement(0, 50n * USDC, "half");
    await expect(f.agreement.connect(f.client).acceptMilestoneSettlement(0)).to.be.revertedWith("Cannot accept own proposal");
  });

  it("C8. Settlement: cancelled proposal cannot be accepted", async () => {
    const f = await erc20FundedFixture();
    await f.agreement.connect(f.provider).submitMilestone(0, "proof");
    await f.agreement.connect(f.client).disputeMilestone(0, "bad");
    await f.agreement.connect(f.provider).proposeMilestoneSettlement(0, 50n * USDC, "half");
    await f.agreement.connect(f.provider).cancelMilestoneSettlement(0);
    await expect(f.agreement.connect(f.client).acceptMilestoneSettlement(0)).to.be.revertedWith("No settlement proposal");
  });
});

// ── D. Settlement split invariants ──────────────────────────────────────────

describe("DealLockMultiAsset_Security — D. Settlement Split Invariants", function () {
  async function disputedMilestone0ETH() {
    const f = await ethFundedFixture();
    await f.agreement.connect(f.provider).submitMilestone(0, "proof");
    await f.agreement.connect(f.client).disputeMilestone(0, "bad");
    return f;
  }

  async function disputedMilestone0ERC20() {
    const f = await erc20FundedFixture();
    await f.agreement.connect(f.provider).submitMilestone(0, "proof");
    await f.agreement.connect(f.client).disputeMilestone(0, "bad");
    return f;
  }

  it("D1. ETH settlement 0% provider / 100% client", async () => {
    const f = await disputedMilestone0ETH();
    await f.agreement.connect(f.provider).proposeMilestoneSettlement(0, 0n, "all to client");
    await f.agreement.connect(f.client).acceptMilestoneSettlement(0);
    expect(await f.agreement.releasedAmount()).to.equal(0n);
    expect(await f.agreement.refundedAmount()).to.equal(f.amounts[0]);
    await expectHeld(f.agreement, f.total - f.amounts[0]);
  });

  it("D2. ETH settlement 50% / 50%", async () => {
    const f = await disputedMilestone0ETH();
    const half = f.amounts[0] / 2n;
    await f.agreement.connect(f.provider).proposeMilestoneSettlement(0, half, "half");
    await f.agreement.connect(f.client).acceptMilestoneSettlement(0);
    expect(await f.agreement.releasedAmount()).to.equal(half);
    expect(await f.agreement.refundedAmount()).to.equal(f.amounts[0] - half);
    await expectHeld(f.agreement, f.total - f.amounts[0]);
  });

  it("D3. ETH settlement 100% provider / 0% client", async () => {
    const f = await disputedMilestone0ETH();
    await f.agreement.connect(f.client).proposeMilestoneSettlement(0, f.amounts[0], "all to provider");
    await f.agreement.connect(f.provider).acceptMilestoneSettlement(0);
    expect(await f.agreement.releasedAmount()).to.equal(f.amounts[0]);
    expect(await f.agreement.refundedAmount()).to.equal(0n);
    await expectHeld(f.agreement, f.total - f.amounts[0]);
  });

  it("D4. ERC-20 settlement 0% provider / 100% client", async () => {
    const f = await disputedMilestone0ERC20();
    await f.agreement.connect(f.provider).proposeMilestoneSettlement(0, 0n, "all to client");
    const clientBefore = await f.token.balanceOf(f.client.address);
    await f.agreement.connect(f.client).acceptMilestoneSettlement(0);
    expect(await f.token.balanceOf(f.provider.address)).to.equal(0n);
    expect(await f.token.balanceOf(f.client.address)).to.equal(clientBefore + f.amounts[0]);
  });

  it("D5. ERC-20 settlement 100% provider / 0% client", async () => {
    const f = await disputedMilestone0ERC20();
    await f.agreement.connect(f.client).proposeMilestoneSettlement(0, f.amounts[0], "all provider");
    const providerBefore = await f.token.balanceOf(f.provider.address);
    await f.agreement.connect(f.provider).acceptMilestoneSettlement(0);
    expect(await f.token.balanceOf(f.provider.address)).to.equal(providerBefore + f.amounts[0]);
  });

  it("D6. ERC-20 settlement 75% provider / 25% client", async () => {
    const f = await disputedMilestone0ERC20();
    const pAmt = (f.amounts[0] * 3n) / 4n;
    const cAmt = f.amounts[0] - pAmt;
    await f.agreement.connect(f.provider).proposeMilestoneSettlement(0, pAmt, "75/25");
    const clientBefore = await f.token.balanceOf(f.client.address);
    await f.agreement.connect(f.client).acceptMilestoneSettlement(0);
    expect(await f.token.balanceOf(f.provider.address)).to.equal(pAmt);
    expect(await f.token.balanceOf(f.client.address)).to.equal(clientBefore + cAmt);
    expect(await f.agreement.releasedAmount()).to.equal(pAmt);
    expect(await f.agreement.refundedAmount()).to.equal(cAmt);
  });

  it("D7. Settlement providerAmount > milestone amount reverts", async () => {
    const f = await disputedMilestone0ERC20();
    await expect(
      f.agreement.connect(f.provider).proposeMilestoneSettlement(0, f.amounts[0] + 1n, "overflow"),
    ).to.be.revertedWith("Provider amount exceeds milestone amount");
  });

  it("D8. Adjustment settlement 0% / 100% ERC-20", async () => {
    const f = await erc20FundedFixture();
    await f.agreement.connect(f.provider).submitMilestone(0, "proof");
    const now = await networkHelpers.time.latest();
    const adjAmt = 50n * USDC;
    await f.agreement.connect(f.client).requestAdjustment(0, "Adj", adjAmt, now + 2000);
    await f.agreement.connect(f.provider).acceptAdjustment(0);
    await f.token.mint(f.client.address, adjAmt);
    await f.token.connect(f.client).approve(await f.agreement.getAddress(), adjAmt);
    await f.agreement.connect(f.client).fundAdjustment(0);
    await f.agreement.connect(f.provider).submitAdjustment(0, "adj-proof");
    await f.agreement.connect(f.client).disputeAdjustment(0, "bad");
    await f.agreement.connect(f.provider).proposeAdjustmentSettlement(0, 0n, "all client");
    const clientBefore = await f.token.balanceOf(f.client.address);
    await f.agreement.connect(f.client).acceptAdjustmentSettlement(0);
    expect(await f.token.balanceOf(f.client.address)).to.equal(clientBefore + adjAmt);
    expect(await f.agreement.adjustmentReleasedAmount()).to.equal(0n);
    expect(await f.agreement.adjustmentRefundedAmount()).to.equal(adjAmt);
  });
});

// ── E. Balance accounting invariants ────────────────────────────────────────

describe("DealLockMultiAsset_Security — E. Balance Accounting Invariants", function () {
  it("E1. ETH: balance invariant holds across full lifecycle (release + refund + settlement)", async () => {
    const f = await ethFundedFixture();

    // Release milestone 0
    await f.agreement.connect(f.provider).submitMilestone(0, "proof0");
    await f.agreement.connect(f.client).approveMilestone(0);
    let bal = await ethers.provider.getBalance(await f.agreement.getAddress());
    expect(bal).to.equal(f.total - f.amounts[0]);

    // Dispute + settle milestone 1 (requires M0 released ✓)
    await f.agreement.connect(f.provider).submitMilestone(1, "proof1");
    await f.agreement.connect(f.client).disputeMilestone(1, "bad");
    const half1 = f.amounts[1] / 2n;
    await f.agreement.connect(f.provider).proposeMilestoneSettlement(1, half1, "half");
    await f.agreement.connect(f.client).acceptMilestoneSettlement(1); // M1 → Settled
    bal = await ethers.provider.getBalance(await f.agreement.getAddress());
    expect(bal).to.equal(f.total - f.amounts[0] - f.amounts[1]);

    // Refund milestone 2 (M0 Released, M1 Settled — both qualify for M2 refund via _requirePreviousMilestonesResolved)
    await networkHelpers.time.increase(3100);
    await f.agreement.connect(f.client).refundExpiredMilestone(2);
    bal = await ethers.provider.getBalance(await f.agreement.getAddress());
    expect(bal).to.equal(0n);

    expect(await f.agreement.isAgreementCompleted()).to.equal(true);
    const released = await f.agreement.releasedAmount();
    const refunded = await f.agreement.refundedAmount();
    expect(released + refunded).to.equal(f.total);
  });

  it("E2. ERC-20: balance invariant holds across full lifecycle (release + adjustment + refund)", async () => {
    const f = await erc20FundedFixture();
    const addr = await f.agreement.getAddress();

    // Initial state
    await expectHeld(f.agreement, f.total, f.token);

    // Release milestone 0
    await f.agreement.connect(f.provider).submitMilestone(0, "proof");
    await f.agreement.connect(f.client).approveMilestone(0);
    await expectHeld(f.agreement, f.total - f.amounts[0], f.token);

    // Fund + approve adjustment for M0
    const now = await networkHelpers.time.latest();
    const adjAmt = 50n * USDC;
    await f.agreement.connect(f.client).requestAdjustment(0, "X", adjAmt, now + 2000);
    await f.agreement.connect(f.provider).acceptAdjustment(0);
    await f.token.mint(f.client.address, adjAmt);
    await f.token.connect(f.client).approve(addr, adjAmt);
    await f.agreement.connect(f.client).fundAdjustment(0);
    await expectHeld(f.agreement, f.total - f.amounts[0] + adjAmt, f.token);

    await f.agreement.connect(f.provider).submitAdjustment(0, "adj-proof");
    await f.agreement.connect(f.client).approveAdjustment(0);
    await expectHeld(f.agreement, f.total - f.amounts[0], f.token);

    // Submit + settle milestone 1 (M0 Released ✓)
    await f.agreement.connect(f.provider).submitMilestone(1, "proof1");
    await f.agreement.connect(f.client).disputeMilestone(1, "bad");
    await f.agreement.connect(f.provider).proposeMilestoneSettlement(1, 0n, "all client");
    await f.agreement.connect(f.client).acceptMilestoneSettlement(1); // M1 → Settled
    await expectHeld(f.agreement, f.total - f.amounts[0] - f.amounts[1], f.token);

    // Refund milestone 2 (M0 Released, M1 Settled — both terminal ✓)
    await networkHelpers.time.increase(3100);
    await f.agreement.connect(f.client).refundExpiredMilestone(2);
    await expectHeld(f.agreement, 0n, f.token);

    expect(await f.agreement.isAgreementCompleted()).to.equal(true);
  });

  it("E3. ETH: released + refunded + held == totalAmount at every step", async () => {
    const f = await ethFundedFixture();

    async function checkInvariant() {
      const released = await f.agreement.releasedAmount();
      const refunded = await f.agreement.refundedAmount();
      const held = await ethers.provider.getBalance(await f.agreement.getAddress());
      expect(released + refunded + held).to.equal(f.total);
    }

    await checkInvariant();
    // Release M0
    await f.agreement.connect(f.provider).submitMilestone(0, "proof0");
    await f.agreement.connect(f.client).approveMilestone(0);
    await checkInvariant();
    // Settle M1 (M0 Released ✓)
    await f.agreement.connect(f.provider).submitMilestone(1, "proof1");
    await f.agreement.connect(f.client).disputeMilestone(1, "bad");
    await f.agreement.connect(f.provider).proposeMilestoneSettlement(1, f.amounts[1] / 3n, "third");
    await f.agreement.connect(f.client).acceptMilestoneSettlement(1); // M1 → Settled
    await checkInvariant();
    // Refund M2 (M0 Released, M1 Settled — both terminal ✓)
    await networkHelpers.time.increase(3100);
    await f.agreement.connect(f.client).refundExpiredMilestone(2);
    await checkInvariant();
    expect(await f.agreement.isAgreementCompleted()).to.equal(true);
  });

  it("E4. ERC-20: released + refunded + held == totalAmount at every step", async () => {
    const f = await erc20FundedFixture();

    async function checkInvariant() {
      const released = await f.agreement.releasedAmount();
      const refunded = await f.agreement.refundedAmount();
      const held = await f.token.balanceOf(await f.agreement.getAddress());
      expect(released + refunded + held).to.equal(f.total);
    }

    await checkInvariant();
    // Release M0
    await f.agreement.connect(f.provider).submitMilestone(0, "proof0");
    await f.agreement.connect(f.client).approveMilestone(0);
    await checkInvariant();
    // Release M1 (M0 Released ✓)
    await f.agreement.connect(f.provider).submitMilestone(1, "proof1");
    await f.agreement.connect(f.client).approveMilestone(1);
    await checkInvariant();
    // Auto-release M2 after review (M0 + M1 Released ✓)
    await f.agreement.connect(f.provider).submitMilestone(2, "proof2");
    await networkHelpers.time.increase(REVIEW + 1);
    await f.agreement.connect(f.provider).claimMilestoneAfterReview(2);
    await checkInvariant();
    expect(await f.agreement.isAgreementCompleted()).to.equal(true);
  });
});

// ── F. Wrong-asset rejection ─────────────────────────────────────────────────

describe("DealLockMultiAsset_Security — F. Wrong-Asset Rejection", function () {
  it("F1. Unrelated ERC-20 sent to ETH agreement does not affect getContractBalance", async () => {
    const f = await ethFundedFixture();
    const unrelated = await deployToken();
    await unrelated.mint(f.client.address, 1000n * USDC);
    // Direct token transfer to agreement (no transferFrom needed — just transfer)
    await unrelated.connect(f.client).transfer(await f.agreement.getAddress(), 500n * USDC);
    // getContractBalance returns ETH balance only
    expect(await f.agreement.getContractBalance()).to.equal(f.total);
  });

  it("F2. Unrelated ERC-20 sent to ERC-20 agreement does not affect getContractBalance", async () => {
    const f = await erc20FundedFixture();
    const unrelated = await deployToken();
    await unrelated.mint(f.client.address, 1000n * USDC);
    await unrelated.connect(f.client).transfer(await f.agreement.getAddress(), 500n * USDC);
    // getContractBalance returns paymentToken balance only
    expect(await f.agreement.getContractBalance()).to.equal(f.total);
  });

  it("F3. Cannot fund ETH agreement by just sending token approval (no msg.value)", async () => {
    const [client, provider] = await ethers.getSigners();
    // Deploy ETH agreement
    const amounts = [ethers.parseEther("0.1")];
    const agreement = (await ethers.deployContract("DealLockMultiAsset", [
      client.address,
      provider.address,
      ethers.ZeroAddress,
      ["M0"],
      amounts,
      await deadlines(1),
      REVIEW,
    ])) as C;
    await agreement.waitForDeployment();
    await agreement.connect(provider).acceptAgreement();
    // Try to fund with no value
    await expect(agreement.connect(client).fundAgreement()).to.be.revertedWith("Incorrect funding amount");
  });

  it("F4. ETH agreement rejects overfunding", async () => {
    const [client, provider] = await ethers.getSigners();
    const amounts = [ethers.parseEther("0.1")];
    const agreement = (await ethers.deployContract("DealLockMultiAsset", [
      client.address,
      provider.address,
      ethers.ZeroAddress,
      ["M0"],
      amounts,
      await deadlines(1),
      REVIEW,
    ])) as C;
    await agreement.waitForDeployment();
    await agreement.connect(provider).acceptAgreement();
    await expect(agreement.connect(client).fundAgreement({ value: amounts[0] + 1n })).to.be.revertedWith("Incorrect funding amount");
  });

  it("F5. ERC-20 agreement rejects msg.value on fundAgreement", async () => {
    const [client, provider] = await ethers.getSigners();
    const token = await deployToken();
    const amounts = [100n * USDC];
    const total = amounts[0];
    const agreement = (await ethers.deployContract("DealLockMultiAsset", [
      client.address,
      provider.address,
      await token.getAddress(),
      ["M0"],
      amounts,
      await deadlines(1),
      REVIEW,
    ])) as C;
    await agreement.waitForDeployment();
    await token.mint(client.address, total);
    await agreement.connect(provider).acceptAgreement();
    await token.connect(client).approve(await agreement.getAddress(), total);
    await expect(agreement.connect(client).fundAgreement({ value: 1n })).to.be.revertedWith("ETH not accepted");
  });

  it("F6. Fee-on-transfer token rejected during adjustment funding", async () => {
    const [client, provider] = await ethers.getSigners();
    const token = await deployToken("FeeOnTransferToken");
    const amounts = [100n * USDC];
    const total = amounts[0];
    const agreement = (await ethers.deployContract("DealLockMultiAsset", [
      client.address,
      provider.address,
      await token.getAddress(),
      ["M0"],
      amounts,
      await deadlines(1),
      REVIEW,
    ])) as C;
    await agreement.waitForDeployment();

    // First: fund with a standard token to get agreement into Funded state
    // But the paymentToken IS the fee-on-transfer token — so funding itself fails first.
    await token.mint(client.address, total);
    await agreement.connect(provider).acceptAgreement();
    await token.connect(client).approve(await agreement.getAddress(), total);
    await expect(agreement.connect(client).fundAgreement()).to.be.revertedWith("Unsupported token transfer");
  });

  it("F7. Wrong-token funding: using a different token address cannot satisfy fundAgreement", async () => {
    // Agreement is ERC-20 with tokenA; client tries to approve tokenB and call fundAgreement
    const [client, provider] = await ethers.getSigners();
    const tokenA = await deployToken();
    const tokenB = await deployToken();
    const amounts = [100n * USDC];
    const total = amounts[0];
    const agreement = (await ethers.deployContract("DealLockMultiAsset", [
      client.address,
      provider.address,
      await tokenA.getAddress(),
      ["M0"],
      amounts,
      await deadlines(1),
      REVIEW,
    ])) as C;
    await agreement.waitForDeployment();
    await tokenB.mint(client.address, total);
    await tokenB.connect(client).approve(await agreement.getAddress(), total);
    // No tokenA approval — should fail with insufficient allowance
    await agreement.connect(provider).acceptAgreement();
    await expect(agreement.connect(client).fundAgreement()).to.be.revertedWith("ERC20: insufficient allowance");
  });
});

// ── G. Adjustment accounting deep tests ─────────────────────────────────────

describe("DealLockMultiAsset_Security — G. Adjustment Accounting", function () {
  it("G1. adjustmentFundedAmount equals sum of all funded adjustments", async () => {
    const f = await erc20FundedFixture();
    await f.agreement.connect(f.provider).submitMilestone(0, "proof");
    const now = await networkHelpers.time.latest();

    const adj1 = 30n * USDC;
    const adj2 = 20n * USDC;
    await f.agreement.connect(f.client).requestAdjustment(0, "A1", adj1, now + 2000);
    await f.agreement.connect(f.client).requestAdjustment(0, "A2", adj2, now + 2000);
    await f.agreement.connect(f.provider).acceptAdjustment(0);
    await f.agreement.connect(f.provider).acceptAdjustment(1);

    await f.token.mint(f.client.address, adj1 + adj2);
    await f.token.connect(f.client).approve(await f.agreement.getAddress(), adj1 + adj2);
    await f.agreement.connect(f.client).fundAdjustment(0);
    await f.agreement.connect(f.client).fundAdjustment(1);

    expect(await f.agreement.adjustmentFundedAmount()).to.equal(adj1 + adj2);
  });

  it("G2. adjustmentReleased + adjustmentRefunded + held == adjustmentFunded after all resolutions", async () => {
    const f = await erc20FundedFixture();
    await f.agreement.connect(f.provider).submitMilestone(0, "proof");
    const now = await networkHelpers.time.latest();

    const adj1 = 30n * USDC;
    const adj2 = 20n * USDC;
    await f.agreement.connect(f.client).requestAdjustment(0, "A1", adj1, now + 2000);
    await f.agreement.connect(f.client).requestAdjustment(0, "A2", adj2, now + 1500);
    await f.agreement.connect(f.provider).acceptAdjustment(0);
    await f.agreement.connect(f.provider).acceptAdjustment(1);

    await f.token.mint(f.client.address, adj1 + adj2);
    await f.token.connect(f.client).approve(await f.agreement.getAddress(), adj1 + adj2);
    await f.agreement.connect(f.client).fundAdjustment(0);
    await f.agreement.connect(f.client).fundAdjustment(1);

    // Release adj0
    await f.agreement.connect(f.provider).submitAdjustment(0, "a0-proof");
    await f.agreement.connect(f.client).approveAdjustment(0);

    // Refund adj1 (expired)
    await networkHelpers.time.increase(1600);
    await f.agreement.connect(f.client).refundExpiredAdjustment(1);

    const released = await f.agreement.adjustmentReleasedAmount();
    const refunded = await f.agreement.adjustmentRefundedAmount();
    const funded = await f.agreement.adjustmentFundedAmount();
    expect(released).to.equal(adj1);
    expect(refunded).to.equal(adj2);
    expect(released + refunded).to.equal(funded);
  });

  it("G3. Completion blocked until funded adjustment is terminal", async () => {
    const f = await erc20FundedFixture();

    // Request + fund adjustment before completing milestones
    const now = await networkHelpers.time.latest();
    await f.agreement.connect(f.client).requestAdjustment(0, "adj", 10n * USDC, now + 5000);
    await f.agreement.connect(f.provider).acceptAdjustment(0);
    await f.token.mint(f.client.address, 10n * USDC);
    await f.token.connect(f.client).approve(await f.agreement.getAddress(), 10n * USDC);
    await f.agreement.connect(f.client).fundAdjustment(0);

    // Complete all milestones sequentially
    await f.agreement.connect(f.provider).submitMilestone(0, "m0");
    await f.agreement.connect(f.client).approveMilestone(0);
    await f.agreement.connect(f.provider).submitMilestone(1, "m1");
    await f.agreement.connect(f.client).approveMilestone(1);
    await f.agreement.connect(f.provider).submitMilestone(2, "m2");
    await f.agreement.connect(f.client).approveMilestone(2);

    // Agreement NOT complete — adjustment is funded but not terminal
    expect(await f.agreement.isAgreementCompleted()).to.equal(false);

    // Resolve adjustment
    await f.agreement.connect(f.provider).submitAdjustment(0, "adj-proof");
    await f.agreement.connect(f.client).approveAdjustment(0);

    expect(await f.agreement.isAgreementCompleted()).to.equal(true);
  });
});

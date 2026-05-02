import "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { expect } from "chai";
import hre from "hardhat";
import type { Contract, ContractRunner } from "ethers";

type C = Omit<Contract, "connect"> & { connect(runner: null | ContractRunner): C };

const { ethers, networkHelpers } = await hre.network.create();

const REVIEW = 3 * 24 * 60 * 60;
const USDC = 1_000_000n;

async function deadlines() {
  const now = await networkHelpers.time.latest();
  return [now + 1000, now + 2000, now + 3000];
}

async function deployToken(name = "MockUSDC") {
  const token = (await ethers.deployContract(name)) as C;
  await token.waitForDeployment();
  return token;
}

async function deployAgreement(paymentToken = ethers.ZeroAddress, amountUnit = ethers.parseEther("1")) {
  const [client, provider, other] = await ethers.getSigners();
  const amounts = [amountUnit, amountUnit * 2n, amountUnit * 3n];
  const agreement = (await ethers.deployContract(
    "DealLockMultiAsset",
    [
      client.address,
      provider.address,
      paymentToken,
      ["Alpha", "Beta", "Gamma"],
      amounts,
      await deadlines(),
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

async function fundedTokenFixture(tokenName = "MockUSDC") {
  const token = await deployToken(tokenName);
  const f = await deployAgreement(await token.getAddress(), 100n * USDC);
  await token.mint(f.client.address, f.total + 1000n * USDC);
  await f.agreement.connect(f.provider).acceptAgreement();
  await token.connect(f.client).approve(await f.agreement.getAddress(), f.total);
  await f.agreement.connect(f.client).fundAgreement();
  return { ...f, token };
}

async function submittedTokenMilestoneFixture() {
  const f = await fundedTokenFixture();
  await f.agreement.connect(f.provider).submitMilestone(0, "ipfs://proof");
  return f;
}

async function submittedEthMilestoneFixture() {
  const f = await fundedEthFixture();
  await f.agreement.connect(f.provider).submitMilestone(0, "ipfs://proof");
  return f;
}

async function fundedTokenAdjustmentFixture() {
  const f = await submittedTokenMilestoneFixture();
  const now = await networkHelpers.time.latest();
  const adjAmount = 25n * USDC;
  await f.agreement.connect(f.client).requestAdjustment(0, "Extra", adjAmount, now + 2000);
  await f.agreement.connect(f.provider).acceptAdjustment(0);
  await f.token.mint(f.client.address, adjAmount);
  await f.token.connect(f.client).approve(await f.agreement.getAddress(), adjAmount);
  await f.agreement.connect(f.client).fundAdjustment(0);
  return { ...f, adjAmount };
}

async function expectHeld(agreement: C, expected: bigint, token?: C) {
  if (token) {
    expect(await token.balanceOf(await agreement.getAddress())).to.equal(expected);
  } else {
    expect(await ethers.provider.getBalance(await agreement.getAddress())).to.equal(expected);
  }
  expect(await agreement.getContractBalance()).to.equal(expected);
}

describe("DealLockMultiAsset", function () {
  it("1. contractVersion returns protocol version 5", async () => {
    const { agreement } = await deployAgreement();
    expect(await agreement.contractVersion()).to.equal(5n);
  });

  it("2. stores native payment token as zero address", async () => {
    const { agreement } = await deployAgreement();
    expect(await agreement.paymentToken()).to.equal(ethers.ZeroAddress);
    expect(await agreement.isNativePayment()).to.equal(true);
  });

  it("3. stores ERC-20 payment token", async () => {
    const token = await deployToken();
    const { agreement } = await deployAgreement(await token.getAddress(), 100n * USDC);
    expect(await agreement.paymentToken()).to.equal(await token.getAddress());
    expect(await agreement.isNativePayment()).to.equal(false);
  });

  it("4. rejects zero client", async () => {
    const [, provider] = await ethers.getSigners();
    await expect(
      ethers.deployContract("DealLockMultiAsset", [
        ethers.ZeroAddress,
        provider.address,
        ethers.ZeroAddress,
        ["A"],
        [1n],
        await deadlines(),
        REVIEW,
      ]),
    ).to.be.revertedWith("Invalid client");
  });

  it("5. rejects zero provider", async () => {
    const [client] = await ethers.getSigners();
    await expect(
      ethers.deployContract("DealLockMultiAsset", [
        client.address,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ["A"],
        [1n],
        await deadlines(),
        REVIEW,
      ]),
    ).to.be.revertedWith("Invalid provider");
  });

  it("6. rejects same client and provider", async () => {
    const [client] = await ethers.getSigners();
    await expect(
      ethers.deployContract("DealLockMultiAsset", [
        client.address,
        client.address,
        ethers.ZeroAddress,
        ["A"],
        [1n],
        await deadlines(),
        REVIEW,
      ]),
    ).to.be.revertedWith("Client and provider must differ");
  });

  it("7. rejects wrong native funding value", async () => {
    const { agreement, client, provider, total } = await deployAgreement();
    await agreement.connect(provider).acceptAgreement();
    await expect(agreement.connect(client).fundAgreement({ value: total - 1n }))
      .to.be.revertedWith("Incorrect funding amount");
  });

  it("8. funds native agreement exactly", async () => {
    const { agreement, client, provider, total } = await deployAgreement();
    await agreement.connect(provider).acceptAgreement();
    await expect(agreement.connect(client).fundAgreement({ value: total }))
      .to.emit(agreement, "AgreementFunded").withArgs(client.address, total);
    expect(await agreement.fundedAmount()).to.equal(total);
    await expectHeld(agreement, total);
  });

  it("9. releases native milestone", async () => {
    const { agreement, client, provider, amounts, total } = await fundedEthFixture();
    await agreement.connect(provider).submitMilestone(0, "proof");
    await expect(agreement.connect(client).approveMilestone(0))
      .to.changeEtherBalance(ethers, provider, amounts[0]);
    await expectHeld(agreement, total - amounts[0]);
  });

  it("10. refunds expired native milestone", async () => {
    const { agreement, client, amounts, total } = await fundedEthFixture();
    await networkHelpers.time.increase(1100);
    await expect(agreement.connect(client).refundExpiredMilestone(0))
      .to.changeEtherBalance(ethers, client, amounts[0]);
    await expectHeld(agreement, total - amounts[0]);
  });

  it("11. native auto-release after review works", async () => {
    const { agreement, provider, amounts, total } = await submittedEthMilestoneFixture();
    await networkHelpers.time.increase(REVIEW + 1);
    await expect(agreement.connect(provider).claimMilestoneAfterReview(0))
      .to.changeEtherBalance(ethers, provider, amounts[0]);
    await expectHeld(agreement, total - amounts[0]);
  });

  it("12. native settlement splits funds", async () => {
    const { agreement, client, provider, amounts, total } = await submittedEthMilestoneFixture();
    await agreement.connect(client).disputeMilestone(0, "bad");
    await agreement.connect(provider).proposeMilestoneSettlement(0, amounts[0] / 4n, "split");
    await agreement.connect(client).acceptMilestoneSettlement(0);
    expect(await agreement.releasedAmount()).to.equal(amounts[0] / 4n);
    expect(await agreement.refundedAmount()).to.equal(amounts[0] - amounts[0] / 4n);
    await expectHeld(agreement, total - amounts[0]);
  });

  it("13. cannot fund ERC-20 without approval", async () => {
    const token = await deployToken();
    const { agreement, client, provider, total } = await deployAgreement(await token.getAddress(), 100n * USDC);
    await token.mint(client.address, total);
    await agreement.connect(provider).acceptAgreement();
    await expect(agreement.connect(client).fundAgreement()).to.be.revertedWith("ERC20: insufficient allowance");
  });

  it("14. cannot fund ERC-20 with insufficient allowance", async () => {
    const token = await deployToken();
    const { agreement, client, provider, total } = await deployAgreement(await token.getAddress(), 100n * USDC);
    await token.mint(client.address, total);
    await agreement.connect(provider).acceptAgreement();
    await token.connect(client).approve(await agreement.getAddress(), total - 1n);
    await expect(agreement.connect(client).fundAgreement()).to.be.revertedWith("ERC20: insufficient allowance");
  });

  it("15. cannot fund ERC-20 with insufficient balance", async () => {
    const token = await deployToken();
    const { agreement, client, provider, total } = await deployAgreement(await token.getAddress(), 100n * USDC);
    await token.mint(client.address, total - 1n);
    await agreement.connect(provider).acceptAgreement();
    await token.connect(client).approve(await agreement.getAddress(), total);
    await expect(agreement.connect(client).fundAgreement()).to.be.revertedWith("ERC20: insufficient balance");
  });

  it("16. rejects ETH value on ERC-20 funding", async () => {
    const token = await deployToken();
    const { agreement, client, provider, total } = await deployAgreement(await token.getAddress(), 100n * USDC);
    await token.mint(client.address, total);
    await agreement.connect(provider).acceptAgreement();
    await token.connect(client).approve(await agreement.getAddress(), total);
    await expect(agreement.connect(client).fundAgreement({ value: 1n })).to.be.revertedWith("ETH not accepted");
  });

  it("17. funds ERC-20 after approval", async () => {
    const { agreement, token, total } = await fundedTokenFixture();
    expect(await agreement.fundedAmount()).to.equal(total);
    await expectHeld(agreement, total, token);
  });

  it("18. ERC-20 release pays provider", async () => {
    const { agreement, token, client, provider, amounts, total } = await submittedTokenMilestoneFixture();
    await agreement.connect(client).approveMilestone(0);
    expect(await token.balanceOf(provider.address)).to.equal(amounts[0]);
    expect(await agreement.releasedAmount()).to.equal(amounts[0]);
    await expectHeld(agreement, total - amounts[0], token);
  });

  it("19. ERC-20 refund pays client", async () => {
    const { agreement, token, client, amounts, total } = await fundedTokenFixture();
    await networkHelpers.time.increase(1100);
    const before = await token.balanceOf(client.address);
    await agreement.connect(client).refundExpiredMilestone(0);
    expect(await token.balanceOf(client.address)).to.equal(before + amounts[0]);
    expect(await agreement.refundedAmount()).to.equal(amounts[0]);
    await expectHeld(agreement, total - amounts[0], token);
  });

  it("20. ERC-20 auto-release pays provider", async () => {
    const { agreement, token, provider, amounts, total } = await submittedTokenMilestoneFixture();
    await networkHelpers.time.increase(REVIEW + 1);
    await agreement.connect(provider).claimMilestoneAfterReview(0);
    expect(await token.balanceOf(provider.address)).to.equal(amounts[0]);
    await expectHeld(agreement, total - amounts[0], token);
  });

  it("21. ERC-20 settlement splits to client and provider", async () => {
    const { agreement, token, client, provider, amounts, total } = await submittedTokenMilestoneFixture();
    await agreement.connect(client).disputeMilestone(0, "bad");
    await agreement.connect(provider).proposeMilestoneSettlement(0, 40n * USDC, "split");
    const clientBefore = await token.balanceOf(client.address);
    await agreement.connect(client).acceptMilestoneSettlement(0);
    expect(await token.balanceOf(provider.address)).to.equal(40n * USDC);
    expect(await token.balanceOf(client.address)).to.equal(clientBefore + amounts[0] - 40n * USDC);
    await expectHeld(agreement, total - amounts[0], token);
  });

  it("22. ERC-20 adjustment request/accept/fund/submit/approve works", async () => {
    const { agreement, token, client, provider, adjAmount, total } = await fundedTokenAdjustmentFixture();
    await agreement.connect(provider).submitAdjustment(0, "adj-proof");
    await agreement.connect(client).approveAdjustment(0);
    expect(await token.balanceOf(provider.address)).to.equal(adjAmount);
    await expectHeld(agreement, total, token);
  });

  it("23. ERC-20 adjustment refund works", async () => {
    const { agreement, token, client, adjAmount, total } = await fundedTokenAdjustmentFixture();
    await networkHelpers.time.increase(2100);
    const before = await token.balanceOf(client.address);
    await agreement.connect(client).refundExpiredAdjustment(0);
    expect(await token.balanceOf(client.address)).to.equal(before + adjAmount);
    await expectHeld(agreement, total, token);
  });

  it("24. ERC-20 adjustment auto-release works", async () => {
    const { agreement, token, provider, adjAmount, total } = await fundedTokenAdjustmentFixture();
    await agreement.connect(provider).submitAdjustment(0, "adj-proof");
    await networkHelpers.time.increase(REVIEW + 1);
    await agreement.connect(provider).claimAdjustmentAfterReview(0);
    expect(await token.balanceOf(provider.address)).to.equal(adjAmount);
    await expectHeld(agreement, total, token);
  });

  it("25. ERC-20 adjustment settlement works", async () => {
    const { agreement, token, client, provider, adjAmount, total } = await fundedTokenAdjustmentFixture();
    await agreement.connect(provider).submitAdjustment(0, "adj-proof");
    await agreement.connect(client).disputeAdjustment(0, "bad");
    await agreement.connect(provider).proposeAdjustmentSettlement(0, adjAmount / 2n, "half");
    await agreement.connect(client).acceptAdjustmentSettlement(0);
    expect(await token.balanceOf(provider.address)).to.equal(adjAmount / 2n);
    await expectHeld(agreement, total, token);
  });

  it("26. multiple ERC-20 adjustments resolve independently", async () => {
    const f = await fundedTokenAdjustmentFixture();
    const now = await networkHelpers.time.latest();
    await f.agreement.connect(f.client).requestAdjustment(0, "Extra 2", 10n * USDC, now + 3000);
    await f.agreement.connect(f.provider).acceptAdjustment(1);
    await f.token.mint(f.client.address, 10n * USDC);
    await f.token.connect(f.client).approve(await f.agreement.getAddress(), 10n * USDC);
    await f.agreement.connect(f.client).fundAdjustment(1);
    await f.agreement.connect(f.provider).submitAdjustment(0, "a0");
    await f.agreement.connect(f.client).approveAdjustment(0);
    await networkHelpers.time.increase(3100);
    await f.agreement.connect(f.client).refundExpiredAdjustment(1);
    expect(await f.agreement.adjustmentReleasedAmount()).to.equal(f.adjAmount);
    expect(await f.agreement.adjustmentRefundedAmount()).to.equal(10n * USDC);
  });

  it("27. fee-on-transfer tokens are rejected", async () => {
    const token = await deployToken("FeeOnTransferToken");
    const { agreement, client, provider, total } = await deployAgreement(await token.getAddress(), 100n * USDC);
    await token.mint(client.address, total);
    await agreement.connect(provider).acceptAgreement();
    await token.connect(client).approve(await agreement.getAddress(), total);
    await expect(agreement.connect(client).fundAgreement()).to.be.revertedWith("Unsupported token transfer");
  });

  it("28. SafeERC20 rejects bad false returns", async () => {
    const token = await deployToken("BadReturnERC20");
    const { agreement, client, provider, total } = await deployAgreement(await token.getAddress(), 100n * USDC);
    await token.mint(client.address, total);
    await agreement.connect(provider).acceptAgreement();
    await token.connect(client).approve(await agreement.getAddress(), total);
    await token.setFailTransfers(true);
    await expect(agreement.connect(client).fundAgreement()).to.be.revertedWith("ERC20 transferFrom failed");
  });

  it("29. reentrant token cannot exploit release", async () => {
    const token = await deployToken("ReentrantERC20");
    const { agreement, client, provider, total } = await deployAgreement(await token.getAddress(), 100n * USDC);
    await token.mint(client.address, total);
    await agreement.connect(provider).acceptAgreement();
    await token.connect(client).approve(await agreement.getAddress(), total);
    await agreement.connect(client).fundAgreement();
    await agreement.connect(provider).submitMilestone(0, "proof");
    await token.setAttack(await agreement.getAddress(), true);
    await expect(agreement.connect(client).approveMilestone(0)).to.be.revertedWith("Only client");
  });

  it("30. wrong caller cannot release, refund, or settle", async () => {
    const { agreement, provider, other } = await submittedTokenMilestoneFixture();
    await expect(agreement.connect(provider).approveMilestone(0)).to.be.revertedWith("Only client");
    await expect(agreement.connect(other).refundExpiredMilestone(0)).to.be.revertedWith("Only client");
    await agreement.connect((await ethers.getSigners())[0]).disputeMilestone(0, "bad");
    await expect(agreement.connect(other).acceptMilestoneSettlement(0)).to.be.revertedWith("Only client or provider");
  });

  it("31. completion requires all milestones and funded adjustments terminal", async () => {
    const f = await fundedTokenAdjustmentFixture();
    await f.agreement.connect(f.client).approveMilestone(0);
    await f.agreement.connect(f.provider).submitMilestone(1, "m1");
    await f.agreement.connect(f.client).approveMilestone(1);
    await f.agreement.connect(f.provider).submitMilestone(2, "m2");
    await f.agreement.connect(f.client).approveMilestone(2);
    expect(await f.agreement.isAgreementCompleted()).to.equal(false);
    await f.agreement.connect(f.provider).submitAdjustment(0, "a0");
    await f.agreement.connect(f.client).approveAdjustment(0);
    expect(await f.agreement.isAgreementCompleted()).to.equal(true);
  });

  it("32. native adjustment lifecycle works", async () => {
    const f = await submittedEthMilestoneFixture();
    const now = await networkHelpers.time.latest();
    const amount = ethers.parseEther("0.25");
    await f.agreement.connect(f.client).requestAdjustment(0, "Extra", amount, now + 2000);
    await f.agreement.connect(f.provider).acceptAdjustment(0);
    await f.agreement.connect(f.client).fundAdjustment(0, { value: amount });
    await f.agreement.connect(f.provider).submitAdjustment(0, "proof");
    await expect(f.agreement.connect(f.client).approveAdjustment(0))
      .to.changeEtherBalance(ethers, f.provider, amount);
  });

  it("33. rejects empty descriptions", async () => {
    const [client, provider] = await ethers.getSigners();
    const now = await networkHelpers.time.latest();
    await expect(
      ethers.deployContract("DealLockMultiAsset", [
        client.address,
        provider.address,
        ethers.ZeroAddress,
        [""],
        [1n],
        [now + 1000],
        REVIEW,
      ]),
    ).to.be.revertedWith("Empty description");
  });

  it("34. rejects zero milestone amount", async () => {
    const [client, provider] = await ethers.getSigners();
    const now = await networkHelpers.time.latest();
    await expect(
      ethers.deployContract("DealLockMultiAsset", [
        client.address,
        provider.address,
        ethers.ZeroAddress,
        ["A"],
        [0n],
        [now + 1000],
        REVIEW,
      ]),
    ).to.be.revertedWith("Zero milestone amount");
  });

  it("35. rejects unsorted deadlines", async () => {
    const [client, provider] = await ethers.getSigners();
    const now = await networkHelpers.time.latest();
    await expect(
      ethers.deployContract("DealLockMultiAsset", [
        client.address,
        provider.address,
        ethers.ZeroAddress,
        ["A", "B"],
        [1n, 1n],
        [now + 2000, now + 1000],
        REVIEW,
      ]),
    ).to.be.revertedWith("Deadlines not sorted");
  });

  it("36. receive rejects direct ETH transfers", async () => {
    const { agreement, client } = await deployAgreement();
    await expect(client.sendTransaction({ to: await agreement.getAddress(), value: 1n }))
      .to.be.revertedWith("Use fundAgreement or fundAdjustment");
  });

  it("37. fallback rejects invalid calls", async () => {
    const { agreement, client } = await deployAgreement();
    await expect(client.sendTransaction({ to: await agreement.getAddress(), data: "0x12345678" }))
      .to.be.revertedWith("Invalid call");
  });

  it("38. ERC-20 adjustment funding rejects ETH value", async () => {
    const f = await submittedTokenMilestoneFixture();
    const now = await networkHelpers.time.latest();
    await f.agreement.connect(f.client).requestAdjustment(0, "Extra", 10n * USDC, now + 2000);
    await f.agreement.connect(f.provider).acceptAdjustment(0);
    await f.token.mint(f.client.address, 10n * USDC);
    await f.token.connect(f.client).approve(await f.agreement.getAddress(), 10n * USDC);
    await expect(f.agreement.connect(f.client).fundAdjustment(0, { value: 1n }))
      .to.be.revertedWith("ETH not accepted");
  });

  it("39. native funding rejects missing ETH", async () => {
    const { agreement, client, provider } = await deployAgreement();
    await agreement.connect(provider).acceptAgreement();
    await expect(agreement.connect(client).fundAgreement()).to.be.revertedWith("Incorrect funding amount");
  });

  it("40. native adjustment funding rejects wrong ETH amount", async () => {
    const f = await submittedEthMilestoneFixture();
    const now = await networkHelpers.time.latest();
    const amount = ethers.parseEther("0.25");
    await f.agreement.connect(f.client).requestAdjustment(0, "Extra", amount, now + 2000);
    await f.agreement.connect(f.provider).acceptAdjustment(0);
    await expect(f.agreement.connect(f.client).fundAdjustment(0, { value: amount - 1n }))
      .to.be.revertedWith("Incorrect funding amount");
  });

  it("41. cancelled accepted adjustment remains terminal for completion", async () => {
    const f = await submittedTokenMilestoneFixture();
    const now = await networkHelpers.time.latest();
    await f.agreement.connect(f.client).requestAdjustment(0, "Extra", 10n * USDC, now + 2000);
    await f.agreement.connect(f.provider).acceptAdjustment(0);
    await f.agreement.connect(f.provider).cancelAdjustment(0);
    await f.agreement.connect(f.client).approveMilestone(0);
    await f.agreement.connect(f.provider).submitMilestone(1, "m1");
    await f.agreement.connect(f.client).approveMilestone(1);
    await f.agreement.connect(f.provider).submitMilestone(2, "m2");
    await f.agreement.connect(f.client).approveMilestone(2);
    expect(await f.agreement.isAgreementCompleted()).to.equal(true);
  });

  it("42. getContractBalance reports ERC-20 balance after partial release", async () => {
    const { agreement, token, client, provider, amounts, total } = await submittedTokenMilestoneFixture();
    await agreement.connect(client).approveMilestone(0);
    expect(await agreement.getContractBalance()).to.equal(total - amounts[0]);
    await agreement.connect(provider).submitMilestone(1, "m1");
    await agreement.connect(client).approveMilestone(1);
    expect(await agreement.getContractBalance()).to.equal(total - amounts[0] - amounts[1]);
    await expectHeld(agreement, total - amounts[0] - amounts[1], token);
  });

  it("43. ERC-20 accounting invariant holds after mixed settlement and release", async () => {
    const f = await submittedTokenMilestoneFixture();
    await f.agreement.connect(f.client).disputeMilestone(0, "bad");
    await f.agreement.connect(f.provider).proposeMilestoneSettlement(0, 10n * USDC, "split");
    await f.agreement.connect(f.client).acceptMilestoneSettlement(0);
    await f.agreement.connect(f.provider).submitMilestone(1, "m1");
    await f.agreement.connect(f.client).approveMilestone(1);
    const released = await f.agreement.releasedAmount();
    const refunded = await f.agreement.refundedAmount();
    const held = await f.agreement.getContractBalance();
    expect(released + refunded + held).to.equal(f.total);
  });

  it("44. SafeERC20 rejects bad false return on transfer (sendPayment path)", async () => {
    const token = await deployToken("BadReturnERC20");
    const { agreement, client, provider, total } = await deployAgreement(await token.getAddress(), 100n * USDC);
    await token.mint(client.address, total);
    await agreement.connect(provider).acceptAgreement();
    await token.connect(client).approve(await agreement.getAddress(), total);
    await agreement.connect(client).fundAgreement();
    await agreement.connect(provider).submitMilestone(0, "proof");
    await token.setFailTransfers(true);
    await expect(agreement.connect(client).approveMilestone(0)).to.be.revertedWith("ERC20 transfer failed");
  });

  it("45. fundAdjustment rejects insufficient ERC-20 allowance", async () => {
    const f = await submittedTokenMilestoneFixture();
    const now = await networkHelpers.time.latest();
    const adjAmount = 25n * USDC;
    await f.agreement.connect(f.client).requestAdjustment(0, "Extra", adjAmount, now + 2000);
    await f.agreement.connect(f.provider).acceptAdjustment(0);
    await f.token.mint(f.client.address, adjAmount);
    await f.token.connect(f.client).approve(await f.agreement.getAddress(), adjAmount - 1n);
    await expect(f.agreement.connect(f.client).fundAdjustment(0)).to.be.revertedWith("ERC20: insufficient allowance");
  });
});

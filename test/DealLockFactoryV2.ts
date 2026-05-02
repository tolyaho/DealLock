import "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { expect } from "chai";
import hre from "hardhat";
import type { Contract, ContractRunner } from "ethers";

type C = Omit<Contract, "connect"> & { connect(runner: null | ContractRunner): C };

const { ethers, networkHelpers } = await hre.network.create();
const REVIEW = 3 * 24 * 60 * 60;
const DESCRIPTIONS = ["Design", "Build"];
const AMOUNTS = [100n, 200n];
const HASH = ethers.ZeroHash;

async function deadlines() {
  const now = await networkHelpers.time.latest();
  return [now + 1000, now + 2000];
}

async function fixture() {
  const [client, provider, other] = await ethers.getSigners();
  const factory = (await ethers.deployContract("DealLockFactoryV2")) as C;
  const token = (await ethers.deployContract("MockUSDC")) as C;
  await factory.waitForDeployment();
  await token.waitForDeployment();
  return { factory, token, client, provider, other };
}

async function create(factory: C, client: any, provider: any, paymentToken = ethers.ZeroAddress) {
  const tx = await factory
    .connect(client)
    .createAgreement(paymentToken === ethers.ZeroAddress ? provider.address : provider.address, paymentToken, DESCRIPTIONS, AMOUNTS, await deadlines(), REVIEW, HASH);
  const receipt = await tx.wait();
  let agreement = "";
  let eventArgs: any = {};
  for (const log of receipt!.logs) {
    try {
      const parsed = factory.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "AgreementCreated") {
        agreement = parsed.args.agreement;
        eventArgs = parsed.args;
        break;
      }
    } catch {}
  }
  return { agreement, eventArgs };
}

describe("DealLockFactoryV2", function () {
  it("1. factoryVersion returns 2", async () => {
    const { factory } = await fixture();
    expect(await factory.factoryVersion()).to.equal(2n);
  });

  it("2. creates native ETH multi-asset agreement", async () => {
    const { factory, client, provider } = await fixture();
    const { agreement } = await create(factory, client, provider);
    const a = (await ethers.getContractAt("DealLockMultiAsset", agreement)) as C;
    expect(await a.contractVersion()).to.equal(5n);
    expect(await a.paymentToken()).to.equal(ethers.ZeroAddress);
    expect(await a.isNativePayment()).to.equal(true);
  });

  it("3. creates ERC-20 multi-asset agreement", async () => {
    const { factory, token, client, provider } = await fixture();
    const { agreement } = await create(factory, client, provider, await token.getAddress());
    const a = (await ethers.getContractAt("DealLockMultiAsset", agreement)) as C;
    expect(await a.paymentToken()).to.equal(await token.getAddress());
    expect(await a.isNativePayment()).to.equal(false);
  });

  it("4. created agreement client is caller, not factory", async () => {
    const { factory, client, provider } = await fixture();
    const { agreement } = await create(factory, client, provider);
    const a = (await ethers.getContractAt("DealLockMultiAsset", agreement)) as C;
    expect(await a.client()).to.equal(client.address);
    expect(await a.client()).to.not.equal(await factory.getAddress());
  });

  it("5. event includes payment token and version 5", async () => {
    const { factory, token, client, provider } = await fixture();
    const { agreement, eventArgs } = await create(factory, client, provider, await token.getAddress());
    expect(eventArgs.agreement).to.equal(agreement);
    expect(eventArgs.client).to.equal(client.address);
    expect(eventArgs.provider).to.equal(provider.address);
    expect(eventArgs.contractVersion).to.equal(5n);
    expect(eventArgs.paymentToken).to.equal(await token.getAddress());
    expect(eventArgs.totalAmount).to.equal(300n);
  });

  it("6. global registry records agreements", async () => {
    const { factory, client, provider } = await fixture();
    const one = await create(factory, client, provider);
    const two = await create(factory, client, provider);
    expect(await factory.agreementCount()).to.equal(2n);
    expect(await factory.getAgreement(0)).to.equal(one.agreement);
    expect(await factory.getAgreement(1)).to.equal(two.agreement);
    expect(await factory.isDealLockAgreement(one.agreement)).to.equal(true);
  });

  it("7. pagination works", async () => {
    const { factory, client, provider } = await fixture();
    const one = await create(factory, client, provider);
    const two = await create(factory, client, provider);
    expect(await factory.getAgreements(0, 1)).to.deep.equal([one.agreement]);
    expect(await factory.getAgreements(1, 1)).to.deep.equal([two.agreement]);
    expect(await factory.getAgreements(10, 1)).to.deep.equal([]);
  });

  it("8. client registry works", async () => {
    const { factory, client, provider } = await fixture();
    const { agreement } = await create(factory, client, provider);
    expect(await factory.getClientAgreementCount(client.address)).to.equal(1n);
    expect(await factory.getClientAgreements(client.address, 0, 10)).to.deep.equal([agreement]);
  });

  it("9. provider registry works", async () => {
    const { factory, client, provider } = await fixture();
    const { agreement } = await create(factory, client, provider);
    expect(await factory.getProviderAgreementCount(provider.address)).to.equal(1n);
    expect(await factory.getProviderAgreements(provider.address, 0, 10)).to.deep.equal([agreement]);
  });

  it("10. rejects zero provider", async () => {
    const { factory, client } = await fixture();
    await expect(
      factory.connect(client).createAgreement(ethers.ZeroAddress, ethers.ZeroAddress, DESCRIPTIONS, AMOUNTS, await deadlines(), REVIEW, HASH),
    ).to.be.revertedWith("Invalid provider");
  });

  it("11. rejects provider equal to client", async () => {
    const { factory, client } = await fixture();
    await expect(
      factory.connect(client).createAgreement(client.address, ethers.ZeroAddress, DESCRIPTIONS, AMOUNTS, await deadlines(), REVIEW, HASH),
    ).to.be.revertedWith("Provider must differ from client");
  });

  it("12. rejects empty milestones", async () => {
    const { factory, client, provider } = await fixture();
    await expect(
      factory.connect(client).createAgreement(provider.address, ethers.ZeroAddress, [], [], [], REVIEW, HASH),
    ).to.be.revertedWith("No milestones");
  });

  it("13. rejects mismatched arrays", async () => {
    const { factory, client, provider } = await fixture();
    await expect(
      factory.connect(client).createAgreement(provider.address, ethers.ZeroAddress, ["A"], [1n, 2n], await deadlines(), REVIEW, HASH),
    ).to.be.revertedWith("Array length mismatch");
  });

  it("14. factory does not accept ETH", async () => {
    const { factory, client, provider } = await fixture();
    await expect(
      factory.connect(client).createAgreement(provider.address, ethers.ZeroAddress, DESCRIPTIONS, AMOUNTS, await deadlines(), REVIEW, HASH, { value: 1n }),
    ).to.be.revertedWith("Factory does not accept ETH");
  });

  it("15. deployed ETH agreement can be funded", async () => {
    const { factory, client, provider } = await fixture();
    const { agreement } = await create(factory, client, provider);
    const a = (await ethers.getContractAt("DealLockMultiAsset", agreement)) as C;
    await a.connect(provider).acceptAgreement();
    await a.connect(client).fundAgreement({ value: 300n });
    expect(await a.getContractBalance()).to.equal(300n);
  });

  it("16. deployed ERC-20 agreement can be funded after approval", async () => {
    const { factory, token, client, provider } = await fixture();
    const { agreement } = await create(factory, client, provider, await token.getAddress());
    const a = (await ethers.getContractAt("DealLockMultiAsset", agreement)) as C;
    await token.mint(client.address, 300n);
    await token.connect(client).approve(agreement, 300n);
    await a.connect(provider).acceptAgreement();
    await a.connect(client).fundAgreement();
    expect(await token.balanceOf(agreement)).to.equal(300n);
  });

  it("17. old Factory V1 still creates version 4 agreements", async () => {
    const [client, provider] = await ethers.getSigners();
    const oldFactory = (await ethers.deployContract("DealLockFactory")) as C;
    const tx = await oldFactory
      .connect(client)
      .createAgreement(provider.address, DESCRIPTIONS, AMOUNTS, await deadlines(), REVIEW, HASH);
    const receipt = await tx.wait();
    let agreement = "";
    for (const log of receipt!.logs) {
      try {
        const parsed = oldFactory.interface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed?.name === "AgreementCreated") agreement = parsed.args.agreement;
      } catch {}
    }
    const a = (await ethers.getContractAt("DealLockV5", agreement)) as C;
    expect(await a.contractVersion()).to.equal(4n);
  });
});

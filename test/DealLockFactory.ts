import "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { expect } from "chai";
import hre from "hardhat";
import type { Contract, ContractRunner } from "ethers";

type DealLockFactoryContract = Omit<Contract, "connect"> & {
  connect(runner: null | ContractRunner): DealLockFactoryContract;
};

type DealLockV4FCContract = Omit<Contract, "connect"> & {
  connect(runner: null | ContractRunner): DealLockV4FCContract;
};

const { ethers, networkHelpers } = await hre.network.create();

const REVIEW_PERIOD = 3 * 24 * 60 * 60; // 3 days

const DESCRIPTIONS = ["Design mockups", "Functional build"];
const AMOUNTS = [ethers.parseEther("1"), ethers.parseEther("2")];
const METADATA_HASH = ethers.ZeroHash;

async function deployFactoryFixture() {
  const [client, provider, other] = await ethers.getSigners();
  const factory = (await ethers.deployContract("DealLockFactory")) as DealLockFactoryContract;
  return { factory, client, provider, other };
}

async function freshDeadlines() {
  const now = await networkHelpers.time.latest();
  return [now + 100, now + 200];
}

async function createAgreement(factory: DealLockFactoryContract, client: any, provider: any) {
  const deadlines = await freshDeadlines();
  const tx = await factory
    .connect(client)
    .createAgreement(provider.address, DESCRIPTIONS, AMOUNTS, deadlines, REVIEW_PERIOD, METADATA_HASH);
  const receipt = await tx.wait();
  const iface = factory.interface;
  let agreementAddr = "";
  let eventArgs: Record<string, any> = {};
  for (const log of receipt!.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "AgreementCreated") {
        agreementAddr = parsed.args.agreement;
        eventArgs = parsed.args;
        break;
      }
    } catch {
      // skip
    }
  }
  return { receipt, agreementAddr, eventArgs };
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe("DealLockFactory", function () {
  // 1. Factory deploys successfully
  it("1. factory deploys successfully", async () => {
    const { factory } = await deployFactoryFixture();
    expect(await factory.getAddress()).to.be.properAddress;
  });

  // 2. factoryVersion() returns 1
  it("2. factoryVersion() returns 1", async () => {
    const { factory } = await deployFactoryFixture();
    expect(await factory.factoryVersion()).to.equal(1n);
  });

  // 3. createAgreement deploys a V4-compatible agreement
  it("3. createAgreement deploys a V4-compatible agreement", async () => {
    const { factory, client, provider } = await deployFactoryFixture();
    const { agreementAddr } = await createAgreement(factory, client, provider);
    expect(agreementAddr).to.be.properAddress;
    const agreement = (await ethers.getContractAt(
      "DealLockV5",
      agreementAddr,
    )) as DealLockV4FCContract;
    expect(await agreement.contractVersion()).to.equal(4n);
  });

  // 4. Created agreement has client == caller, not factory
  it("4. created agreement has client == caller, not factory", async () => {
    const { factory, client, provider } = await deployFactoryFixture();
    const { agreementAddr } = await createAgreement(factory, client, provider);
    const agreement = (await ethers.getContractAt(
      "DealLockV5",
      agreementAddr,
    )) as DealLockV4FCContract;
    const factoryAddr = (await factory.getAddress()).toLowerCase();
    const clientOnChain = (await agreement.client()).toLowerCase();
    expect(clientOnChain).to.equal(client.address.toLowerCase());
    expect(clientOnChain).to.not.equal(factoryAddr);
  });

  // 5. Created agreement has correct provider
  it("5. created agreement has correct provider", async () => {
    const { factory, client, provider } = await deployFactoryFixture();
    const { agreementAddr } = await createAgreement(factory, client, provider);
    const agreement = (await ethers.getContractAt(
      "DealLockV5",
      agreementAddr,
    )) as DealLockV4FCContract;
    expect((await agreement.provider()).toLowerCase()).to.equal(provider.address.toLowerCase());
  });

  // 6. Created agreement has correct total amount and milestones
  it("6. created agreement has correct total amount and milestones", async () => {
    const { factory, client, provider } = await deployFactoryFixture();
    const { agreementAddr } = await createAgreement(factory, client, provider);
    const agreement = (await ethers.getContractAt(
      "DealLockV5",
      agreementAddr,
    )) as DealLockV4FCContract;
    const expectedTotal = AMOUNTS.reduce((a, b) => a + b, 0n);
    expect(await agreement.totalAmount()).to.equal(expectedTotal);
    expect(await agreement.getMilestoneCount()).to.equal(BigInt(DESCRIPTIONS.length));
  });

  // 7. Created agreement has correct review period
  it("7. created agreement has correct review period", async () => {
    const { factory, client, provider } = await deployFactoryFixture();
    const { agreementAddr } = await createAgreement(factory, client, provider);
    const agreement = (await ethers.getContractAt(
      "DealLockV5",
      agreementAddr,
    )) as DealLockV4FCContract;
    expect(await agreement.reviewPeriod()).to.equal(BigInt(REVIEW_PERIOD));
  });

  // 8. AgreementCreated emits correct fields
  it("8. AgreementCreated emits correct agreement, client, provider, chainId, version, milestoneCount, totalAmount, reviewPeriod, metadataHash", async () => {
    const { factory, client, provider } = await deployFactoryFixture();
    const { agreementAddr, eventArgs } = await createAgreement(factory, client, provider);
    expect(eventArgs.agreement.toLowerCase()).to.equal(agreementAddr.toLowerCase());
    expect(eventArgs.client.toLowerCase()).to.equal(client.address.toLowerCase());
    expect(eventArgs.provider.toLowerCase()).to.equal(provider.address.toLowerCase());
    const network = await ethers.provider.getNetwork();
    expect(eventArgs.chainId).to.equal(network.chainId);
    expect(eventArgs.contractVersion).to.equal(4n);
    expect(eventArgs.milestoneCount).to.equal(BigInt(DESCRIPTIONS.length));
    const expectedTotal = AMOUNTS.reduce((a, b) => a + b, 0n);
    expect(eventArgs.totalAmount).to.equal(expectedTotal);
    expect(eventArgs.reviewPeriod).to.equal(BigInt(REVIEW_PERIOD));
    expect(eventArgs.metadataHash).to.equal(METADATA_HASH);
  });

  // 9. Factory records agreement in global registry
  it("9. factory records agreement in global registry", async () => {
    const { factory, client, provider } = await deployFactoryFixture();
    const { agreementAddr } = await createAgreement(factory, client, provider);
    expect(await factory.agreementCount()).to.equal(1n);
    expect((await factory.getAgreement(0)).toLowerCase()).to.equal(
      agreementAddr.toLowerCase(),
    );
  });

  // 10. Factory records agreement by client
  it("10. factory records agreement by client", async () => {
    const { factory, client, provider } = await deployFactoryFixture();
    const { agreementAddr } = await createAgreement(factory, client, provider);
    expect(await factory.getClientAgreementCount(client.address)).to.equal(1n);
    const list = await factory.getClientAgreements(client.address, 0, 10);
    expect(list[0].toLowerCase()).to.equal(agreementAddr.toLowerCase());
  });

  // 11. Factory records agreement by provider
  it("11. factory records agreement by provider", async () => {
    const { factory, client, provider } = await deployFactoryFixture();
    const { agreementAddr } = await createAgreement(factory, client, provider);
    expect(await factory.getProviderAgreementCount(provider.address)).to.equal(1n);
    const list = await factory.getProviderAgreements(provider.address, 0, 10);
    expect(list[0].toLowerCase()).to.equal(agreementAddr.toLowerCase());
  });

  // 12. Pagination helpers work
  it("12. pagination helpers work", async () => {
    const { factory, client, provider } = await deployFactoryFixture();
    const r1 = await createAgreement(factory, client, provider);
    const r2 = await createAgreement(factory, client, provider);

    expect(await factory.agreementCount()).to.equal(2n);

    const page0 = await factory.getAgreements(0, 1);
    expect(page0.length).to.equal(1);
    expect(page0[0].toLowerCase()).to.equal(r1.agreementAddr.toLowerCase());

    const page1 = await factory.getAgreements(1, 1);
    expect(page1.length).to.equal(1);
    expect(page1[0].toLowerCase()).to.equal(r2.agreementAddr.toLowerCase());

    const all = await factory.getAgreements(0, 10);
    expect(all.length).to.equal(2);

    const empty = await factory.getAgreements(5, 10);
    expect(empty.length).to.equal(0);
  });

  // 13. isDealLockAgreement returns true for factory-created address
  it("13. isDealLockAgreement[agreement] == true", async () => {
    const { factory, client, provider } = await deployFactoryFixture();
    const { agreementAddr } = await createAgreement(factory, client, provider);
    expect(await factory.isDealLockAgreement(agreementAddr)).to.be.true;
  });

  // 14. Cannot create with zero provider
  it("14. cannot create with zero provider", async () => {
    const { factory, client } = await deployFactoryFixture();
    const deadlines = await freshDeadlines();
    await expect(
      factory
        .connect(client)
        .createAgreement(
          ethers.ZeroAddress,
          DESCRIPTIONS,
          AMOUNTS,
          deadlines,
          REVIEW_PERIOD,
          METADATA_HASH,
        ),
    ).to.be.revertedWith("Invalid provider");
  });

  // 15. Cannot create with provider equal to client
  it("15. cannot create with provider equal to client", async () => {
    const { factory, client } = await deployFactoryFixture();
    const deadlines = await freshDeadlines();
    await expect(
      factory
        .connect(client)
        .createAgreement(
          client.address,
          DESCRIPTIONS,
          AMOUNTS,
          deadlines,
          REVIEW_PERIOD,
          METADATA_HASH,
        ),
    ).to.be.revertedWith("Provider must differ from client");
  });

  // 16. Cannot create with empty milestones
  it("16. cannot create with empty milestones", async () => {
    const { factory, client, provider } = await deployFactoryFixture();
    const deadlines = await freshDeadlines();
    await expect(
      factory
        .connect(client)
        .createAgreement(provider.address, [], [], [], REVIEW_PERIOD, METADATA_HASH),
    ).to.be.revertedWith("No milestones");
  });

  // 17. Cannot create with mismatched milestone arrays
  it("17. cannot create with mismatched milestone arrays", async () => {
    const { factory, client, provider } = await deployFactoryFixture();
    const deadlines = await freshDeadlines();
    await expect(
      factory
        .connect(client)
        .createAgreement(
          provider.address,
          DESCRIPTIONS,
          [ethers.parseEther("1")],
          deadlines,
          REVIEW_PERIOD,
          METADATA_HASH,
        ),
    ).to.be.revertedWith("Array length mismatch");
  });

  // 18. Cannot send ETH to factory createAgreement (non-payable)
  it("18. cannot send ETH to factory createAgreement (non-payable)", async () => {
    const { factory, client, provider } = await deployFactoryFixture();
    const deadlines = await freshDeadlines();
    const factoryAddr = await factory.getAddress();
    const iface = factory.interface;
    let reverted = false;
    try {
      await client.sendTransaction({
        to: factoryAddr,
        value: ethers.parseEther("0.01"),
        data: iface.encodeFunctionData("createAgreement", [
          provider.address,
          DESCRIPTIONS,
          AMOUNTS,
          deadlines,
          REVIEW_PERIOD,
          METADATA_HASH,
        ]),
      });
    } catch {
      reverted = true;
    }
    expect(reverted).to.be.true;
  });

  // 19. Deployed agreement full workflow: accept → fund → submit → approve
  it("19. deployed agreement workflow: provider accepts, client funds, provider submits, client approves", async () => {
    const { factory, client, provider } = await deployFactoryFixture();
    const { agreementAddr } = await createAgreement(factory, client, provider);
    const agreement = (await ethers.getContractAt(
      "DealLockV5",
      agreementAddr,
    )) as DealLockV4FCContract;

    await agreement.connect(provider).acceptAgreement();

    const total = AMOUNTS.reduce((a, b) => a + b, 0n);
    await agreement.connect(client).fundAgreement({ value: total });

    await agreement.connect(provider).submitMilestone(0, "https://proof.example/m0");

    const providerBalBefore = await ethers.provider.getBalance(provider.address);
    const approveTx = await agreement.connect(client).approveMilestone(0);
    const approveReceipt = await approveTx.wait();
    const providerBalAfter = await ethers.provider.getBalance(provider.address);

    expect(providerBalAfter - providerBalBefore).to.be.closeTo(
      AMOUNTS[0],
      ethers.parseEther("0.01"),
    );
    expect(approveReceipt).to.not.be.null;
  });

  // 20. DealLockV4 direct deployment still works and is not in factory registry
  it("20. DealLockV4 direct deployment still works and is not registered in factory", async () => {
    const { factory, client, provider } = await deployFactoryFixture();
    const now = await networkHelpers.time.latest();
    const v4 = await ethers.deployContract("DealLockV4", [
      provider.address,
      ["Solo milestone"],
      [ethers.parseEther("1")],
      [now + 500],
      BigInt(REVIEW_PERIOD),
    ]);
    expect(await v4.contractVersion()).to.equal(4n);
    expect((await v4.client()).toLowerCase()).to.equal(client.address.toLowerCase());
    expect(await factory.isDealLockAgreement(await v4.getAddress())).to.be.false;
    expect(await factory.agreementCount()).to.equal(0n);
  });
});

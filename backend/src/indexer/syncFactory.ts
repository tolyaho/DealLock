import { type Address, type PublicClient, decodeEventLog, type Hex } from "viem";
import { Prisma } from "@prisma/client";
import { db } from "../db.js";
import type { IndexerConfig, FactoryContractConfig } from "./config.js";
import { DEALLOCK_FACTORY_EVENTS, DEALLOCK_FACTORY_V2_EVENTS } from "./abis.js";
import { blockTimestamp } from "./timestamp.js";
import { storeChainEvent } from "./store.js";

export interface SyncFactoryResult {
  eventsFound: number;
}

function minBigint(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function deployedContractVersion(factoryVersion: number): number {
  if (factoryVersion === 3) return 6;
  if (factoryVersion === 2) return 5;
  return 4;
}

function paymentMetadata(chainId: number, paymentToken: string | null) {
  const token = paymentToken?.toLowerCase() ?? ZERO_ADDRESS;
  if (token === ZERO_ADDRESS) {
    return {
      paymentAssetKind: "native",
      paymentTokenAddress: null,
      paymentSymbol: "ETH",
      paymentDecimals: 18,
    };
  }
  const configuredUsdc =
    chainId === 11155111
      ? process.env.USDC_SEPOLIA_ADDRESS?.toLowerCase()
      : chainId === 31337
        ? process.env.USDC_HARDHAT_ADDRESS?.toLowerCase()
        : undefined;
  return {
    paymentAssetKind: "erc20",
    paymentTokenAddress: token,
    paymentSymbol: configuredUsdc === token ? "USDC" : "ERC-20",
    paymentDecimals: configuredUsdc === token ? 6 : 18,
  };
}

/**
 * Sync one factory contract for AgreementCreated events.
 * When a new agreement is found, it is upserted into the Agreement table
 * so the normal agreement indexer will pick it up on the next tick.
 */
export async function syncFactory(args: {
  factory: FactoryContractConfig;
  client: PublicClient;
  config: IndexerConfig;
  confirmedHead: bigint;
}): Promise<SyncFactoryResult> {
  const { factory, client, config, confirmedHead } = args;
  const factoryAddr = factory.address.toLowerCase();

  // Load or create the FactoryContract row.
  let row = await db.factoryContract.findUnique({
    where: { chainId_address: { chainId: factory.chainId, address: factoryAddr } },
  });

  if (!row) {
    row = await db.factoryContract.create({
      data: {
        chainId: factory.chainId,
        address: factoryAddr,
        contractVersion: deployedContractVersion(factory.factoryVersion),
        factoryVersion: factory.factoryVersion,
        indexerStatus: "active",
      },
    });
  } else if (row.factoryVersion !== factory.factoryVersion) {
    row = await db.factoryContract.update({
      where: { id: row.id },
      data: {
        factoryVersion: factory.factoryVersion,
        contractVersion: deployedContractVersion(factory.factoryVersion),
      },
    });
  }

  const fromBlock =
    row.lastIndexedBlock != null
      ? row.lastIndexedBlock + 1n
      : row.deploymentBlock != null
        ? row.deploymentBlock
        : confirmedHead > config.lookbackBlocks
          ? confirmedHead - config.lookbackBlocks
          : 0n;

  if (fromBlock > confirmedHead) {
    await db.factoryContract.update({
      where: { id: row.id },
      data: { lastIndexedBlock: confirmedHead, lastIndexedAt: new Date() },
    });
    return { eventsFound: 0 };
  }

  let cursor = fromBlock;
  let eventsFound = 0;

  while (cursor <= confirmedHead) {
    const toBlock = minBigint(cursor + config.blockBatchSize - 1n, confirmedHead);

    const logs = await client.getLogs({
      address: factoryAddr as Address,
      fromBlock: cursor,
      toBlock,
    });

    for (const log of logs) {
      if (log.blockNumber == null || log.transactionHash == null || log.logIndex == null)
        continue;

      let decoded: ReturnType<typeof decodeEventLog> | null = null;
      try {
        decoded = decodeEventLog({
          abi: DEALLOCK_FACTORY_EVENTS,
          data: log.data,
          topics: log.topics as [Hex, ...Hex[]],
        });
      } catch {
        try {
          decoded = decodeEventLog({
            abi: DEALLOCK_FACTORY_V2_EVENTS,
            data: log.data,
            topics: log.topics as [Hex, ...Hex[]],
          });
        } catch {
          continue;
        }
      }

      if (decoded.eventName !== "AgreementCreated") continue;

      const args = decoded.args as {
        agreement: string;
        client: string;
        provider: string;
        chainId: bigint;
        contractVersion: bigint;
        milestoneCount: bigint;
        totalAmount: bigint;
        reviewPeriod: bigint;
        paymentToken?: string;
        metadataHash: string;
      };

      const agreementAddr = args.agreement.toLowerCase();
      const clientAddr = args.client.toLowerCase();
      const providerAddr = args.provider.toLowerCase();
      const blockNum = log.blockNumber;
      const txHash = log.transactionHash;
      const logIndex = log.logIndex;
      const occurredAt = await blockTimestamp(client, factory.chainId, blockNum);
      const version = Number(args.contractVersion);
      const pay = paymentMetadata(factory.chainId, args.paymentToken ?? null);
      const existingAgreement = await db.agreement.findUnique({
        where: {
          chainId_contractAddress: {
            chainId: factory.chainId,
            contractAddress: agreementAddr,
          },
        },
        select: {
          deploymentTxHash: true,
          clientAddress: true,
          providerAddress: true,
        },
      });
      const clientChanged = Boolean(existingAgreement && existingAgreement.clientAddress !== clientAddr);
      const providerChanged = Boolean(existingAgreement && existingAgreement.providerAddress !== providerAddr);

      // Upsert the Agreement — merge factory metadata into any existing record.
      // Factory events are chain truth for parties, version, provenance, and
      // payment. Keep user-edited title/template/metadata, but clear stale
      // contact emails if a pre-existing direct row had spoofed parties.
      let agreement;
      try {
        agreement = await db.agreement.upsert({
          where: {
            chainId_contractAddress: {
              chainId: factory.chainId,
              contractAddress: agreementAddr,
            },
          },
          update: {
            // Always update factory-sourced discovery fields.
            clientAddress: clientAddr,
            providerAddress: providerAddr,
            creationSource: "factory",
            factoryAddress: factoryAddr,
            factoryVersion: factory.factoryVersion,
            factoryTxHash: txHash,
            factoryLogIndex: logIndex,
            metadataHash: args.metadataHash,
            ...pay,
            // Set deployment metadata only if not already set (don't overwrite frontend sync).
            ...(!existingAgreement?.deploymentTxHash
              ? { deploymentTxHash: txHash, deploymentBlockNumber: blockNum, indexingStartBlock: blockNum }
              : {}),
            // Update version from factory event if still at default/incomplete frontend sync.
            contractVersion: version,
            ...(clientChanged ? { clientEmail: null } : {}),
            ...(providerChanged ? { providerEmail: null } : {}),
          },
          create: {
            contractAddress: agreementAddr,
            chainId: factory.chainId,
            clientAddress: clientAddr,
            providerAddress: providerAddr,
            contractVersion: version,
            ...pay,
            creationSource: "factory",
            factoryVersion: factory.factoryVersion,
            factoryAddress: factoryAddr,
            factoryTxHash: txHash,
            factoryLogIndex: logIndex,
            metadataHash: args.metadataHash,
            deploymentTxHash: txHash,
            deploymentBlockNumber: blockNum,
            indexingStartBlock: blockNum,
            indexerStatus: "pending",
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          // Concurrent upsert race — find the existing record.
          agreement = await db.agreement.findUnique({
            where: {
              chainId_contractAddress: {
                chainId: factory.chainId,
                contractAddress: agreementAddr,
              },
            },
          });
          if (!agreement) continue;
        } else {
          throw err;
        }
      }

      // Store the AgreementCreated chain event (idempotent).
      const stored = await storeChainEvent({
        agreementId: agreement.id,
        chainId: factory.chainId,
        contractAddress: factoryAddr,
        contractVersion: version,
        blockNumber: blockNum,
        blockHash: log.blockHash ?? null,
        txHash,
        logIndex,
        eventName: "AgreementCreated",
        itemType: "agreement",
        itemId: null,
        actorAddress: clientAddr,
        counterpartyAddress: providerAddr,
        amountWei: args.totalAmount.toString(),
        amountRaw: args.totalAmount.toString(),
        paymentTokenAddress: pay.paymentTokenAddress,
        paymentSymbol: pay.paymentSymbol,
        paymentDecimals: pay.paymentDecimals,
        payloadJson: {
          agreementAddress: agreementAddr,
          paymentToken: pay.paymentTokenAddress ?? ZERO_ADDRESS,
          milestoneCount: args.milestoneCount.toString(),
          totalAmount: args.totalAmount.toString(),
          reviewPeriod: args.reviewPeriod.toString(),
          metadataHash: args.metadataHash,
        },
        occurredAt,
      });

      if (stored.inserted) {
        eventsFound += 1;
      }
    }

    await db.factoryContract.update({
      where: { id: row.id },
      data: { lastIndexedBlock: toBlock, lastIndexedAt: new Date() },
    });

    cursor = toBlock + 1n;
  }

  return { eventsFound };
}

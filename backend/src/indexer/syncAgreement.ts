import type { Agreement } from "@prisma/client";
import type { Address, PublicClient } from "viem";
import { db } from "../db.js";
import type { IndexerConfig } from "./config.js";
import { decodeAgreementLog, versionEventAbi } from "./decode.js";
import { notifyForChainEvent } from "./notify.js";
import { storeChainEvent } from "./store.js";
import { blockTimestamp } from "./timestamp.js";

export interface SyncAgreementResult {
  eventsFound: number;
  fromBlock: bigint | null;
  toBlock: bigint | null;
}

function startBlock(agreement: Agreement, confirmedHead: bigint, lookbackBlocks: bigint): bigint {
  if (agreement.lastIndexedBlock != null) return agreement.lastIndexedBlock + 1n;
  if (agreement.indexingStartBlock != null) return agreement.indexingStartBlock;
  if (agreement.deploymentBlockNumber != null) return agreement.deploymentBlockNumber;
  return confirmedHead > lookbackBlocks ? confirmedHead - lookbackBlocks : 0n;
}

function minBigint(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

export async function syncAgreement(args: {
  agreement: Agreement;
  client: PublicClient;
  config: IndexerConfig;
  confirmedHead: bigint;
}): Promise<SyncAgreementResult> {
  const fromStart = startBlock(args.agreement, args.confirmedHead, args.config.lookbackBlocks);
  if (fromStart > args.confirmedHead) {
    await db.agreement.update({
      where: { id: args.agreement.id },
      data: {
        indexerStatus: "synced",
        indexerError: null,
        lastIndexedBlock: args.confirmedHead,
        lastIndexedAt: new Date(),
      },
    });
    return { eventsFound: 0, fromBlock: null, toBlock: null };
  }

  await db.agreement.update({
    where: { id: args.agreement.id },
    data: { indexerStatus: "indexing", indexerError: null },
  });

  const abi = versionEventAbi(args.agreement.contractVersion);
  let cursor = fromStart;
  let eventsFound = 0;

  while (cursor <= args.confirmedHead) {
    const toBlock = minBigint(cursor + args.config.blockBatchSize - 1n, args.confirmedHead);
    const logs = await args.client.getLogs({
      address: args.agreement.contractAddress as Address,
      fromBlock: cursor,
      toBlock,
    });

    for (const log of logs) {
      if (log.blockNumber == null) continue;
      const occurredAt = await blockTimestamp(args.client, args.agreement.chainId, log.blockNumber);
      const decoded = decodeAgreementLog({
        agreement: args.agreement,
        log,
        occurredAt,
        abi,
      });
      if (!decoded) continue;

      const stored = await storeChainEvent(decoded);
      if (stored.inserted) {
        eventsFound += 1;
        await notifyForChainEvent(stored.id);
      }
    }

    await db.agreement.update({
      where: { id: args.agreement.id },
      data: {
        indexerStatus: "synced",
        indexerError: null,
        lastIndexedBlock: toBlock,
        lastIndexedAt: new Date(),
      },
    });

    cursor = toBlock + 1n;
  }

  return { eventsFound, fromBlock: fromStart, toBlock: args.confirmedHead };
}

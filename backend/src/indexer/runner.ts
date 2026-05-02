import { db } from "../db.js";
import { indexerConfig } from "./config.js";
import { publicClientForChain } from "./clients.js";
import { syncAgreement } from "./syncAgreement.js";
import { syncFactory } from "./syncFactory.js";
import { logger } from "../logger.js";

let loopTimer: NodeJS.Timeout | null = null;
let running = false;

// PostgreSQL advisory lock key — prevents two processes from indexing simultaneously.
const ADVISORY_LOCK_KEY = 20260430; // stable numeric key for DealLock indexer

async function acquireAdvisoryLock(): Promise<boolean> {
  try {
    const rows = await db.$queryRaw<[{ pg_try_advisory_lock: boolean }]>`
      SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}::bigint)
    `;
    return rows[0]?.pg_try_advisory_lock === true;
  } catch {
    return false;
  }
}

async function releaseAdvisoryLock(): Promise<void> {
  try {
    await db.$queryRaw`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY}::bigint)`;
  } catch {
    // best effort
  }
}

/** Retry a single async operation with exponential backoff. */
async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 3, baseDelayMs = 1000 }: { attempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        const delay = baseDelayMs * 2 ** i;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

export async function runIndexerOnce(config = indexerConfig()): Promise<{
  agreementsSeen: number;
  eventsFound: number;
}> {
  if (running) {
    logger.debug("[indexer] Already running, skipping tick");
    return { agreementsSeen: 0, eventsFound: 0 };
  }

  // Attempt to acquire the process-level advisory lock.
  const locked = await acquireAdvisoryLock();
  if (!locked) {
    logger.info("[indexer] Another process holds the indexer lock, skipping tick");
    return { agreementsSeen: 0, eventsFound: 0 };
  }

  running = true;

  const run = await db.indexerRun.create({
    data: { status: "running" },
  });

  let agreementsSeen = 0;
  let eventsFound = 0;

  try {
    const chainIds = [...config.rpcUrls.keys()];
    if (chainIds.length === 0) {
      await db.indexerRun.update({
        where: { id: run.id },
        data: { status: "success", finishedAt: new Date() },
      });
      return { agreementsSeen, eventsFound };
    }

    // Phase 1: Index factory contracts for AgreementCreated events.
    if (config.factoryIndexerEnabled && config.factoryContracts.length > 0) {
      for (const factory of config.factoryContracts) {
        const client = publicClientForChain(factory.chainId, config);
        if (!client) continue;
        try {
          const result = await withRetry(async () => {
            const latestBlock = await client.getBlockNumber();
            const confirmedHead =
              latestBlock > config.confirmations ? latestBlock - config.confirmations : 0n;
            return syncFactory({ factory, client, config, confirmedHead });
          });
          eventsFound += result.eventsFound;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Factory sync failed";
          logger.error(`[indexer] factory ${factory.address}: ${message}`);
        }
      }
    }

    // Phase 2: Index known agreement contracts for lifecycle events.
    const agreements = await db.agreement.findMany({
      where: { chainId: { in: chainIds } },
      orderBy: [{ lastIndexedAt: "asc" }, { createdAt: "asc" }],
      take: config.maxAgreementsPerTick,
    });

    for (const agreement of agreements) {
      agreementsSeen += 1;
      const client = publicClientForChain(agreement.chainId, config);
      if (!client) continue;

      try {
        const result = await withRetry(async () => {
          const latestBlock = await client.getBlockNumber();
          const confirmedHead =
            latestBlock > config.confirmations ? latestBlock - config.confirmations : 0n;
          return syncAgreement({ agreement, client, config, confirmedHead });
        });
        eventsFound += result.eventsFound;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Indexer agreement sync failed";
        await db.agreement.update({
          where: { id: agreement.id },
          data: { indexerStatus: "error", indexerError: message.slice(0, 1000) },
        });
        logger.error(`[indexer] ${agreement.contractAddress}: ${message}`);
      }
    }

    await db.indexerRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        agreementsSeen,
        eventsFound,
      },
    });

    if (eventsFound > 0 || agreementsSeen > 0) {
      logger.info("[indexer] tick complete", { agreementsSeen, eventsFound });
    }

    return { agreementsSeen, eventsFound };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Indexer run failed";
    await db.indexerRun.update({
      where: { id: run.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        agreementsSeen,
        eventsFound,
        error: message.slice(0, 1000),
      },
    });
    logger.error(`[indexer] run failed: ${message}`);
    throw err;
  } finally {
    running = false;
    await releaseAdvisoryLock();
  }
}

export function startIndexerLoop(config = indexerConfig()): void {
  if (loopTimer || !config.enabled) return;

  const tick = () => {
    runIndexerOnce(config).catch((err) => {
      const message = err instanceof Error ? err.message : "Indexer loop failed";
      logger.error(`[indexer] ${message}`);
    });
  };

  tick();
  loopTimer = setInterval(tick, config.pollMs);
  logger.info("[indexer] loop started", { pollMs: config.pollMs });
}

export function stopIndexerLoop(): void {
  if (loopTimer) clearInterval(loopTimer);
  loopTimer = null;
}

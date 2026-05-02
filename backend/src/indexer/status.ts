import { db } from "../db.js";
import { indexerConfig, indexerEnabled } from "./config.js";

function formatRun(
  run: {
    status: string;
    startedAt: Date;
    finishedAt: Date | null;
    agreementsSeen: number | null;
    eventsFound: number | null;
    error: string | null;
  } | null,
) {
  if (!run) return undefined;
  return {
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    agreementsSeen: run.agreementsSeen,
    eventsFound: run.eventsFound,
    error: run.error ?? undefined,
  };
}

export async function indexerStatus() {
  const config = indexerConfig();

  const [latestSuccessfulRun, latestFailedRun, latestKnownRun, pendingAgreements, errorAgreements, staleAgreements] =
    await Promise.all([
      db.indexerRun.findFirst({
        where: { status: "success" },
        orderBy: { startedAt: "desc" },
      }),
      db.indexerRun.findFirst({
        where: { status: "error" },
        orderBy: { startedAt: "desc" },
      }),
      db.indexerRun.findFirst({ orderBy: { startedAt: "desc" } }),
      db.agreement.count({ where: { indexerStatus: { in: ["pending", "indexing"] } } }),
      db.agreement.count({ where: { indexerStatus: "error" } }),
      // Agreements not indexed in over 1 hour while indexer is enabled.
      db.agreement.count({
        where: {
          lastIndexedAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
          indexerStatus: { notIn: ["error"] },
        },
      }),
    ]);

  // Factory status: look up each configured factory contract in the DB.
  const factoryStatuses = await Promise.all(
    config.factoryContracts.map(async (f) => {
      const row = await db.factoryContract.findUnique({
        where: { chainId_address: { chainId: f.chainId, address: f.address } },
        select: {
          indexerStatus: true,
          factoryVersion: true,
          contractVersion: true,
          lastIndexedBlock: true,
          lastIndexedAt: true,
          indexerError: true,
        },
      });
      return {
        chainId: f.chainId,
        address: f.address,
        factoryVersion: row?.factoryVersion ?? f.factoryVersion,
        contractVersion: row?.contractVersion ?? (f.factoryVersion === 3 ? 6 : f.factoryVersion === 2 ? 5 : 4),
        indexerStatus: row?.indexerStatus ?? "not_started",
        lastIndexedBlock: row?.lastIndexedBlock?.toString() ?? null,
        lastIndexedAt: row?.lastIndexedAt?.toISOString() ?? null,
        indexerError: row?.indexerError ?? null,
      };
    }),
  );

  return {
    enabled: indexerEnabled(),
    factoryIndexerEnabled: config.factoryIndexerEnabled,
    factoryContracts: factoryStatuses,
    latestRun: formatRun(latestKnownRun),
    latestSuccessfulRun: formatRun(latestSuccessfulRun),
    latestFailedRun: formatRun(latestFailedRun),
    pendingAgreements,
    errorAgreements,
    staleAgreements,
  };
}

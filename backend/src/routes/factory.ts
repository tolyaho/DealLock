import { Router } from "express";
import { db } from "../db.js";
import { asyncRoute } from "../utils.js";
import { indexerConfig } from "../indexer/config.js";

const router = Router();

// GET /factory/contracts
// Returns configured factory contracts and their current indexing status.
// Public endpoint — no auth required; no user data exposed.
router.get(
  "/contracts",
  asyncRoute(async (_req, res) => {
    const config = indexerConfig();
    const statuses = await Promise.all(
      config.factoryContracts.map(async (f) => {
        const row = await db.factoryContract.findUnique({
          where: { chainId_address: { chainId: f.chainId, address: f.address } },
          select: {
            contractVersion: true,
            factoryVersion: true,
            deploymentBlock: true,
            lastIndexedBlock: true,
            lastIndexedAt: true,
            indexerStatus: true,
            indexerError: true,
          },
        });
        return {
          chainId: f.chainId,
          address: f.address,
          factoryVersion: row?.factoryVersion ?? f.factoryVersion,
          contractVersion: row?.contractVersion ?? (f.factoryVersion === 3 ? 6 : f.factoryVersion === 2 ? 5 : 4),
          deploymentBlock: row?.deploymentBlock?.toString() ?? null,
          lastIndexedBlock: row?.lastIndexedBlock?.toString() ?? null,
          lastIndexedAt: row?.lastIndexedAt?.toISOString() ?? null,
          indexerStatus: row?.indexerStatus ?? "not_started",
          indexerError: row?.indexerError ?? null,
        };
      }),
    );

    res.json({
      factoryIndexerEnabled: config.factoryIndexerEnabled,
      contracts: statuses,
    });
  }),
);

export default router;

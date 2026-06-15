import { Router } from "express";
import { isAddress } from "viem";
import type { Agreement } from "@prisma/client";
import { db } from "../db.js";
import { isValidEmail, normalizeOptionalEmail } from "../email/validation.js";
import { asyncRoute } from "../utils.js";
import { type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { resolvePaymentAsset, snapshotPaymentAsset } from "../paymentAssets.js";

const router = Router();
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;

// All agreement routes require authentication (enforced in index.ts).

type ParsedContactEmail = {
  ok: boolean;
  value: string | null | undefined;
  error?: string;
};

function parseContactEmail(value: unknown, label: string): ParsedContactEmail {
  if (value === undefined) return { ok: true, value: undefined };
  const email = normalizeOptionalEmail(value);
  if (email && !isValidEmail(email)) {
    return { ok: false, value: undefined, error: `${label} must be a valid email address` };
  }
  return { ok: true, value: email };
}

function contactEmailError(
  clientEmail: ParsedContactEmail,
  providerEmail: ParsedContactEmail,
): string | null {
  if (!clientEmail.ok) return clientEmail.error ?? "Client email is invalid";
  if (!providerEmail.ok) return providerEmail.error ?? "Provider email is invalid";
  return null;
}

function parseOptionalBigInt(value: unknown): bigint | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return undefined;
}

function parseContractVersion(value: unknown): number | undefined {
  return typeof value === "number" && [1, 2, 3, 4, 5, 6].includes(value) ? value : undefined;
}

function parseChainId(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function editableAgreementData(input: Record<string, unknown>) {
  return {
    ...(typeof input.projectTitle === "string" && { projectTitle: input.projectTitle.slice(0, 160) }),
    ...(typeof input.serviceTemplate === "string" && { serviceTemplate: input.serviceTemplate.slice(0, 80) }),
    ...(input.metadataJson != null && {
      metadataJson:
        typeof input.metadataJson === "string"
          ? input.metadataJson.slice(0, 32_000)
          : JSON.stringify(input.metadataJson).slice(0, 32_000),
    }),
  };
}

function publicAgreement(agreement: Agreement) {
  return {
    ...agreement,
    deploymentBlockNumber: agreement.deploymentBlockNumber?.toString() ?? null,
    indexingStartBlock: agreement.indexingStartBlock?.toString() ?? null,
    lastIndexedBlock: agreement.lastIndexedBlock?.toString() ?? null,
    factoryLogIndex: agreement.factoryLogIndex ?? null,
  };
}

// GET /agreements?chainId=&role=client|provider|all
router.get(
  "/",
  asyncRoute(async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const chainIdParam = req.query.chainId as string | undefined;
    const role = req.query.role as string | undefined;

    const wallets = await db.wallet.findMany({ where: { userId } });
    const addresses = wallets.map((w) => w.address);

    if (addresses.length === 0) {
      res.json({ agreements: [] });
      return;
    }

    const chainIdFilter = chainIdParam ? { chainId: Number(chainIdParam) } : {};

    const addressFilter =
      role === "client"
        ? { clientAddress: { in: addresses } }
        : role === "provider"
          ? { providerAddress: { in: addresses } }
          : { OR: [{ clientAddress: { in: addresses } }, { providerAddress: { in: addresses } }] };

    const agreements = await db.agreement.findMany({
      where: { ...addressFilter, ...chainIdFilter },
      orderBy: { lastAccessedAt: "desc" },
    });

    res.json({ agreements: agreements.map(publicAgreement) });
  }),
);

// POST /agreements
router.post(
  "/",
  asyncRoute(async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const {
      contractAddress,
      chainId,
      clientAddress,
      providerAddress,
      projectTitle,
      serviceTemplate,
      metadataJson,
      contractVersion,
      clientEmail,
      providerEmail,
      deploymentTxHash,
      deploymentBlockNumber,
      indexingStartBlock,
      creationSource,
      factoryAddress,
      factoryTxHash,
      factoryLogIndex,
      factoryVersion,
      metadataHash,
      paymentAssetKey,
      paymentTokenAddress,
    } = req.body as Record<string, unknown>;
    const parsedChainId = parseChainId(chainId);

    if (
      typeof contractAddress !== "string" ||
      parsedChainId === null ||
      typeof clientAddress !== "string" ||
      typeof providerAddress !== "string"
    ) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    if (!isAddress(contractAddress) || !isAddress(clientAddress) || !isAddress(providerAddress)) {
      res.status(400).json({ error: "Invalid address" });
      return;
    }

    const normContract = contractAddress.toLowerCase();
    const normClient = clientAddress.toLowerCase();
    const normProvider = providerAddress.toLowerCase();
    const parsedClientEmail = parseContactEmail(clientEmail, "Client email");
    const parsedProviderEmail = parseContactEmail(providerEmail, "Provider email");

    const parsedEmailError = contactEmailError(parsedClientEmail, parsedProviderEmail);
    if (parsedEmailError) {
      res.status(400).json({ error: parsedEmailError });
      return;
    }

    const wallets = await db.wallet.findMany({ where: { userId } });
    const addresses = wallets.map((w) => w.address.toLowerCase());

    const existing = await db.agreement.findUnique({
      where: { chainId_contractAddress: { chainId: parsedChainId, contractAddress: normContract } },
    });

    if (existing) {
      if (!addresses.includes(existing.clientAddress) && !addresses.includes(existing.providerAddress)) {
        res.status(403).json({ error: "Agreement must involve one of your linked wallets" });
        return;
      }

      const updated = await db.agreement.update({
        where: { id: existing.id },
        data: {
          ...editableAgreementData(req.body as Record<string, unknown>),
          lastSyncedAt: new Date(),
          ...(parsedClientEmail.value !== undefined && { clientEmail: parsedClientEmail.value }),
          ...(parsedProviderEmail.value !== undefined && { providerEmail: parsedProviderEmail.value }),
        },
      });

      res.json({ agreement: publicAgreement(updated) });
      return;
    }

    if (!addresses.includes(normClient) && !addresses.includes(normProvider)) {
      res.status(403).json({ error: "Agreement must involve one of your linked wallets" });
      return;
    }

    const metaStr =
      metadataJson != null
        ? typeof metadataJson === "string"
          ? metadataJson
          : JSON.stringify(metadataJson)
        : "{}";

    const cvNumber = parseContractVersion(contractVersion);
    const paymentAsset = resolvePaymentAsset({
      chainId: parsedChainId,
      assetKey: paymentAssetKey,
      tokenAddress: paymentTokenAddress,
    });
    if (!paymentAsset) {
      res.status(400).json({ error: "Unsupported payment asset for chain" });
      return;
    }
    const payment = snapshotPaymentAsset(paymentAsset);
    const parsedDeploymentTxHash =
      typeof deploymentTxHash === "string" && TX_HASH_RE.test(deploymentTxHash)
        ? deploymentTxHash.toLowerCase()
        : undefined;
    const parsedDeploymentBlock = parseOptionalBigInt(deploymentBlockNumber);
    const parsedIndexingStartBlock = parseOptionalBigInt(indexingStartBlock);
    const parsedCreationSource =
      creationSource === "factory" || creationSource === "direct" ? creationSource : undefined;
    const parsedFactoryAddress =
      typeof factoryAddress === "string" && ADDR_RE.test(factoryAddress)
        ? factoryAddress.toLowerCase()
        : undefined;
    const parsedFactoryTxHash =
      typeof factoryTxHash === "string" && TX_HASH_RE.test(factoryTxHash)
        ? factoryTxHash.toLowerCase()
        : undefined;
    const parsedFactoryLogIndex =
      typeof factoryLogIndex === "number" && Number.isInteger(factoryLogIndex) && factoryLogIndex >= 0
        ? factoryLogIndex
        : undefined;
    const parsedFactoryVersion =
      typeof factoryVersion === "number" && (factoryVersion === 1 || factoryVersion === 2 || factoryVersion === 3)
        ? factoryVersion
        : undefined;
    const parsedMetadataHash =
      typeof metadataHash === "string" && BYTES32_RE.test(metadataHash)
        ? metadataHash.toLowerCase()
        : undefined;

    const agreement = await db.agreement.create({
      data: {
        contractAddress: normContract,
        chainId: parsedChainId,
        clientAddress: normClient,
        providerAddress: normProvider,
        clientEmail: parsedClientEmail.value ?? null,
        providerEmail: parsedProviderEmail.value ?? null,
        projectTitle: typeof projectTitle === "string" ? projectTitle : "",
        serviceTemplate: typeof serviceTemplate === "string" ? serviceTemplate : "custom",
        metadataJson: metaStr,
        contractVersion: cvNumber ?? 1,
        ...payment,
        deploymentTxHash: parsedDeploymentTxHash,
        deploymentBlockNumber: parsedDeploymentBlock,
        indexingStartBlock: parsedIndexingStartBlock,
        creationSource: parsedCreationSource ?? "direct",
        factoryVersion: parsedFactoryVersion,
        factoryAddress: parsedFactoryAddress,
        factoryTxHash: parsedFactoryTxHash,
        factoryLogIndex: parsedFactoryLogIndex,
        metadataHash: parsedMetadataHash,
        createdByUserId: userId,
      },
    });

    res.json({ agreement: publicAgreement(agreement) });
  }),
);

// PATCH /agreements/:contractAddress/contacts
router.patch(
  "/:contractAddress/contacts",
  asyncRoute(async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const contractAddress = req.params.contractAddress;
    const { chainId, clientEmail, providerEmail } = req.body as Record<string, unknown>;

    const parsedChainId = parseChainId(chainId);

    if (!isAddress(contractAddress) || parsedChainId === null) {
      res.status(400).json({ error: "Valid contractAddress and chainId are required" });
      return;
    }

    const parsedClientEmail = parseContactEmail(clientEmail, "Client email");
    const parsedProviderEmail = parseContactEmail(providerEmail, "Provider email");

    const parsedEmailError = contactEmailError(parsedClientEmail, parsedProviderEmail);
    if (parsedEmailError) {
      res.status(400).json({ error: parsedEmailError });
      return;
    }

    const wallets = await db.wallet.findMany({ where: { userId } });
    const addresses = wallets.map((w) => w.address);
    const normContract = contractAddress.toLowerCase();

    const agreement = await db.agreement.findUnique({
      where: { chainId_contractAddress: { chainId: parsedChainId, contractAddress: normContract } },
    });

    if (
      !agreement ||
      (!addresses.includes(agreement.clientAddress) && !addresses.includes(agreement.providerAddress))
    ) {
      res.status(404).json({ error: "Agreement not found" });
      return;
    }

    const updated = await db.agreement.update({
      where: { id: agreement.id },
      data: {
        ...(parsedClientEmail.value !== undefined && { clientEmail: parsedClientEmail.value }),
        ...(parsedProviderEmail.value !== undefined && { providerEmail: parsedProviderEmail.value }),
      },
    });

    res.json({ agreement: publicAgreement(updated) });
  }),
);

// GET /agreements/:contractAddress/activity?chainId=&limit=50&cursor=
router.get(
  "/:contractAddress/activity",
  asyncRoute(async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const contractAddress = req.params.contractAddress;
    const chainId = Number(req.query.chainId);
    const limitRaw = Number(req.query.limit ?? 50);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    if (!isAddress(contractAddress) || !Number.isInteger(chainId)) {
      res.status(400).json({ error: "Valid contractAddress and chainId are required" });
      return;
    }

    const wallets = await db.wallet.findMany({ where: { userId } });
    const addresses = wallets.map((w) => w.address);
    const agreement = await db.agreement.findUnique({
      where: {
        chainId_contractAddress: { chainId, contractAddress: contractAddress.toLowerCase() },
      },
    });

    if (
      !agreement ||
      (!addresses.includes(agreement.clientAddress) && !addresses.includes(agreement.providerAddress))
    ) {
      res.status(404).json({ error: "Agreement not found" });
      return;
    }

    const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
    const cursorEvent = cursor
      ? await db.chainEvent.findFirst({
          where: { id: cursor, agreementId: agreement.id },
          select: { occurredAt: true, id: true },
        })
      : null;

    const events = await db.chainEvent.findMany({
      where: {
        agreementId: agreement.id,
        ...(cursorEvent && {
          OR: [
            { occurredAt: { lt: cursorEvent.occurredAt } },
            { occurredAt: cursorEvent.occurredAt, id: { lt: cursorEvent.id } },
          ],
        }),
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const page = events.slice(0, limit);
    const next = events.length > limit ? page.at(-1)?.id : undefined;

    res.json({
      events: page.map((event) => ({
        id: event.id,
        eventName: event.eventName,
        itemType: event.itemType,
        itemId: event.itemId,
        actorAddress: event.actorAddress,
        counterpartyAddress: event.counterpartyAddress,
        amountWei: event.amountWei,
        amountRaw: event.amountRaw,
        paymentTokenAddress: event.paymentTokenAddress,
        paymentSymbol: event.paymentSymbol,
        paymentDecimals: event.paymentDecimals,
        txHash: event.txHash,
        blockNumber: event.blockNumber.toString(),
        occurredAt: event.occurredAt.toISOString(),
        payload: event.payloadJson,
      })),
      ...(next && { nextCursor: next }),
    });
  }),
);

// PATCH /agreements/:contractAddress
router.patch(
  "/:contractAddress",
  asyncRoute(async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const normContract = req.params.contractAddress.toLowerCase();
    const { lastAccessedAt, clientEmail, providerEmail } = req.body as Record<string, unknown>;
    const parsedClientEmail = parseContactEmail(clientEmail, "Client email");
    const parsedProviderEmail = parseContactEmail(providerEmail, "Provider email");

    const parsedEmailError = contactEmailError(parsedClientEmail, parsedProviderEmail);
    if (parsedEmailError) {
      res.status(400).json({ error: parsedEmailError });
      return;
    }

    const wallets = await db.wallet.findMany({ where: { userId } });
    const addresses = wallets.map((w) => w.address);

    const agreement = await db.agreement.findFirst({
      where: {
        contractAddress: normContract,
        OR: [{ clientAddress: { in: addresses } }, { providerAddress: { in: addresses } }],
      },
    });

    if (!agreement) {
      res.status(404).json({ error: "Agreement not found" });
      return;
    }

    let parsedLastAccessedAt: Date | undefined;
    if (typeof lastAccessedAt === "string") {
      parsedLastAccessedAt = new Date(lastAccessedAt);
      if (Number.isNaN(parsedLastAccessedAt.getTime())) {
        res.status(400).json({ error: "lastAccessedAt must be a valid date" });
        return;
      }
    }

    const updated = await db.agreement.update({
      where: { id: agreement.id },
      data: {
        ...editableAgreementData(req.body as Record<string, unknown>),
        ...(parsedLastAccessedAt !== undefined && { lastAccessedAt: parsedLastAccessedAt }),
        ...(parsedClientEmail.value !== undefined && { clientEmail: parsedClientEmail.value }),
        ...(parsedProviderEmail.value !== undefined && { providerEmail: parsedProviderEmail.value }),
      },
    });

    res.json({ agreement: publicAgreement(updated) });
  }),
);

export default router;

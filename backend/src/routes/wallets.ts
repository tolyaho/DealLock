import { Router } from "express";
import { isAddress, verifyMessage, type Address, type Hex } from "viem";
import { db } from "../db.js";
import { buildLinkWalletMessage, NONCE_TTL_MS } from "../auth.js";
import { generateNonce, asyncRoute, isUniqueConstraintError } from "../utils.js";
import { type AuthenticatedRequest } from "../middleware/requireAuth.js";

const router = Router();

// All wallet routes require authentication (enforced in index.ts).

// GET /wallets
router.get(
  "/",
  asyncRoute(async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const wallets = await db.wallet.findMany({ where: { userId } });
    res.json({ wallets });
  }),
);

// POST /wallets/link/nonce
router.post(
  "/link/nonce",
  asyncRoute(async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const { address, chainId } = req.body as { address?: unknown; chainId?: unknown };

    if (typeof address !== "string" || !isAddress(address)) {
      res.status(400).json({ error: "Invalid address" });
      return;
    }
    if (typeof chainId !== "number") {
      res.status(400).json({ error: "chainId must be a number" });
      return;
    }

    const normalized = address.toLowerCase();
    const existing = await db.wallet.findUnique({ where: { address: normalized } });

    if (existing?.userId === userId) {
      res.json({ alreadyLinked: true });
      return;
    }
    if (existing && existing.userId !== userId) {
      res.status(409).json({ error: "Wallet is already linked to another DealLock account" });
      return;
    }

    const nonce = generateNonce();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + NONCE_TTL_MS);
    const message = buildLinkWalletMessage({ address: normalized, chainId, nonce, now, expiresAt });

    const record = await db.authNonce.create({
      data: { address: normalized, nonce, purpose: "link_wallet", message, expiresAt },
    });

    res.json({ message, nonceId: record.id });
  }),
);

// POST /wallets/link/verify
router.post(
  "/link/verify",
  asyncRoute(async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const { address, nonceId, signature, label } = req.body as {
      address?: unknown;
      nonceId?: unknown;
      signature?: unknown;
      label?: unknown;
    };

    if (
      typeof address !== "string" ||
      typeof nonceId !== "string" ||
      typeof signature !== "string"
    ) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    if (!isAddress(address)) {
      res.status(400).json({ error: "Invalid address" });
      return;
    }

    const normalized = address.toLowerCase();
    const nonceRecord = await db.authNonce.findUnique({ where: { id: nonceId } });

    if (!nonceRecord) {
      res.status(400).json({ error: "Invalid nonce" });
      return;
    }
    if (nonceRecord.purpose !== "link_wallet") {
      res.status(400).json({ error: "Wrong nonce purpose" });
      return;
    }
    if (nonceRecord.address !== normalized) {
      res.status(400).json({ error: "Address mismatch" });
      return;
    }
    if (nonceRecord.usedAt) {
      res.status(400).json({ error: "Nonce already used" });
      return;
    }
    if (nonceRecord.expiresAt < new Date()) {
      res.status(400).json({ error: "Nonce expired" });
      return;
    }

    let valid = false;
    try {
      valid = await verifyMessage({
        address: address as Address,
        message: nonceRecord.message,
        signature: signature as Hex,
      });
    } catch {
      res.status(400).json({ error: "Invalid signature format" });
      return;
    }

    if (!valid) {
      res.status(401).json({ error: "Signature verification failed" });
      return;
    }

    const claimed = await db.authNonce.updateMany({
      where: { id: nonceId, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) {
      res.status(400).json({ error: "Nonce already used" });
      return;
    }

    const walletCount = await db.wallet.count({ where: { userId } });
    const walletLabel =
      typeof label === "string" && label.trim() ? label.trim() : "Linked wallet";

    try {
      const existingWallet = await db.wallet.findUnique({ where: { address: normalized } });
      if (existingWallet && existingWallet.userId !== userId) {
        res.status(409).json({ error: "Wallet already linked to another account" });
        return;
      }
      if (!existingWallet) {
        await db.wallet.create({
          data: {
            userId,
            address: normalized,
            label: walletLabel,
            isPrimary: walletCount === 0,
          },
        });
      }
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;

      const existingWallet = await db.wallet.findUnique({ where: { address: normalized } });
      if (!existingWallet) throw err;
      if (existingWallet.userId !== userId) {
        res.status(409).json({ error: "Wallet already linked to another account" });
        return;
      }
    }

    const wallets = await db.wallet.findMany({ where: { userId } });
    res.json({ wallets });
  }),
);

// PATCH /wallets/:address
router.patch(
  "/:address",
  asyncRoute(async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const normalized = req.params.address.toLowerCase();
    const { label, isPrimary } = req.body as { label?: unknown; isPrimary?: unknown };

    const wallet = await db.wallet.findUnique({ where: { address: normalized } });
    if (!wallet || wallet.userId !== userId) {
      res.status(404).json({ error: "Wallet not found" });
      return;
    }

    if (isPrimary === true) {
      // Atomically unset all primaries then set the new one
      await db.$transaction([
        db.wallet.updateMany({ where: { userId, isPrimary: true }, data: { isPrimary: false } }),
        db.wallet.update({
          where: { address: normalized },
          data: {
            isPrimary: true,
            ...(typeof label === "string" ? { label } : {}),
          },
        }),
      ]);
    } else {
      if (isPrimary === false && wallet.isPrimary) {
        res
          .status(400)
          .json({ error: "Cannot unset the primary wallet. Set another wallet as primary first." });
        return;
      }

      await db.wallet.update({
        where: { address: normalized },
        data: {
          ...(typeof label === "string" ? { label } : {}),
          ...(isPrimary === false ? { isPrimary: false } : {}),
        },
      });
    }

    const wallets = await db.wallet.findMany({ where: { userId } });
    res.json({ wallets });
  }),
);

// DELETE /wallets/:address
router.delete(
  "/:address",
  asyncRoute(async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const normalized = req.params.address.toLowerCase();

    const wallets = await db.wallet.findMany({ where: { userId } });
    if (wallets.length <= 1) {
      res.status(400).json({ error: "Cannot remove the only linked wallet" });
      return;
    }

    const wallet = wallets.find((w) => w.address === normalized);
    if (!wallet) {
      res.status(404).json({ error: "Wallet not found" });
      return;
    }
    if (wallet.isPrimary) {
      res
        .status(400)
        .json({ error: "Cannot delete the primary wallet. Set another wallet as primary first." });
      return;
    }

    await db.wallet.delete({ where: { address: normalized } });
    const updated = await db.wallet.findMany({ where: { userId } });
    res.json({ wallets: updated });
  }),
);

export default router;

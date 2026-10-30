import { Router } from "express";
import { isAddress, verifyMessage, type Address, type Hex } from "viem";
import { db } from "../db.js";
import { buildSigninMessage, NONCE_TTL_MS } from "../auth.js";
import { generateNonce, asyncRoute, isUniqueConstraintError } from "../utils.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { getOrCreateCsrfToken } from "../middleware/csrf.js";
import { publicUser } from "../serializers.js";

const router = Router();

// GET /auth/csrf
// Returns a session-bound token required by mutating cookie-session routes.
router.get("/csrf", (req, res) => {
  res.json({ csrfToken: getOrCreateCsrfToken(req) });
});

// POST /auth/nonce
// Returns a sign-in message for the given wallet address.
router.post(
  "/nonce",
  asyncRoute(async (req, res) => {
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
    const nonce = generateNonce();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + NONCE_TTL_MS);
    const message = buildSigninMessage({ address: normalized, chainId, nonce, now, expiresAt });

    const record = await db.authNonce.create({
      data: { address: normalized, nonce, purpose: "signin", message, expiresAt },
    });

    res.json({ message, nonceId: record.id });
  }),
);

// POST /auth/verify
// Verifies wallet signature and creates or restores a DealLock account.
router.post(
  "/verify",
  asyncRoute(async (req, res) => {
    const { address, nonceId, signature } = req.body as {
      address?: unknown;
      nonceId?: unknown;
      signature?: unknown;
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
    if (nonceRecord.purpose !== "signin") {
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

    // Atomically claim the nonce after signature verification. A concurrent
    // request using the same signed challenge must lose here, not later while
    // creating account records.
    const claimed = await db.authNonce.updateMany({
      where: { id: nonceId, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) {
      res.status(400).json({ error: "Nonce already used" });
      return;
    }

    // Find or create user + wallet
    let userId: string;
    try {
      userId = await db.$transaction(async (tx) => {
        const existingWallet = await tx.wallet.findUnique({
          where: { address: normalized },
          include: { user: true },
        });

        if (existingWallet) return existingWallet.userId;

        const newUser = await tx.user.create({ data: {} });
        await tx.wallet.create({
          data: {
            userId: newUser.id,
            address: normalized,
            label: "Primary wallet",
            isPrimary: true,
          },
        });
        return newUser.id;
      });
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;

      // Another valid sign-in with the same wallet may have created the wallet
      // between our read and create. Recover cleanly instead of surfacing a 500.
      const existingWallet = await db.wallet.findUnique({ where: { address: normalized } });
      if (!existingWallet) throw err;
      userId = existingWallet.userId;
    }

    req.session.userId = userId;
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const wallets = await db.wallet.findMany({ where: { userId } });
    res.json({ user: publicUser(user), wallets });
  }),
);

// POST /auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// GET /auth/me  (also mounted as GET /me in index.ts)
router.get(
  "/me",
  requireAuth,
  asyncRoute(async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      req.session.destroy(() => {});
      res.status(401).json({ error: "User not found" });
      return;
    }
    const wallets = await db.wallet.findMany({ where: { userId } });
    res.json({ user: publicUser(user), wallets });
  }),
);

export default router;

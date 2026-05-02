import { Router } from "express";
import { isAddress, verifyMessage, type Address, type Hex } from "viem";
import { db } from "../db.js";
import { buildSigninMessage, NONCE_TTL_MS } from "../auth.js";
import { generateNonce, asyncRoute } from "../utils.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";

const router = Router();

function publicUser(user: { id: string; email: string | null; emailVerifiedAt: Date | null }) {
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
  };
}

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

    // Mark nonce used
    await db.authNonce.update({ where: { id: nonceId }, data: { usedAt: new Date() } });

    // Find or create user + wallet
    const existingWallet = await db.wallet.findUnique({
      where: { address: normalized },
      include: { user: true },
    });

    let userId: string;
    if (existingWallet) {
      userId = existingWallet.userId;
    } else {
      const newUser = await db.user.create({ data: {} });
      await db.wallet.create({
        data: {
          userId: newUser.id,
          address: normalized,
          label: "Primary wallet",
          isPrimary: true,
        },
      });
      userId = newUser.id;
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

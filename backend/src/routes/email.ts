import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import { db } from "../db.js";
import { renderVerificationEmail } from "../email/templates.js";
import { sendEmail } from "../email/sendEmail.js";
import { isValidEmail, normalizeEmail } from "../email/validation.js";
import { type AuthenticatedRequest } from "../middleware/requireAuth.js";
import {
  getOrCreatePreferences,
  publicPreferenceValues,
} from "../notificationPreferences.js";
import { asyncRoute } from "../utils.js";

const router = Router();

const TOKEN_TTL_MINUTES = 30;
const TOKEN_TTL_MS = TOKEN_TTL_MINUTES * 60 * 1000;
const REQUEST_RATE_LIMIT_MS = 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function appUrl(): string {
  return (process.env.APP_URL ?? process.env.FRONTEND_ORIGIN ?? "http://localhost:5173").replace(/\/+$/, "");
}

async function emailState(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  const preferences = await getOrCreatePreferences(userId);
  return {
    email: user?.email ?? null,
    emailVerifiedAt: user?.emailVerifiedAt?.toISOString() ?? null,
    emailVerified: Boolean(user?.email && user.emailVerifiedAt),
    preferences: publicPreferenceValues(preferences),
  };
}

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    res.json(await emailState(userId));
  }),
);

router.post(
  "/start-verification",
  asyncRoute(async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const email = normalizeEmail((req.body as Record<string, unknown>).email);

    if (!email || !isValidEmail(email)) {
      res.status(400).json({ error: "Valid email is required" });
      return;
    }

    const recentToken = await db.emailVerificationToken.findFirst({
      where: {
        userId,
        email,
        createdAt: { gte: new Date(Date.now() - REQUEST_RATE_LIMIT_MS) },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentToken) {
      res.status(429).json({ error: "Verification email was requested recently" });
      return;
    }

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await db.emailVerificationToken.create({
      data: { userId, email, tokenHash, expiresAt },
    });

    const link = `${appUrl()}/app?verifyEmail=${encodeURIComponent(rawToken)}`;
    const rendered = renderVerificationEmail({ email, link, expiresMinutes: TOKEN_TTL_MINUTES });
    await sendEmail({
      to: email,
      subject: rendered.subject,
      text: rendered.text,
    });

    res.json({ ok: true, expiresAt: expiresAt.toISOString() });
  }),
);

router.post(
  "/confirm",
  asyncRoute(async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const token = (req.body as Record<string, unknown>).token;

    if (typeof token !== "string" || token.length < 20) {
      res.status(400).json({ error: "Valid token is required" });
      return;
    }

    const tokenRecord = await db.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (!tokenRecord) {
      res.status(400).json({ error: "Invalid verification token" });
      return;
    }
    if (tokenRecord.userId !== userId) {
      res.status(403).json({ error: "Verification token belongs to another account" });
      return;
    }
    if (tokenRecord.usedAt) {
      res.status(400).json({ error: "Verification token already used" });
      return;
    }
    if (tokenRecord.expiresAt < new Date()) {
      res.status(400).json({ error: "Verification token expired" });
      return;
    }

    const existingUser = await db.user.findUnique({ where: { email: tokenRecord.email } });
    if (existingUser && existingUser.id !== userId) {
      res.status(409).json({ error: "Email is already verified by another account" });
      return;
    }

    const now = new Date();
    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: { email: tokenRecord.email, emailVerifiedAt: now },
      }),
      db.emailVerificationToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: now },
      }),
      db.emailVerificationToken.updateMany({
        where: { userId, email: tokenRecord.email, usedAt: null, id: { not: tokenRecord.id } },
        data: { usedAt: now },
      }),
      db.notificationPreference.upsert({
        where: { userId },
        update: {},
        create: { userId },
      }),
    ]);

    res.json(await emailState(userId));
  }),
);

router.delete(
  "/",
  asyncRoute(async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: { email: null, emailVerifiedAt: null },
      }),
      db.emailVerificationToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);
    res.json(await emailState(userId));
  }),
);

export default router;

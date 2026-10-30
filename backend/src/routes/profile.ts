import { Router } from "express";
import { db } from "../db.js";
import { asyncRoute } from "../utils.js";
import { type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { publicUser } from "../serializers.js";

const router = Router();

const MAX_NAME = 60;

/**
 * Trim/collapse whitespace and validate one name field. Returns the cleaned
 * string, or null if the input is missing/empty/too long/contains control chars.
 * Any printable script is allowed so international names work; only C0 control
 * characters and DEL are rejected (checked by code point, no control literals).
 */
function parseName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length < 1 || trimmed.length > MAX_NAME) return null;
  for (let i = 0; i < trimmed.length; i += 1) {
    const code = trimmed.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return null;
  }
  return trimmed;
}

// PATCH /profile — set the display name (first + last). Mounted under requireAuth
// only (NOT requireVerified): the name is collected during onboarding, before the
// email verification step, so it must be reachable by a wallet-only session.
router.patch(
  "/",
  asyncRoute(async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const { firstName, lastName } = req.body as { firstName?: unknown; lastName?: unknown };

    const first = parseName(firstName);
    const last = parseName(lastName);
    if (first === null || last === null) {
      res
        .status(400)
        .json({ error: `First and last name are required (1–${MAX_NAME} characters each).` });
      return;
    }

    const user = await db.user.update({
      where: { id: userId },
      data: { firstName: first, lastName: last },
    });
    const wallets = await db.wallet.findMany({ where: { userId } });
    res.json({ user: publicUser(user), wallets });
  }),
);

export default router;

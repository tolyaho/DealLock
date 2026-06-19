import { db } from "../db.js";
import { asyncRoute } from "../utils.js";
import type { AuthenticatedRequest } from "./requireAuth.js";

/**
 * Gate for a *fully onboarded* account: a wallet session (requireAuth) PLUS a
 * verified email. DealLock makes both mandatory — a wallet sign-in creates the
 * session, but an account is not usable until the email step is complete.
 *
 * Mount AFTER requireAuth on routes that expose real product data so a
 * wallet-only session cannot reach them before verifying. The /auth, /email and
 * /wallets routes deliberately stay on requireAuth alone — they are how a user
 * gets from "wallet only" to "verified".
 *
 * Returns 403 EMAIL_VERIFICATION_REQUIRED so the client can route the user to
 * the email step (distinct from a 401, which means "sign in again").
 */
export const requireVerified = asyncRoute(async (req, res, next) => {
  const { userId } = req as AuthenticatedRequest;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerifiedAt: true },
  });

  if (!user) {
    // Session points at an account that no longer exists — treat as signed out.
    req.session.destroy(() => {});
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (!user.email || !user.emailVerifiedAt) {
    res.status(403).json({
      error: "Email verification required",
      code: "EMAIL_VERIFICATION_REQUIRED",
    });
    return;
  }

  next();
});

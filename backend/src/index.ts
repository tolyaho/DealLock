import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import authRouter from "./routes/auth.js";
import walletsRouter from "./routes/wallets.js";
import agreementsRouter from "./routes/agreements.js";
import emailRouter from "./routes/email.js";
import notificationPreferencesRouter from "./routes/notificationPreferences.js";
import notificationsRouter from "./routes/notifications.js";
import factoryRouter from "./routes/factory.js";
import paymentAssetsRouter from "./routes/paymentAssets.js";
import { requireAuth, type AuthenticatedRequest } from "./middleware/requireAuth.js";
import { requireVerified } from "./middleware/requireVerified.js";
import { db } from "./db.js";
import { asyncRoute } from "./utils.js";
import {
  configuredSessionStore,
  sessionCookieConfig,
  trustProxyEnabled,
} from "./sessionStore.js";
import { indexerStatus } from "./indexer/status.js";
import { startIndexerLoop } from "./indexer/runner.js";
import { stopIndexerLoop } from "./indexer/runner.js";
import { validateEnv } from "./config/env.js";
import { logger } from "./logger.js";
import { csrfProtection } from "./middleware/csrf.js";
import { closeConfiguredSessionStores } from "./sessionStore.js";

function publicUser(user: { id: string; email: string | null; emailVerifiedAt: Date | null }) {
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
  };
}

/** Rate limiter factory — one window per sensitive endpoint group. */
function makeRateLimit(windowMinutes: number, max: number) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    skip: () => process.env.DISABLE_RATE_LIMITS === "true",
    standardHeaders: true,
    legacyHeaders: false,
    handler(_req, res) {
      res.status(429).json({ error: "Too many requests. Please try again later." });
    },
  });
}

// Separate limiters so each endpoint group has its own counter.
const authLimiter = makeRateLimit(15, 20);
const emailLimiter = makeRateLimit(15, 10);
const notifyLimiter = makeRateLimit(15, 30);

export function createApp() {
  const app = express();

  if (trustProxyEnabled()) {
    app.set("trust proxy", 1);
  }

  // Security headers.
  app.use(
    helmet({
      // Allow inline scripts/styles used by Vite dev preview served from the same origin.
      contentSecurityPolicy: false,
    }),
  );

  // CORS — strict allowlist from env; in dev also allow localhost so Mac browser still works.
  const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
  const corsOrigin =
    process.env.NODE_ENV === "production"
      ? frontendOrigin
      : [frontendOrigin, "http://localhost:5173", "http://127.0.0.1:5173"];
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    }),
  );

  // Body limits.
  app.use(express.json({ limit: "64kb" }));
  app.use(express.urlencoded({ extended: false, limit: "16kb" }));

  // Sessions.
  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? "dev-secret-change-me-in-production",
      store: configuredSessionStore(),
      resave: false,
      saveUninitialized: false,
      cookie: sessionCookieConfig(),
    }),
  );

  app.use(csrfProtection);

  // Health — no auth, no rate limit.
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get(
    "/health/db",
    asyncRoute(async (_req, res) => {
      await db.$queryRaw`SELECT 1`;
      res.json({ ok: true, database: "reachable" });
    }),
  );

  app.get(
    "/health/indexer",
    asyncRoute(async (_req, res) => {
      res.json(await indexerStatus());
    }),
  );

  // Auth — rate limited, except the safe CSRF bootstrap endpoint.
  app.use(
    "/auth",
    (req, res, next) => {
      if (req.method === "GET" && req.path === "/csrf") return next();
      return authLimiter(req, res, next);
    },
    authRouter,
  );

  app.get(
    "/me",
    requireAuth,
    asyncRoute(async (req: Request, res: Response) => {
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

  // Wallets — link flow is rate limited.
  app.use(
    "/wallets",
    requireAuth,
    (req, res, next) => {
      if (req.path.startsWith("/link")) return authLimiter(req, res, next);
      return next();
    },
    walletsRouter,
  );

  // Product data — requires a verified email on top of a wallet session.
  app.use("/agreements", requireAuth, requireVerified, agreementsRouter);

  // Email — rate limited. Stays on requireAuth only: this is how an account
  // reaches the verified state, so it must be reachable beforehand.
  app.use("/email", requireAuth, emailLimiter, emailRouter);

  app.use("/notification-preferences", requireAuth, requireVerified, notificationPreferencesRouter);

  // Notifications — rate limited; also gated on a verified email.
  app.use("/notifications", requireAuth, requireVerified, notifyLimiter, notificationsRouter);

  app.use("/factory", factoryRouter);
  app.use("/payment-assets", paymentAssetsRouter);

  // Global error handler — never leak stack traces in production.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error("Unhandled route error", {
      message: err.message,
      stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    });
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

const isMainModule =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  const config = validateEnv();
  const PORT = config.port;

  logger.info("DealLock backend starting", {
    nodeEnv: config.nodeEnv,
    port: PORT,
    sessionStore: config.sessionStore,
    emailProvider: config.emailProvider,
    indexerEnabled: config.indexerEnabled,
    factoryIndexerEnabled: config.factoryIndexerEnabled,
  });

  const app = createApp();
  const server = app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Listening on http://0.0.0.0:${PORT}`);
  });
  startIndexerLoop();

  const shutdown = (signal: NodeJS.Signals) => {
    logger.info("DealLock backend shutting down", { signal });
    stopIndexerLoop();
    server.close((err) => {
      if (err) logger.error("HTTP server close failed", { message: err.message });
      Promise.all([db.$disconnect(), closeConfiguredSessionStores()])
        .then(() => process.exit(err ? 1 : 0))
        .catch((closeErr: unknown) => {
          logger.error("Shutdown cleanup failed", {
            message: closeErr instanceof Error ? closeErr.message : String(closeErr),
          });
          process.exit(1);
        });
    });
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

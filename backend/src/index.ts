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
import { requireAuth, type AuthenticatedRequest } from "./middleware/requireAuth.js";
import { db } from "./db.js";
import { asyncRoute } from "./utils.js";
import {
  configuredSessionStore,
  sessionCookieConfig,
  trustProxyEnabled,
} from "./sessionStore.js";
import { indexerStatus } from "./indexer/status.js";
import { startIndexerLoop } from "./indexer/runner.js";
import { validateEnv } from "./config/env.js";
import { logger } from "./logger.js";

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

  // CORS — strict allowlist from env.
  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
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

  // Auth — rate limited.
  app.use("/auth", authLimiter, authRouter);

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

  app.use("/agreements", requireAuth, agreementsRouter);

  // Email — rate limited.
  app.use("/email", requireAuth, emailLimiter, emailRouter);

  app.use("/notification-preferences", requireAuth, notificationPreferencesRouter);

  // Notifications — rate limited.
  app.use("/notifications", requireAuth, notifyLimiter, notificationsRouter);

  app.use("/factory", factoryRouter);

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
  app.listen(PORT, () => {
    logger.info(`Listening on http://localhost:${PORT}`);
  });
  startIndexerLoop();
}

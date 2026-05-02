/**
 * Backend environment validation.
 * Called once at startup; throws if required config is missing or unsafe.
 */

export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  sessionSecret: string;
  sessionStore: "postgres" | "memory";
  sessionCookieSecure: boolean;
  sessionCookieSameSite: "lax" | "strict" | "none";
  sessionMaxAgeMs: number;
  trustProxy: boolean;
  frontendOrigin: string;
  appUrl: string;
  emailProvider: "console" | "smtp";
  emailFrom: string;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpSecure: boolean;
  sepoliaRpcUrl: string | null;
  hardhatRpcUrl: string | null;
  indexerEnabled: boolean;
  factoryIndexerEnabled: boolean;
  factoryContracts: string | null;
  factoryV2Contracts: string | null;
  factoryV3Contracts: string | null;
}

const ERRORS: string[] = [];

function require(name: string, value: string | undefined): string {
  if (!value) {
    ERRORS.push(`${name} is required but not set`);
    return "";
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw === "true";
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function sameSite(): "lax" | "strict" | "none" {
  const raw = (process.env.SESSION_COOKIE_SAME_SITE ?? "lax").toLowerCase();
  if (raw === "strict" || raw === "none") return raw;
  return "lax";
}

function emailProvider(): "console" | "smtp" {
  const raw = (process.env.EMAIL_PROVIDER ?? "console").toLowerCase();
  if (raw === "smtp") return "smtp";
  return "console";
}

function sessionStore(): "postgres" | "memory" {
  const raw = (process.env.SESSION_STORE ?? "postgres").toLowerCase();
  if (raw === "memory") return "memory";
  return "postgres";
}

export function validateEnv(): AppConfig {
  ERRORS.length = 0;

  const nodeEnv = optional("NODE_ENV", "development");
  const isProd = nodeEnv === "production";

  const databaseUrl = require("DATABASE_URL", process.env.DATABASE_URL);
  const sessionSecret = require("SESSION_SECRET", process.env.SESSION_SECRET);
  const frontendOrigin = require("FRONTEND_ORIGIN", process.env.FRONTEND_ORIGIN);
  const appUrl = require("APP_URL", process.env.APP_URL);
  const emailProv = emailProvider();
  const store = sessionStore();
  const indexerEnabled = boolEnv("INDEXER_ENABLED", false);
  const factoryIndexerEnabled = boolEnv("FACTORY_INDEXER_ENABLED", false);

  // Production-specific checks.
  if (isProd) {
    if (!sessionSecret || sessionSecret.length < 32) {
      ERRORS.push("SESSION_SECRET must be at least 32 characters in production");
    }
    if (store === "memory") {
      ERRORS.push("SESSION_STORE=memory is not allowed in production; use SESSION_STORE=postgres");
    }
    if (emailProv === "console" && process.env.ALLOW_CONSOLE_EMAIL_IN_PROD !== "true") {
      ERRORS.push(
        "EMAIL_PROVIDER=console is not allowed in production. " +
          "Set EMAIL_PROVIDER=smtp or set ALLOW_CONSOLE_EMAIL_IN_PROD=true to override.",
      );
    }
    if (boolEnv("SESSION_COOKIE_SECURE", true) === false && process.env.SESSION_COOKIE_SECURE === "false") {
      ERRORS.push("SESSION_COOKIE_SECURE=false is not safe in production");
    }
    if (!frontendOrigin || frontendOrigin === "*") {
      ERRORS.push("FRONTEND_ORIGIN must be set to a specific origin in production");
    }
  }

  // Indexer requires RPC URLs.
  if (indexerEnabled && !process.env.SEPOLIA_RPC_URL && !process.env.HARDHAT_RPC_URL) {
    ERRORS.push(
      "INDEXER_ENABLED=true requires at least one of SEPOLIA_RPC_URL or HARDHAT_RPC_URL",
    );
  }

  // Factory indexer requires at least one configured factory generation.
  if (
    factoryIndexerEnabled &&
    !process.env.FACTORY_CONTRACTS &&
    !process.env.FACTORY_V2_CONTRACTS &&
    !process.env.FACTORY_V3_CONTRACTS
  ) {
    ERRORS.push("FACTORY_INDEXER_ENABLED=true requires FACTORY_CONTRACTS, FACTORY_V2_CONTRACTS, or FACTORY_V3_CONTRACTS to be set");
  }

  // SMTP provider requires SMTP_HOST.
  if (emailProv === "smtp" && !process.env.SMTP_HOST) {
    ERRORS.push("EMAIL_PROVIDER=smtp requires SMTP_HOST to be set");
  }

  if (ERRORS.length > 0) {
    const msg = `Environment configuration is invalid:\n  - ${ERRORS.join("\n  - ")}`;
    if (isProd) throw new Error(msg);
    // In development, log warnings but allow startup.
    console.warn(`[config] WARNING — ${msg}`);
  }

  return {
    nodeEnv,
    port: intEnv("PORT", 4000),
    databaseUrl,
    sessionSecret: sessionSecret || "dev-secret-change-me-in-production",
    sessionStore: store,
    sessionCookieSecure:
      process.env.SESSION_COOKIE_SECURE !== undefined
        ? boolEnv("SESSION_COOKIE_SECURE", false)
        : isProd,
    sessionCookieSameSite: sameSite(),
    sessionMaxAgeMs: intEnv("SESSION_MAX_AGE_MS", 7 * 24 * 60 * 60 * 1000),
    trustProxy: boolEnv("TRUST_PROXY", false),
    frontendOrigin: frontendOrigin || "http://localhost:5173",
    appUrl: appUrl || "http://localhost:5173",
    emailProvider: emailProv,
    emailFrom: optional("EMAIL_FROM", "DealLock <no-reply@localhost>"),
    smtpHost: process.env.SMTP_HOST ?? null,
    smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null,
    smtpUser: process.env.SMTP_USER ?? null,
    smtpPass: process.env.SMTP_PASS ?? null,
    smtpSecure: boolEnv("SMTP_SECURE", false),
    sepoliaRpcUrl: process.env.SEPOLIA_RPC_URL ?? null,
    hardhatRpcUrl: process.env.HARDHAT_RPC_URL ?? null,
    indexerEnabled,
    factoryIndexerEnabled,
    factoryContracts: process.env.FACTORY_CONTRACTS ?? null,
    factoryV2Contracts: process.env.FACTORY_V2_CONTRACTS ?? null,
    factoryV3Contracts: process.env.FACTORY_V3_CONTRACTS ?? null,
  };
}

let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!_config) _config = validateEnv();
  return _config;
}

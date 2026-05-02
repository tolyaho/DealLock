import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";

const sessionPools: pg.Pool[] = [];

function envBool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return value === "true";
}

function sameSiteValue(): "lax" | "strict" | "none" {
  const value = (process.env.SESSION_COOKIE_SAME_SITE ?? "lax").toLowerCase();
  if (value === "strict" || value === "none") return value;
  return "lax";
}

export function trustProxyEnabled(): boolean {
  return envBool("TRUST_PROXY", false);
}

export function sessionCookieConfig(): session.CookieOptions {
  const secure =
    process.env.SESSION_COOKIE_SECURE !== undefined
      ? envBool("SESSION_COOKIE_SECURE", false)
      : process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure,
    sameSite: sameSiteValue(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export function configuredSessionStore(): session.Store | undefined {
  const storeKind = (process.env.SESSION_STORE ?? "postgres").toLowerCase();
  if (storeKind === "memory") {
    console.warn("Using express-session MemoryStore. Use SESSION_STORE=postgres outside tests.");
    return undefined;
  }

  const connectionString = process.env.SESSION_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or SESSION_DATABASE_URL is required for PostgreSQL sessions");
  }

  const PgSession = connectPgSimple(session);
  const pool = new pg.Pool({ connectionString });
  sessionPools.push(pool);

  return new PgSession({
    pool,
    tableName: "session",
    createTableIfMissing: false,
  });
}

export async function closeConfiguredSessionStores(): Promise<void> {
  await Promise.all(sessionPools.splice(0).map((pool) => pool.end()));
}

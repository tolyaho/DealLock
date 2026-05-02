import pg from "pg";
import { inspect } from "node:util";

function quoteIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function requireTestDatabaseUrl(): URL {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required for backend tests");
  const url = new URL(raw);
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("Backend tests require a PostgreSQL DATABASE_URL");
  }
  const databaseName = url.pathname.replace(/^\//, "");
  const schemaName = url.searchParams.get("schema") ?? "public";
  if (!databaseName.includes("test") && !schemaName.includes("test")) {
    throw new Error("Refusing to reset a non-test database. Use DATABASE_URL_TEST or a URL containing test.");
  }
  return url;
}

async function main(): Promise<void> {
  const targetUrl = requireTestDatabaseUrl();
  const databaseName = targetUrl.pathname.replace(/^\//, "");
  const schemaName = targetUrl.searchParams.get("schema") ?? "public";

  const adminUrl = new URL(targetUrl);
  adminUrl.pathname = "/postgres";
  adminUrl.search = "";
  const adminPool = new pg.Pool({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 3000 });

  try {
    const existing = await adminPool.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname = $1",
      [databaseName],
    );
    if (existing.rowCount === 0) {
      await adminPool.query(`CREATE DATABASE ${quoteIdent(databaseName)}`);
    }
  } finally {
    await adminPool.end();
  }

  const targetPool = new pg.Pool({ connectionString: targetUrl.toString(), connectionTimeoutMillis: 3000 });
  try {
    await targetPool.query(`DROP SCHEMA IF EXISTS ${quoteIdent(schemaName)} CASCADE`);
    await targetPool.query(`CREATE SCHEMA ${quoteIdent(schemaName)}`);
  } finally {
    await targetPool.end();
  }
}

function formatError(err: unknown): string {
  if (err instanceof AggregateError) {
    const nested = err.errors.map((error) => formatError(error)).join("; ");
    return err.message ? `${err.message}: ${nested}` : nested;
  }
  if (err instanceof Error) {
    return err.message || err.stack || inspect(err);
  }
  return inspect(err);
}

main().catch((err) => {
  const message = formatError(err);
  if (
    message.includes("ECONNREFUSED") ||
    message.includes("ENOTFOUND") ||
    message.includes("Connection terminated") ||
    message.includes("timeout")
  ) {
    console.error(
      "Backend tests require a reachable PostgreSQL test database. Start it with `docker compose up -d postgres` or set DATABASE_URL_TEST to a dedicated PostgreSQL test database.",
    );
    console.error(message);
    process.exit(1);
  }
  console.error(message);
  process.exit(1);
});

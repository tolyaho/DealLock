/**
 * Env preloader — loads .env.local values into process.env if the file exists.
 *
 * Loaded via `tsx --import ./src/loadLocalEnv.ts` so it runs before any other
 * module (including db.ts / Prisma) reads process.env.
 *
 * Rules:
 *   - Values already set in the system environment are never overridden.
 *   - .env.local overrides .env (local RC dev wins over base config).
 *   - Production environments typically have no .env.local → this is a no-op.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const localEnvPath = resolve(process.cwd(), ".env.local");

if (existsSync(localEnvPath)) {
  for (const line of readFileSync(localEnvPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const val = /^(["'])(.*)\1$/.exec(raw)?.[2] ?? raw;
    // System env takes priority — only fill gaps from .env.local
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
}

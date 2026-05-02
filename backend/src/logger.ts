/**
 * Minimal structured logger for DealLock backend.
 * Logs to stdout/stderr as JSON lines in production; human-readable in development.
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function activeLevel(): Level {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  if (raw === "debug" || raw === "warn" || raw === "error") return raw as Level;
  return "info";
}

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

function formatProd(level: Level, message: string, meta?: Record<string, unknown>): string {
  const entry: Record<string, unknown> = {
    time: new Date().toISOString(),
    level,
    message,
  };
  if (meta) Object.assign(entry, meta);
  return JSON.stringify(entry);
}

function formatDev(level: Level, message: string, meta?: Record<string, unknown>): string {
  const prefix = `[${new Date().toISOString().slice(11, 23)}] ${level.toUpperCase().padEnd(5)}`;
  const extra = meta ? ` ${JSON.stringify(meta)}` : "";
  return `${prefix} ${message}${extra}`;
}

function write(level: Level, message: string, meta?: Record<string, unknown>): void {
  if (LEVELS[level] < LEVELS[activeLevel()]) return;
  const line = isProd() ? formatProd(level, message, meta) : formatDev(level, message, meta);
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    write("debug", message, meta);
  },
  info(message: string, meta?: Record<string, unknown>): void {
    write("info", message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    write("warn", message, meta);
  },
  error(message: string, meta?: Record<string, unknown>): void {
    write("error", message, meta);
  },
};

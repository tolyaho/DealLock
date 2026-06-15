import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

declare module "express-session" {
  interface SessionData {
    csrfToken?: string;
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function getOrCreateCsrfToken(req: Request): string {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("base64url");
  }
  return req.session.csrfToken;
}

function requestToken(req: Request): string | null {
  const header = req.get("x-csrf-token") ?? req.get("csrf-token");
  if (header) return header;
  const body = req.body as { csrfToken?: unknown } | undefined;
  return typeof body?.csrfToken === "string" ? body.csrfToken : null;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const expected = req.session.csrfToken;
  const supplied = requestToken(req);

  if (!expected || !supplied || expected !== supplied) {
    res.status(403).json({ error: "Invalid or missing CSRF token" });
    return;
  }

  next();
}

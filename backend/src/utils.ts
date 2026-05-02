import { randomBytes } from "crypto";
import type { Request, Response, NextFunction, RequestHandler } from "express";

export function generateNonce(): string {
  return randomBytes(16).toString("hex");
}

export function asyncRoute(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

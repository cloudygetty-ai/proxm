import type { Request, Response, NextFunction } from "express";
import { verifyAccess } from "../utils/jwt.js";

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ ok: false, error: { code: "UNAUTHORIZED", message: "Missing token" } });
    return;
  }
  try {
    const payload = verifyAccess(header.slice(7));
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ ok: false, error: { code: "TOKEN_INVALID", message: "Invalid or expired token" } });
  }
}

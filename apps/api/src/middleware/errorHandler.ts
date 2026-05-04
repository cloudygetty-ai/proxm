import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: err.errors[0]?.message ?? "Validation failed" },
    });
    return;
  }

  logger.error(err, "Unhandled error");
  res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
}

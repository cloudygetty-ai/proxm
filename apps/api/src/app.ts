import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { locationRouter } from "./routes/location.js";
import { pingRouter } from "./routes/ping.js";
import { mashRouter } from "./routes/mash.js";
import { mapRouter } from "./routes/map.js";

export function createApp() {
  const app = express();

  // Security
  app.use(helmet());
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") ?? ["http://localhost:3000"],
    credentials: true,
  }));
  app.use(compression());
  app.use(express.json({ limit: "10kb" }));

  // Rate limiting
  app.use("/api", rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }));

  // Logging
  app.use(requestLogger);

  // Health
  app.get("/health", (_req, res) => {
    res.json({ ok: true, ts: Date.now(), service: "proxm-api" });
  });

  // Routes
  app.use("/api/auth",     authRouter);
  app.use("/api/users",    usersRouter);
  app.use("/api/location", locationRouter);
  app.use("/api/pings",    pingRouter);
  app.use("/api/mash",     mashRouter);
  app.use("/api/map",      mapRouter);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

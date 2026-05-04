import "dotenv/config";
import { createApp } from "./app.js";
import { createWebSocketServer } from "./websocket/server.js";
import { logger } from "./utils/logger.js";
import { db } from "./utils/db.js";
import { redis } from "./utils/redis.js";
import { startJobs } from "./jobs/index.js";

const PORT = parseInt(process.env.PORT ?? "4000", 10);
const WS_PORT = parseInt(process.env.WS_PORT ?? "4001", 10);

async function boot() {
  // Verify connectivity
  await db.$connect();
  logger.info("PostgreSQL connected");

  await redis.ping();
  logger.info("Redis connected");

  // HTTP server
  const app = createApp();
  const httpServer = app.listen(PORT, () => {
    logger.info({ port: PORT }, "PROXM API online");
  });

  // WebSocket server (separate port for sticky load balancing)
  const wss = createWebSocketServer(WS_PORT);
  logger.info({ port: WS_PORT }, "WebSocket server online");

  // Background jobs
  startJobs();
  logger.info("Background jobs started");

  // Graceful shutdown
  const shutdown = async (sig: string) => {
    logger.info({ sig }, "Shutdown signal received");
    httpServer.close();
    wss.close();
    await db.$disconnect();
    redis.disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
}

boot().catch((err) => {
  logger.error(err, "Fatal boot error");
  process.exit(1);
});

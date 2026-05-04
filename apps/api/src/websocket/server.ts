import { WebSocketServer, WebSocket } from "ws";
import { verifyAccess } from "../utils/jwt.js";
import { logger } from "../utils/logger.js";
import { redis, keys } from "../utils/redis.js";
import type { WsClientEvent, WsServerEvent } from "@proxm/types";
import { handleLocationBroadcast, handleLocationStop } from "./handlers/location.js";
import { handlePingSend, handlePingRespond } from "./handlers/ping.js";
import { handleMashSync } from "./handlers/mash.js";
import { handleGhost } from "./handlers/ghost.js";

// userId -> WebSocket map (process-local; extend with Redis pub/sub for multi-node)
export const connections = new Map<string, WebSocket>();

export function send(userId: string, event: WsServerEvent): boolean {
  const ws = connections.get(userId);
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(event));
  return true;
}

export function broadcast(userIds: string[], event: WsServerEvent): void {
  const payload = JSON.stringify(event);
  for (const uid of userIds) {
    const ws = connections.get(uid);
    if (ws?.readyState === WebSocket.OPEN) ws.send(payload);
  }
}

export function createWebSocketServer(port: number) {
  const wss = new WebSocketServer({ port });

  wss.on("connection", async (ws, req) => {
    // Authenticate via ?token= query param
    const url = new URL(req.url ?? "/", "ws://localhost");
    const token = url.searchParams.get("token");

    if (!token) { ws.close(4001, "Unauthorized"); return; }

    let userId: string;
    try {
      const payload = verifyAccess(token);
      userId = payload.sub;
    } catch {
      ws.close(4001, "Invalid token");
      return;
    }

    connections.set(userId, ws);
    await redis.set(keys.wsConn(userId), "1", "EX", 86400);
    logger.info({ userId }, "WS connected");

    ws.on("message", async (raw) => {
      let event: WsClientEvent;
      try { event = JSON.parse(raw.toString()); }
      catch { return; }

      switch (event.type) {
        case "location_broadcast": await handleLocationBroadcast(userId, event); break;
        case "location_stop":      await handleLocationStop(userId); break;
        case "ping_send":          await handlePingSend(userId, event); break;
        case "ping_respond":       await handlePingRespond(userId, event); break;
        case "mash_sync":          await handleMashSync(userId, event); break;
        case "ghost_activate":     await handleGhost(userId); break;
      }
    });

    ws.on("close", async () => {
      connections.delete(userId);
      await redis.del(keys.wsConn(userId));
      await handleLocationStop(userId);
      logger.info({ userId }, "WS disconnected");
    });

    ws.on("error", (err) => logger.error({ userId, err }, "WS error"));
  });

  return wss;
}

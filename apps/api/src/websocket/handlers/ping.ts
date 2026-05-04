import { db } from "../../utils/db.js";
import { redis, keys } from "../../utils/redis.js";
import { send } from "../server.js";
import { createLiveKitRoom } from "../../services/livekit.js";
import type { WsClientEvent } from "@proxm/types";

type PingSendEvent    = Extract<WsClientEvent, { type: "ping_send" }>;
type PingRespondEvent = Extract<WsClientEvent, { type: "ping_respond" }>;

const PING_TTL_SECS = 60;
const COOLDOWN_SECS = 300;

export async function handlePingSend(fromUserId: string, event: PingSendEvent) {
  const { toUserId } = event;
  const cdKey = keys.pingCooldown(fromUserId, toUserId);
  if (await redis.exists(cdKey)) return;

  const expiresAt = new Date(Date.now() + PING_TTL_SECS * 1000);
  const ping = await db.ping.create({ data: { fromUserId, toUserId, expiresAt } });
  await redis.set(cdKey, "1", "EX", COOLDOWN_SECS);

  setTimeout(async () => {
    const p = await db.ping.findUnique({ where: { id: ping.id } });
    if (p?.status === "PENDING") {
      await db.ping.update({ where: { id: ping.id }, data: { status: "EXPIRED" } });
      send(fromUserId, { type: "ping_expired", pingId: ping.id });
    }
  }, PING_TTL_SECS * 1000);

  send(toUserId, {
    type: "ping_received",
    ping: { id: ping.id, fromUserId, toUserId, status: "pending", sentAt: ping.sentAt, expiresAt },
  });
}

export async function handlePingRespond(userId: string, event: PingRespondEvent) {
  const { pingId, accept } = event;
  const ping = await db.ping.findFirst({ where: { id: pingId, toUserId: userId, status: "PENDING" } });
  if (!ping) return;

  if (!accept) {
    await db.ping.update({ where: { id: pingId }, data: { status: "REJECTED", respondedAt: new Date() } });
    send(ping.fromUserId, { type: "ping_expired", pingId });
    return;
  }

  const channelId = await createLiveKitRoom(pingId);
  const audioExpiresAt = new Date(Date.now() + 30_000);

  await db.ping.update({ where: { id: pingId }, data: { status: "ACCEPTED", channelId, respondedAt: new Date() } });

  const channel = { pingId, channelId, expiresAt: audioExpiresAt };
  send(ping.fromUserId, { type: "ping_accepted", channel });
  send(ping.toUserId,   { type: "ping_accepted", channel });

  setTimeout(() => createLiveKitRoom(pingId, true), 30_000);
}

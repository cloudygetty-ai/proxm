import { db } from "../utils/db.js";
import { send } from "../websocket/server.js";

export async function expirePings() {
  const expired = await db.ping.findMany({
    where: { status: "PENDING", expiresAt: { lte: new Date() } },
  });

  if (expired.length === 0) return;

  await db.ping.updateMany({
    where: { id: { in: expired.map((p) => p.id) } },
    data: { status: "EXPIRED" },
  });

  for (const ping of expired) {
    send(ping.fromUserId, { type: "ping_expired", pingId: ping.id });
    send(ping.toUserId,   { type: "ping_expired", pingId: ping.id });
  }
}

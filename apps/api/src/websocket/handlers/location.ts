import { db } from "../../utils/db.js";
import { redis, keys } from "../../utils/redis.js";
import { broadcast } from "../server.js";
import { computeNearbyUsers } from "../../services/location.js";
import { checkMashTriggers } from "../../services/mash.js";
import type { WsClientEvent } from "@proxm/types";

type LocationBroadcastEvent = Extract<WsClientEvent, { type: "location_broadcast" }>;

export async function handleLocationBroadcast(userId: string, event: LocationBroadcastEvent) {
  const { lat, lng, accuracy } = event;

  await db.userLocation.upsert({
    where: { userId },
    create: { userId, lat, lng, accuracy },
    update: { lat, lng, accuracy },
  });

  await redis.geoadd("proxm:geo", lng, lat, userId);
  await redis.set(keys.userLocation(userId), JSON.stringify({ lat, lng, accuracy, ts: Date.now() }), "EX", 90);

  const nearby = await computeNearbyUsers(userId, lat, lng, 1600);
  const nearbyIds = nearby.map((u) => u.id);

  await checkMashTriggers(userId, nearby);

  if (nearbyIds.length > 0) {
    broadcast([userId, ...nearbyIds], { type: "location_update", users: nearby });
  }
}

export async function handleLocationStop(userId: string) {
  await db.userLocation.deleteMany({ where: { userId } });
  await redis.zrem("proxm:geo", userId);
  await redis.del(keys.userLocation(userId));
}

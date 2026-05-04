import { db } from "../utils/db.js";
import { redis } from "../utils/redis.js";

// Remove location records not updated in 90s
export async function pruneStaleLocations() {
  const staleThreshold = new Date(Date.now() - 90_000);
  const stale = await db.userLocation.findMany({
    where: { updatedAt: { lte: staleThreshold } },
    select: { userId: true },
  });

  if (stale.length === 0) return;

  const ids = stale.map((l) => l.userId);
  await db.userLocation.deleteMany({ where: { userId: { in: ids } } });

  const pipeline = redis.pipeline();
  for (const id of ids) {
    pipeline.zrem("proxm:geo", id);
    pipeline.del(`proxm:loc:${id}`);
  }
  await pipeline.exec();
}

import { db } from "../utils/db.js";
import { redis } from "../utils/redis.js";
import type { HeatZone } from "@proxm/types";

export async function updateHeatZones() {
  const rows = await db.$queryRaw<Array<{ lat: number; lng: number; count: bigint; ready: bigint }>>`
    SELECT
      ROUND(CAST(ul.lat / 0.002 AS numeric)) * 0.002 AS lat,
      ROUND(CAST(ul.lng / 0.002 AS numeric)) * 0.002 AS lng,
      COUNT(*) AS count,
      COUNT(*) FILTER (WHERE u."readyNow" = true) AS ready
    FROM "UserLocation" ul
    JOIN "User" u ON u.id = ul."userId"
    WHERE u."ghostMode" = false
    GROUP BY 1, 2
    HAVING COUNT(*) >= 3
    ORDER BY count DESC
    LIMIT 50
  `;

  const zones: HeatZone[] = rows.map((r) => ({
    lat: r.lat, lng: r.lng, radiusMeters: 200,
    density: Math.min(1, Number(r.count) / 20),
    readyNowCount: Number(r.ready),
  }));

  await redis.set("proxm:heat:zones", JSON.stringify(zones), "EX", 60);
}

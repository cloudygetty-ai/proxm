import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { redis } from "../utils/redis.js";
import { db } from "../utils/db.js";
import type { HeatZone } from "@proxm/types";

export const mapRouter = Router();

// GET /api/map/heat — heat zone polygons (cached 30s)
mapRouter.get("/heat", requireAuth, async (_req, res, next) => {
  try {
    const cached = await redis.get("proxm:heat:zones");
    if (cached) {
      res.json({ ok: true, data: JSON.parse(cached) });
      return;
    }

    // Compute via PostGIS grid aggregation
    // Raw query: group locations into 200m cells, count readyNow
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
      lat: r.lat,
      lng: r.lng,
      radiusMeters: 200,
      density: Math.min(1, Number(r.count) / 20),
      readyNowCount: Number(r.ready),
    }));

    await redis.set("proxm:heat:zones", JSON.stringify(zones), "EX", 30);
    res.json({ ok: true, data: zones });
  } catch (err) { next(err); }
});

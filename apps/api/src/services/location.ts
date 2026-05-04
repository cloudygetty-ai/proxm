import { redis } from "../utils/redis.js";
import { db } from "../utils/db.js";
import type { UserPublic } from "@proxm/types";

/**
 * Compute nearby users using Redis GEORADIUS for O(log N) proximity search.
 * Returns UserPublic[] sorted by distance ascending.
 */
export async function computeNearbyUsers(
  requestingUserId: string,
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<UserPublic[]> {
  // GEORADIUS returns [member, dist] pairs
  const raw = await redis.georadius(
    "proxm:geo",
    lng,
    lat,
    radiusMeters / 1000, // km
    "km",
    "WITHCOORD",
    "WITHDIST",
    "COUNT", 100,
    "ASC"
  ) as Array<[string, string, [string, string]]>;

  const userIds = raw
    .map(([id]) => id)
    .filter((id) => id !== requestingUserId);

  if (userIds.length === 0) return [];

  const users = await db.user.findMany({
    where: { id: { in: userIds }, ghostMode: false },
    select: {
      id: true,
      displayName: true,
      photo: true,
      actionTag1: true,
      actionTag2: true,
      actionTag3: true,
      vibeText: true,
      verifiedAt: true,
      readyNow: true,
    },
  });

  const distMap = new Map(raw.map(([id, dist]) => [id, parseFloat(dist) * 1000]));
  const coordMap = new Map(raw.map(([id, , coords]) => [id, coords]));

  return users.map((u): UserPublic => {
    const distMeters = distMap.get(u.id) ?? 0;
    const coords = coordMap.get(u.id);
    const targetLng = coords ? parseFloat(coords[0]) : lng;
    const targetLat = coords ? parseFloat(coords[1]) : lat;
    const bearing = computeBearing(lat, lng, targetLat, targetLng);

    return {
      id: u.id,
      displayName: u.displayName,
      photo: u.photo ?? "",
      actionTags: [u.actionTag1 as `#${string}`, u.actionTag2 as `#${string}`, u.actionTag3 as `#${string}`],
      vibe: u.vibeText ?? undefined,
      verified: u.verifiedAt != null,
      readyNow: u.readyNow,
      distanceMeters: distMeters,
      bearing,
      lat: targetLat,
      lng: targetLng,
    };
  });
}

function computeBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const lat1R = (lat1 * Math.PI) / 180;
  const lat2R = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2R);
  const x = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

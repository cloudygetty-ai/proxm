import { db } from "../utils/db.js";
import { send } from "../websocket/server.js";
import type { UserPublic } from "@proxm/types";

export async function checkMashTriggers(userId: string, nearbyUsers: UserPublic[]) {
  const triggers = await db.mashTrigger.findMany({
    where: { userId, enabled: true },
  });

  for (const trigger of triggers) {
    for (const nearbyUser of nearbyUsers) {
      let matched = false;

      switch (trigger.conditionType) {
        case "proximity":
          matched = nearbyUser.distanceMeters <= (trigger.radiusMeters ?? 200);
          break;
        case "tag_match":
          matched = trigger.tags.some((tag) => nearbyUser.actionTags.includes(tag as `#${string}`));
          break;
        case "verified_only":
          matched = nearbyUser.verified;
          break;
      }

      if (matched) {
        send(userId, { type: "mash_trigger", triggerId: trigger.id, matchedUser: nearbyUser });
      }
    }
  }
}

import { db } from "../../utils/db.js";
import type { WsClientEvent } from "@proxm/types";

type MashSyncEvent = Extract<WsClientEvent, { type: "mash_sync" }>;

export async function handleMashSync(userId: string, event: MashSyncEvent) {
  // Upsert all triggers from client
  await db.mashTrigger.deleteMany({ where: { userId } });
  if (event.triggers.length === 0) return;

  await db.mashTrigger.createMany({
    data: event.triggers.map((t) => ({
      id: t.id,
      userId,
      name: t.name,
      conditionType: t.condition.type,
      radiusMeters: t.condition.radiusMeters ?? null,
      tags: t.condition.tags ?? [],
      actionType: t.action.type,
      vibrationPat: t.action.vibrationPattern ?? [],
      notifyTitle: t.action.notificationTitle ?? null,
      enabled: t.enabled,
    })),
  });
}

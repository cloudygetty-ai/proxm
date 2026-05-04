import { db } from "../../utils/db.js";
import { handleLocationStop } from "./location.js";
import { send } from "../server.js";

export async function handleGhost(userId: string) {
  await db.user.update({ where: { id: userId }, data: { ghostMode: true } });
  await handleLocationStop(userId);
  send(userId, { type: "ghost_confirmed" });
}

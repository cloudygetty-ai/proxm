import cron from "node-cron";
import { expirePings } from "./expirePings.js";
import { updateHeatZones } from "./updateHeatZones.js";
import { pruneStaleLocations } from "./pruneStaleLocations.js";
import { logger } from "../utils/logger.js";

export function startJobs() {
  // Expire pings every 30 seconds
  cron.schedule("*/30 * * * * *", async () => {
    try { await expirePings(); }
    catch (err) { logger.error(err, "expirePings failed"); }
  });

  // Update heat zone cache every 30 seconds
  cron.schedule("*/30 * * * * *", async () => {
    try { await updateHeatZones(); }
    catch (err) { logger.error(err, "updateHeatZones failed"); }
  });

  // Prune stale locations every 90 seconds
  cron.schedule("*/90 * * * * *", async () => {
    try { await pruneStaleLocations(); }
    catch (err) { logger.error(err, "pruneStaleLocations failed"); }
  });
}

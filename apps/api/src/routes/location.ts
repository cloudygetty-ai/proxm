import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { computeNearbyUsers } from "../services/location.js";
import { db } from "../utils/db.js";

export const locationRouter = Router();

// GET /api/location/nearby — REST fallback (WebSocket preferred)
locationRouter.get("/nearby", requireAuth, async (req, res, next) => {
  try {
    const loc = await db.userLocation.findUnique({ where: { userId: req.userId } });
    if (!loc) {
      res.json({ ok: true, data: [] });
      return;
    }
    const users = await computeNearbyUsers(req.userId, loc.lat, loc.lng, 1600);
    res.json({ ok: true, data: users });
  } catch (err) { next(err); }
});

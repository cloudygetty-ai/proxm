import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../utils/db.js";
import { generateLiveKitToken } from "../services/livekit.js";

export const pingRouter = Router();

// GET /api/pings — active pings for current user
pingRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const pings = await db.ping.findMany({
      where: {
        OR: [{ fromUserId: req.userId }, { toUserId: req.userId }],
        status: { in: ["PENDING", "ACCEPTED"] },
        expiresAt: { gt: new Date() },
      },
      orderBy: { sentAt: "desc" },
      take: 20,
    });
    res.json({ ok: true, data: pings });
  } catch (err) { next(err); }
});

// GET /api/pings/:pingId/token — LiveKit join token for accepted ping
pingRouter.get("/:pingId/token", requireAuth, async (req, res, next) => {
  try {
    const ping = await db.ping.findFirst({
      where: {
        id: req.params["pingId"],
        status: "ACCEPTED",
        OR: [{ fromUserId: req.userId }, { toUserId: req.userId }],
      },
    });

    if (!ping?.channelId) {
      res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Active channel not found" } });
      return;
    }

    const token = generateLiveKitToken(req.userId, ping.channelId);
    res.json({ ok: true, data: { token, channelId: ping.channelId } });
  } catch (err) { next(err); }
});

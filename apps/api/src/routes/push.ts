import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../utils/db.js";
import { redis } from "../utils/redis.js";

export const pushRouter = Router();

/**
 * POST /api/users/me/push-sub
 * Store Web Push subscription for server-sent notifications.
 */
pushRouter.post("/me/push-sub", requireAuth, async (req, res, next) => {
  try {
    const sub = req.body;
    if (!sub?.endpoint) {
      res.status(400).json({ ok: false, error: { code: "INVALID_SUB", message: "Invalid subscription" } });
      return;
    }
    // Store in Redis keyed by userId (TTL 30 days)
    await redis.set(
      `proxm:push:${req.userId}`,
      JSON.stringify(sub),
      "EX",
      30 * 86400
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/**
 * Helper: send push notification to a user
 * Call from ping/mash handlers.
 * Requires: npm install web-push
 */
export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; type?: string; url?: string }
) {
  try {
    const raw = await redis.get(`proxm:push:${userId}`);
    if (!raw) return;
    const sub = JSON.parse(raw);

    // dynamic import to keep web-push optional
    const webpush = await import("web-push");
    webpush.setVapidDetails(
      "mailto:push@proxm.app",
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    await webpush.sendNotification(sub, JSON.stringify(payload));
  } catch (err) {
    // Subscription expired — remove it
    await redis.del(`proxm:push:${userId}`);
  }
}

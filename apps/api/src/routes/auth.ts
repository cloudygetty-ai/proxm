import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "../utils/db.js";
import { redis, keys } from "../utils/redis.js";
import { signAccess, signRefresh, verifyRefresh } from "../utils/jwt.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const SendOtpSchema = z.object({ phone: z.string().regex(/^\+[1-9]\d{1,14}$/) });
const VerifyOtpSchema = z.object({ phone: z.string(), otp: z.string().length(6) });
const RefreshSchema = z.object({ refreshToken: z.string() });

// POST /api/auth/otp/send
authRouter.post("/otp/send", async (req, res, next) => {
  try {
    const { phone } = SendOtpSchema.parse(req.body);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await redis.set(`proxm:otp:${phone}`, otp, "EX", 300);
    // TODO: send via Twilio Verify
    // In dev: return OTP directly
    if (process.env.NODE_ENV !== "production") {
      res.json({ ok: true, data: { otp } });
    } else {
      res.json({ ok: true });
    }
  } catch (err) { next(err); }
});

// POST /api/auth/otp/verify
authRouter.post("/otp/verify", async (req, res, next) => {
  try {
    const { phone, otp } = VerifyOtpSchema.parse(req.body);
    const stored = await redis.get(`proxm:otp:${phone}`);
    if (!stored || stored !== otp) {
      res.status(400).json({ ok: false, error: { code: "OTP_INVALID", message: "Invalid or expired OTP" } });
      return;
    }
    await redis.del(`proxm:otp:${phone}`);

    let user = await db.user.findUnique({ where: { phone } });
    const isNew = !user;

    if (!user) {
      user = await db.user.create({
        data: { phone, displayName: "New User", actionTag1: "#Now", actionTag2: "#Talk", actionTag3: "#Chill" },
      });
    }

    const session = await db.session.create({
      data: {
        userId: user.id,
        refreshToken: await bcrypt.hash(crypto.randomUUID(), 8),
        expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
      },
    });

    res.json({
      ok: true,
      data: {
        accessToken: signAccess(user.id),
        refreshToken: signRefresh(user.id, session.id),
        isNew,
      },
    });
  } catch (err) { next(err); }
});

// POST /api/auth/refresh
authRouter.post("/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = RefreshSchema.parse(req.body);
    const payload = verifyRefresh(refreshToken);

    const session = await db.session.findUnique({ where: { id: payload.sid } });
    if (!session || session.expiresAt < new Date()) {
      res.status(401).json({ ok: false, error: { code: "SESSION_EXPIRED", message: "Session expired" } });
      return;
    }

    res.json({ ok: true, data: { accessToken: signAccess(payload.sub) } });
  } catch (err) { next(err); }
});

// DELETE /api/auth/session
authRouter.delete("/session", requireAuth, async (req, res, next) => {
  try {
    await db.session.deleteMany({ where: { userId: req.userId } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

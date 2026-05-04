import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../utils/db.js";

export const usersRouter = Router();

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(30).optional(),
  actionTag1:  z.string().regex(/^#\S+$/).optional(),
  actionTag2:  z.string().regex(/^#\S+$/).optional(),
  actionTag3:  z.string().regex(/^#\S+$/).optional(),
  vibeText:    z.string().max(100).optional(),
  readyNow:    z.boolean().optional(),
});

// GET /api/users/me
usersRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await db.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "User not found" } }); return; }
    res.json({ ok: true, data: user });
  } catch (err) { next(err); }
});

// PATCH /api/users/me
usersRouter.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const data = UpdateProfileSchema.parse(req.body);
    const user = await db.user.update({ where: { id: req.userId }, data });
    res.json({ ok: true, data: user });
  } catch (err) { next(err); }
});

// PATCH /api/users/me/ready
usersRouter.patch("/me/ready", requireAuth, async (req, res, next) => {
  try {
    const { readyNow } = z.object({ readyNow: z.boolean() }).parse(req.body);
    await db.user.update({ where: { id: req.userId }, data: { readyNow } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

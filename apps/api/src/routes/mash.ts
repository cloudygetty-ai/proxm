import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../utils/db.js";

export const mashRouter = Router();

// GET /api/mash/triggers
mashRouter.get("/triggers", requireAuth, async (req, res, next) => {
  try {
    const triggers = await db.mashTrigger.findMany({ where: { userId: req.userId } });
    res.json({ ok: true, data: triggers });
  } catch (err) { next(err); }
});

// DELETE /api/mash/triggers/:id
mashRouter.delete("/triggers/:id", requireAuth, async (req, res, next) => {
  try {
    await db.mashTrigger.deleteMany({ where: { id: req.params["id"], userId: req.userId } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

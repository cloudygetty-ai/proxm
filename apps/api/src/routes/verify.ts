import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../utils/db.js";
import multer from "multer";

export const verifyRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * POST /api/users/me/verify
 * Body: { imageBase64: string }
 *
 * Production: wire to AWS Rekognition or Azure Face API for liveness detection.
 * Prototype: stamps verifiedAt immediately on valid base64 payload.
 */
verifyRouter.post("/me/verify", requireAuth, async (req, res, next) => {
  try {
    const { imageBase64 } = req.body as { imageBase64?: string };

    if (!imageBase64 || imageBase64.length < 100) {
      res.status(400).json({ ok: false, error: { code: "NO_IMAGE", message: "Image required" } });
      return;
    }

    // TODO: Call AWS Rekognition DetectFaces for liveness
    // const rekognition = new AWS.Rekognition();
    // const result = await rekognition.detectFaces({ Image: { Bytes: Buffer.from(imageBase64, "base64") }, Attributes: ["ALL"] }).promise();
    // const face = result.FaceDetails?.[0];
    // if (!face || face.Confidence! < 90) { res.status(400)... }

    const user = await db.user.update({
      where: { id: req.userId },
      data: { verifiedAt: new Date() },
    });

    res.json({ ok: true, data: { verifiedAt: user.verifiedAt } });
  } catch (err) { next(err); }
});

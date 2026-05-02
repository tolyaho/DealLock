import { Router } from "express";
import { type AuthenticatedRequest } from "../middleware/requireAuth.js";
import {
  getOrCreatePreferences,
  preferenceUpdatesFromBody,
  publicPreferenceValues,
} from "../notificationPreferences.js";
import { db } from "../db.js";
import { asyncRoute } from "../utils.js";

const router = Router();

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const preferences = await getOrCreatePreferences(userId);
    res.json({ preferences: publicPreferenceValues(preferences) });
  }),
);

router.patch(
  "/",
  asyncRoute(async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const updates = preferenceUpdatesFromBody(req.body as Record<string, unknown>);

    if (updates === null) {
      res.status(400).json({ error: "Preference values must be booleans" });
      return;
    }

    const preferences = await db.notificationPreference.upsert({
      where: { userId },
      update: updates,
      create: { userId, ...updates },
    });

    res.json({ preferences: publicPreferenceValues(preferences) });
  }),
);

export default router;

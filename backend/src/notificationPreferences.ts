import { db } from "./db.js";

export const PREFERENCE_FIELDS = [
  "agreementCreated",
  "agreementAccepted",
  "agreementFunded",
  "milestoneSubmitted",
  "milestoneReleased",
  "milestoneRefunded",
  "adjustmentRequested",
  "adjustmentAccepted",
  "adjustmentFunded",
  "adjustmentSubmitted",
  "adjustmentReleased",
  "adjustmentRefunded",
  "disputeOpened",
  "settlementProposed",
  "settlementAccepted",
  "reviewClaimed",
] as const;

export type PreferenceField = (typeof PREFERENCE_FIELDS)[number];

export type NotificationPreferenceValues = Record<PreferenceField, boolean>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferenceValues =
  PREFERENCE_FIELDS.reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {} as NotificationPreferenceValues);

export function publicPreferenceValues(
  pref: NotificationPreferenceValues,
): NotificationPreferenceValues {
  return PREFERENCE_FIELDS.reduce((acc, key) => {
    acc[key] = pref[key];
    return acc;
  }, {} as NotificationPreferenceValues);
}

export function preferenceUpdatesFromBody(
  body: Record<string, unknown>,
): Partial<NotificationPreferenceValues> | null {
  const updates: Partial<NotificationPreferenceValues> = {};

  for (const key of PREFERENCE_FIELDS) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "boolean") return null;
    updates[key] = body[key];
  }

  return updates;
}

export async function getOrCreatePreferences(
  userId: string,
): Promise<NotificationPreferenceValues & { id: string; userId: string }> {
  return db.notificationPreference.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    },
  });
}

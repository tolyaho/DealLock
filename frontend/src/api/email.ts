import { apiFetch } from "./client.ts";

export const NOTIFICATION_PREFERENCE_FIELDS = [
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

export type NotificationPreferenceField = (typeof NOTIFICATION_PREFERENCE_FIELDS)[number];
export type NotificationPreferences = Record<NotificationPreferenceField, boolean>;

export interface EmailState {
  email: string | null;
  emailVerifiedAt: string | null;
  emailVerified: boolean;
  preferences: NotificationPreferences;
}

export async function getEmailState(): Promise<EmailState> {
  return apiFetch("/email");
}

export async function startEmailVerification(email: string): Promise<{ ok: true; expiresAt: string }> {
  return apiFetch("/email/start-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function confirmEmail(token: string): Promise<EmailState> {
  return apiFetch("/email/confirm", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function removeEmail(): Promise<EmailState> {
  return apiFetch("/email", { method: "DELETE" });
}

export async function getNotificationPreferences(): Promise<{ preferences: NotificationPreferences }> {
  return apiFetch("/notification-preferences");
}

export async function patchNotificationPreferences(
  updates: Partial<NotificationPreferences>,
): Promise<{ preferences: NotificationPreferences }> {
  return apiFetch("/notification-preferences", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

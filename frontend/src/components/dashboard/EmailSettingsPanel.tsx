import { useEffect, useMemo, useState } from "react";
import { useAccountSession } from "../../account/useAccountSession.ts";
import { ApiError } from "../../api/client.ts";
import {
  confirmEmail,
  getEmailState,
  NOTIFICATION_PREFERENCE_FIELDS,
  patchNotificationPreferences,
  removeEmail,
  startEmailVerification,
  type EmailState,
  type NotificationPreferenceField,
  type NotificationPreferences,
} from "../../api/email.ts";

const PREFERENCE_LABELS: Record<NotificationPreferenceField, string> = {
  agreementCreated: "Agreement created",
  agreementAccepted: "Agreement accepted",
  agreementFunded: "Agreement funded",
  milestoneSubmitted: "Milestone submitted",
  milestoneReleased: "Milestone released",
  milestoneRefunded: "Milestone refunded",
  adjustmentRequested: "Adjustment requested",
  adjustmentAccepted: "Adjustment accepted",
  adjustmentFunded: "Adjustment funded",
  adjustmentSubmitted: "Adjustment submitted",
  adjustmentReleased: "Adjustment released",
  adjustmentRefunded: "Adjustment refunded",
  disputeOpened: "Dispute opened",
  settlementProposed: "Settlement proposed",
  settlementAccepted: "Settlement accepted",
  reviewClaimed: "Review period claimed",
};

const PREFERENCE_GROUPS: Array<{ title: string; fields: NotificationPreferenceField[] }> = [
  {
    title: "Agreement",
    fields: ["agreementCreated", "agreementAccepted", "agreementFunded"],
  },
  {
    title: "Milestones",
    fields: ["milestoneSubmitted", "milestoneReleased", "milestoneRefunded"],
  },
  {
    title: "Adjustments",
    fields: [
      "adjustmentRequested",
      "adjustmentAccepted",
      "adjustmentFunded",
      "adjustmentSubmitted",
      "adjustmentReleased",
      "adjustmentRefunded",
    ],
  },
  {
    title: "Disputes",
    fields: ["disputeOpened", "settlementProposed", "settlementAccepted", "reviewClaimed"],
  },
];

function defaultPreferences(): NotificationPreferences {
  return NOTIFICATION_PREFERENCE_FIELDS.reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {} as NotificationPreferences);
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

export default function EmailSettingsPanel({ onClose }: { onClose: () => void }) {
  const { sessionStatus, refreshSession } = useAccountSession();
  const [state, setState] = useState<EmailState | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => defaultPreferences());
  const [busy, setBusy] = useState(false);
  const [prefSaving, setPrefSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processedToken, setProcessedToken] = useState<string | null>(null);

  const verifiedLabel = useMemo(() => {
    if (!state?.emailVerifiedAt) return "Not verified";
    return `Verified ${new Date(state.emailVerifiedAt).toLocaleString()}`;
  }, [state?.emailVerifiedAt]);

  useEffect(() => {
    if (sessionStatus !== "signed-in") return;
    getEmailState()
      .then((next) => {
        setState(next);
        setPreferences(next.preferences);
        setEmailInput(next.email ?? "");
      })
      .catch((err) => setError(errorMessage(err, "Could not load email settings")));
  }, [sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== "signed-in") return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("verifyEmail");
    if (!token || token === processedToken) return;
    setProcessedToken(token);
    params.delete("verifyEmail");
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    setBusy(true);
    setError(null);
    confirmEmail(token)
      .then(async (next) => {
        setState(next);
        setPreferences(next.preferences);
        setEmailInput(next.email ?? "");
        setMessage("Email verified.");
        await refreshSession();
      })
      .catch((err) => setError(errorMessage(err, "Email verification failed")))
      .finally(() => {
        setBusy(false);
      });
  }, [processedToken, refreshSession, sessionStatus]);

  async function handleStartVerification() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await startEmailVerification(emailInput);
      setMessage(`Verification email sent. Link expires ${new Date(result.expiresAt).toLocaleTimeString()}.`);
    } catch (err) {
      setError(errorMessage(err, "Could not start email verification"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveEmail() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await removeEmail();
      setState(next);
      setPreferences(next.preferences);
      setEmailInput("");
      setMessage("Email removed.");
      await refreshSession();
    } catch (err) {
      setError(errorMessage(err, "Could not remove email"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePreferences() {
    setPrefSaving(true);
    setError(null);
    setMessage(null);
    try {
      const next = await patchNotificationPreferences(preferences);
      setPreferences(next.preferences);
      setState((prev) => (prev ? { ...prev, preferences: next.preferences } : prev));
      setMessage("Notification preferences saved.");
    } catch (err) {
      setError(errorMessage(err, "Could not save notification preferences"));
    } finally {
      setPrefSaving(false);
    }
  }

  if (sessionStatus !== "signed-in") return null;

  return (
    <div className="email-settings-panel">
      <div className="linked-wallets-header">
        <h3 className="linked-wallets-title">Email & notifications</h3>
        <button
          type="button"
          className="btn-icon-bare linked-wallets-close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="email-settings-section">
        <div className="email-status-row">
          <span className="email-status-label">Current email</span>
          <span className="email-status-value">{state?.email ?? "None"}</span>
        </div>
        <div className="email-status-row">
          <span className="email-status-label">Status</span>
          <span className={state?.emailVerified ? "email-badge email-badge--ok" : "email-badge"}>
            {verifiedLabel}
          </span>
        </div>
        <p className="linked-wallets-hint">
          Email is for notifications only. Wallet signatures still control funds and contract actions.
        </p>
      </div>

      <div className="email-settings-section">
        <label className="label">Add or change email</label>
        <div className="email-form-row">
          <input
            type="email"
            value={emailInput}
            placeholder="you@example.com"
            onChange={(e) => setEmailInput(e.target.value)}
            disabled={busy}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleStartVerification}
            disabled={busy || !emailInput.trim()}
          >
            {state?.email === emailInput.trim().toLowerCase() ? "Resend" : "Verify"}
          </button>
        </div>
        {state?.email && (
          <button
            type="button"
            className="btn btn-ghost btn-xs email-remove-btn"
            onClick={handleRemoveEmail}
            disabled={busy}
          >
            Remove email
          </button>
        )}
      </div>

      <div className="email-settings-section">
        <h4 className="email-settings-subtitle">Notification preferences</h4>
        <div className="email-preference-groups">
          {PREFERENCE_GROUPS.map((group) => (
            <div key={group.title} className="email-preference-group">
              <h5>{group.title}</h5>
              {group.fields.map((field) => (
                <label key={field} className="email-preference-row">
                  <input
                    type="checkbox"
                    checked={preferences[field]}
                    onChange={(e) =>
                      setPreferences((prev) => ({ ...prev, [field]: e.target.checked }))
                    }
                  />
                  <span>{PREFERENCE_LABELS[field]}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleSavePreferences}
          disabled={prefSaving}
        >
          {prefSaving ? "Saving…" : "Save preferences"}
        </button>
      </div>

      {message && <p className="linked-wallets-hint email-settings-message">{message}</p>}
      {error && <p className="linked-wallets-error">{error}</p>}
    </div>
  );
}

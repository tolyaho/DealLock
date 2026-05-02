import { useEffect, useState } from "react";
import { patchAgreementContacts } from "../api/agreements.ts";
import { ApiError } from "../api/client.ts";
import { useAccountSession } from "../account/useAccountSession.ts";

interface Props {
  contractAddress: string;
  chainId: number;
  clientEmail: string | null;
  providerEmail: string | null;
  canEdit: boolean;
  onSaved: (clientEmail: string | null, providerEmail: string | null) => void;
}

function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return email || null;
}

function isValidOptionalEmail(value: string): boolean {
  const email = normalizeEmail(value);
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Could not save notification contacts";
}

export default function AgreementContactsPanel({
  contractAddress,
  chainId,
  clientEmail,
  providerEmail,
  canEdit,
  onSaved,
}: Props) {
  const { sessionStatus } = useAccountSession();
  const [editing, setEditing] = useState(false);
  const [clientValue, setClientValue] = useState(clientEmail ?? "");
  const [providerValue, setProviderValue] = useState(providerEmail ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) return;
    setClientValue(clientEmail ?? "");
    setProviderValue(providerEmail ?? "");
  }, [clientEmail, editing, providerEmail]);

  async function handleSave() {
    setError(null);
    setMessage(null);
    if (!isValidOptionalEmail(clientValue) || !isValidOptionalEmail(providerValue)) {
      setError("Contact emails must be valid email addresses.");
      return;
    }

    const nextClient = normalizeEmail(clientValue);
    const nextProvider = normalizeEmail(providerValue);
    setSaving(true);
    try {
      if (sessionStatus === "signed-in") {
        await patchAgreementContacts(contractAddress, {
          chainId,
          clientEmail: nextClient,
          providerEmail: nextProvider,
        });
      }
      onSaved(nextClient, nextProvider);
      setEditing(false);
      setMessage(
        sessionStatus === "signed-in"
          ? "Notification contacts saved."
          : "Notification contacts saved in this browser.",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface-card surface-card--pad notification-contacts-panel anim-fade-rise">
      <div className="section-header">
        <h2 className="section-header-title">Notification contacts</h2>
        <span className="section-header-desc">Off-chain emails for best-effort app notifications</span>
      </div>

      {!editing ? (
        <>
          <div className="notification-contact-grid">
            <div className="notification-contact-row">
              <span>Client email</span>
              <strong>{clientEmail || "Not set"}</strong>
            </div>
            <div className="notification-contact-row">
              <span>Provider email</span>
              <strong>{providerEmail || "Not set"}</strong>
            </div>
          </div>
          {canEdit && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
              Edit contacts
            </button>
          )}
        </>
      ) : (
        <div className="notification-contact-form">
          <div className="form-row form-row--2">
            <div className="field">
              <label className="label">Client email</label>
              <input
                type="email"
                value={clientValue}
                onChange={(e) => setClientValue(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="field">
              <label className="label">Provider email</label>
              <input
                type="email"
                value={providerValue}
                onChange={(e) => setProviderValue(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
          <div className="adj-form-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save contacts"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="hint">
        These emails are not stored on-chain and do not authorize contract actions.
      </p>
      {message && <div className="tx-status tx-success">{message}</div>}
      {error && <div className="tx-status tx-error">{error}</div>}
    </section>
  );
}

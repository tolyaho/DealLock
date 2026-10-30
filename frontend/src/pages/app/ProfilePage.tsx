/*
 * ProfilePage (/app/profile) — the account's identity surface, reached from the
 * topbar avatar and from Settings. Edits the persisted display name (first + last,
 * backed by PATCH /profile) and shows read-only account facts (email + verification
 * state, primary wallet) plus a sign-out. The name drives the avatar monogram
 * everywhere via auth/userDisplay.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { ApiError } from "../../auth/api";
import { displayName, initialsFor } from "../../auth/userDisplay";
import {
  Avatar,
  Button,
  Card,
  PageContainer,
  PageHeader,
  StatusChip,
  TextInput,
} from "../../components/app";

function shortAddress(address?: string): string {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—";
}

export default function ProfilePage() {
  const { user, wallets, status, updateProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const primary = wallets.find((w) => w.isPrimary) ?? wallets[0];
  const dirty =
    firstName.trim() !== (user?.firstName ?? "") || lastName.trim() !== (user?.lastName ?? "");

  const onField = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value);
    if (error) setError(null);
    if (saved) setSaved(false);
  };

  const save = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError("Enter both your first and last name.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateProfile(firstName.trim(), lastName.trim());
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <PageContainer>
      <PageHeader title="Profile" subtitle="Your name and account details." />

      <Card label="Identity">
        <div className="dl-profile__identity">
          <Avatar initials={initialsFor(user, wallets)} size="lg" />
          <div className="dl-profile__identity-text">
            <div className="dl-profile__name">{displayName(user, wallets) || "Unnamed account"}</div>
            <div className="dl-profile__meta">{shortAddress(primary?.address)}</div>
          </div>
        </div>

        <div className="dl-profile__form">
          <TextInput
            label="First name"
            value={firstName}
            onChange={onField(setFirstName)}
            autoComplete="given-name"
            placeholder="Ada"
            maxLength={60}
            required
          />
          <TextInput
            label="Last name"
            value={lastName}
            onChange={onField(setLastName)}
            autoComplete="family-name"
            placeholder="Lovelace"
            maxLength={60}
            required
          />
        </div>
        {error && (
          <p className="dl-auth__error" role="alert">
            {error}
          </p>
        )}
        <div className="dl-profile__actions">
          <Button
            variant="primary"
            disabled={saving || !dirty}
            className={saving ? "is-working" : undefined}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <span className="dl-profile__saved" role="status" aria-live="polite">
            {saved && !dirty ? "Saved" : ""}
          </span>
        </div>
      </Card>

      <Card label="Account">
        <div className="dl-setting-list">
          <div className="dl-setting">
            <div className="dl-setting__text">
              <div className="dl-setting__title">Email</div>
              <div className="dl-setting__desc">{user?.email ?? "No email added yet."}</div>
            </div>
            <StatusChip tone={status === "verified" ? "secure" : "review"}>
              {status === "verified" ? "Verified" : "Unverified"}
            </StatusChip>
          </div>
          <div className="dl-setting">
            <div className="dl-setting__text">
              <div className="dl-setting__title">Primary wallet</div>
              <div className="dl-setting__desc dl-profile__addr">{primary?.address ?? "—"}</div>
            </div>
            {primary && <StatusChip tone="neutral">Primary</StatusChip>}
          </div>
        </div>
      </Card>

      <Card label="Session">
        <div className="dl-setting">
          <div className="dl-setting__text">
            <div className="dl-setting__title">Sign out</div>
            <div className="dl-setting__desc">
              End your session on this device and disconnect the wallet.
            </div>
          </div>
          <Button variant="glass" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </Card>
    </PageContainer>
  );
}

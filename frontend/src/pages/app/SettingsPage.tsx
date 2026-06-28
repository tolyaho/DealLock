/*
 * Settings (skeleton) — demonstrates the settings-row pattern (label/description
 * left · control right, moodboard: ElevenLabs) with the Switch primitive. Local
 * state only; nothing persists yet.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Button, Card, PageContainer, PageHeader, Switch } from "../../components/app";
import { useAuth } from "../../auth/AuthContext";
import { displayName, initialsFor } from "../../auth/userDisplay";

interface Toggle {
  key: string;
  title: string;
  desc: string;
}

const NOTIFY: Toggle[] = [
  { key: "submitted", title: "Work submitted", desc: "Email me when a provider submits a milestone for review." },
  { key: "released", title: "Funds released", desc: "Email me when escrow is released to a provider." },
  { key: "revision", title: "Revision requested", desc: "Email me when a counterparty requests a revision." },
];

export default function SettingsPage() {
  const [on, setOn] = useState<Record<string, boolean>>({ submitted: true, released: true, revision: false });
  const { user, wallets } = useAuth();
  const navigate = useNavigate();

  return (
    <PageContainer>
      <PageHeader title="Settings" subtitle="Control how DealLock keeps you informed." />

      <Card label="Profile">
        <div className="dl-setting">
          <div className="dl-setting__text dl-profile__identity" style={{ marginBottom: 0 }}>
            <Avatar initials={initialsFor(user, wallets)} size="md" />
            <div className="dl-profile__identity-text">
              <div className="dl-setting__title">{displayName(user, wallets) || "Unnamed account"}</div>
              <div className="dl-setting__desc">Your name and account details.</div>
            </div>
          </div>
          <Button variant="glass" onClick={() => navigate("/app/profile")}>
            Edit profile
          </Button>
        </div>
      </Card>

      <Card label="Email notifications">
        <div className="dl-setting-list">
          {NOTIFY.map((t) => (
            <div className="dl-setting" key={t.key}>
              <div className="dl-setting__text">
                <div className="dl-setting__title">{t.title}</div>
                <div className="dl-setting__desc">{t.desc}</div>
              </div>
              <Switch
                on={!!on[t.key]}
                onChange={(v) => setOn((prev) => ({ ...prev, [t.key]: v }))}
                label={t.title}
              />
            </div>
          ))}
        </div>
      </Card>
    </PageContainer>
  );
}

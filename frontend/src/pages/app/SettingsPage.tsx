/*
 * Settings (skeleton) — demonstrates the settings-row pattern (label/description
 * left · control right, moodboard: ElevenLabs) with the Switch primitive. Local
 * state only; nothing persists yet.
 */
import { useState } from "react";
import { Card, PageContainer, PageHeader, Switch } from "../../components/app";

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

  return (
    <PageContainer>
      <PageHeader title="Settings" subtitle="Control how DealLock keeps you informed." />

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

/*
 * Settings (reference 07). Sticky left sub-nav + stacked section panels:
 * Profile · Security · Notifications · Linked wallets · Payment preferences ·
 * Appearance · Language & region · Advanced.
 *
 * Toggles/selects hold local UI state (that IS the save target in this pass —
 * no backend write is claimed). Wallet connect and anything on-chain is
 * disabled with a tooltip. Payment assets are limited to the registry set
 * (ETH + configured USDC) — no arbitrary token entry, per product non-goals.
 */
import { useRef, useState } from "react";
import { PageContent } from "../../components/dashboard/Page";
import PageHeader from "../../components/dashboard/PageHeader";
import {
  Avatar,
  Button,
  SectionCard,
  Segmented,
  Switch,
} from "../../components/dashboard/primitives";
import {
  IconBell,
  IconCheck,
  IconDollar,
  IconGlobe,
  IconImage,
  IconLink,
  IconSettings,
  IconShield,
  IconUser,
  IconWallet,
} from "../../components/dashboard/icons";
import type { ComponentType, SVGProps } from "react";

const SECTIONS: { id: string; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "profile", label: "Profile", Icon: IconUser },
  { id: "security", label: "Security", Icon: IconShield },
  { id: "notifications", label: "Notifications", Icon: IconBell },
  { id: "wallets", label: "Linked wallets", Icon: IconWallet },
  { id: "payment", label: "Payment preferences", Icon: IconDollar },
  { id: "appearance", label: "Appearance", Icon: IconImage },
  { id: "language", label: "Language & region", Icon: IconGlobe },
  { id: "advanced", label: "Advanced", Icon: IconSettings },
];

export default function SettingsPage() {
  const [active, setActive] = useState("profile");
  const [saved, setSaved] = useState(false);
  const scopeRef = useRef<HTMLDivElement | null>(null);

  // toggles (local state = the save target in this pass)
  const [twoFactor, setTwoFactor] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [notifAgreements, setNotifAgreements] = useState(true);
  const [notifMilestones, setNotifMilestones] = useState(true);
  const [notifMessages, setNotifMessages] = useState(false);
  const [asset, setAsset] = useState<"USDC" | "ETH">("USDC");
  const [language, setLanguage] = useState<"en" | "fr" | "de">("en");

  function goto(id: string) {
    setActive(id);
    const el = scopeRef.current?.querySelector(`#set-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function save() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  return (
    <PageContent>
      <PageHeader
        title="Settings"
        subtitle="Manage your account, preferences, and security."
        actions={
          <Button variant="primary" icon={saved ? <IconCheck /> : undefined} onClick={save}>
            {saved ? "Preferences updated" : "Save changes"}
          </Button>
        }
      />

      <div className="dl-settings" ref={scopeRef}>
        <nav className="dl-subnav" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`dl-subnav__item${active === s.id ? " is-active" : ""}`}
              onClick={() => goto(s.id)}
            >
              <s.Icon /> {s.label}
            </button>
          ))}
        </nav>

        <div className="dl-stack">
          {/* Profile */}
          <SectionCard label="Profile information" id="set-profile" action={<Button small variant="secondary">Edit profile</Button>}>
            <div className="dl-row" style={{ paddingTop: 4 }}>
              <Avatar initials="JL" size="lg" metal />
              <div className="dl-row__body">
                <div className="dl-table__name" style={{ gap: 8 }}>
                  <span className="dl-row__title" style={{ fontSize: 16 }}>Jordan Lee</span>
                  <span className="dl-pill dl-pill--approved"><span className="dl-pill__dot" />Verified</span>
                </div>
                <div className="dl-row__sub">jordan.lee@example.com · Client &amp; provider</div>
              </div>
            </div>
          </SectionCard>

          {/* Security */}
          <SectionCard label="Security" id="set-security">
            <div className="dl-field">
              <div>
                <div className="dl-field__label">Two-factor authentication</div>
                <div className="dl-field__hint">Require a second factor when signing in.</div>
              </div>
              <Switch on={twoFactor} onChange={setTwoFactor} label="Two-factor authentication" />
            </div>
            <div className="dl-field">
              <div>
                <div className="dl-field__label">Login alerts</div>
                <div className="dl-field__hint">Email me about new sign-ins to my account.</div>
              </div>
              <Switch on={loginAlerts} onChange={setLoginAlerts} label="Login alerts" />
            </div>
          </SectionCard>

          {/* Notifications */}
          <SectionCard label="Notifications" id="set-notifications">
            <div className="dl-field">
              <div>
                <div className="dl-field__label">Agreement updates</div>
                <div className="dl-field__hint">Status changes, funding, and approvals.</div>
              </div>
              <Switch on={notifAgreements} onChange={setNotifAgreements} label="Agreement updates" />
            </div>
            <div className="dl-field">
              <div>
                <div className="dl-field__label">Milestone reminders</div>
                <div className="dl-field__hint">Upcoming due dates and review windows.</div>
              </div>
              <Switch on={notifMilestones} onChange={setNotifMilestones} label="Milestone reminders" />
            </div>
            <div className="dl-field">
              <div>
                <div className="dl-field__label">Messages</div>
                <div className="dl-field__hint">New messages from counterparties.</div>
              </div>
              <Switch on={notifMessages} onChange={setNotifMessages} label="Messages" />
            </div>
          </SectionCard>

          {/* Linked wallets */}
          <SectionCard label="Linked wallets" id="set-wallets" action={<Button small variant="secondary" icon={<IconLink />} comingSoon>Connect wallet</Button>}>
            <div className="dl-row">
              <span className="dl-row__icon"><IconWallet /></span>
              <span className="dl-row__body">
                <span className="dl-row__title">Ethereum · 0x8f3a…7f90</span>
                <span className="dl-row__sub">Primary payout wallet</span>
              </span>
              <span className="dl-pill dl-pill--approved"><span className="dl-pill__dot" />Connected</span>
            </div>
          </SectionCard>

          {/* Payment preferences */}
          <SectionCard label="Payment preferences" id="set-payment">
            <div className="dl-field">
              <div>
                <div className="dl-field__label">Preferred settlement asset</div>
                <div className="dl-field__hint">Only assets supported by the escrow registry are available.</div>
              </div>
              <Segmented
                options={[{ value: "USDC", label: "USDC" }, { value: "ETH", label: "ETH" }]}
                value={asset}
                onChange={setAsset}
                ariaLabel="Preferred settlement asset"
              />
            </div>
            <div className="dl-field">
              <div>
                <div className="dl-field__label">Payout network</div>
                <div className="dl-field__hint">Settlements occur on the network of the agreement's escrow contract.</div>
              </div>
              <span className="dl-metachip"><IconGlobe /> Ethereum · Sepolia</span>
            </div>
          </SectionCard>

          {/* Appearance */}
          <SectionCard label="Appearance" id="set-appearance">
            <div className="dl-field">
              <div>
                <div className="dl-field__label">Theme</div>
                <div className="dl-field__hint">A refined light theme. Dark mode is on the roadmap.</div>
              </div>
              <Segmented
                options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]}
                value={"light"}
                onChange={() => {}}
                ariaLabel="Theme"
              />
            </div>
          </SectionCard>

          {/* Language & region */}
          <SectionCard label="Language &amp; region" id="set-language">
            <div className="dl-field">
              <div>
                <div className="dl-field__label">Language</div>
                <div className="dl-field__hint">Used across the dashboard interface.</div>
              </div>
              <Segmented
                options={[{ value: "en", label: "English" }, { value: "fr", label: "Français" }, { value: "de", label: "Deutsch" }]}
                value={language}
                onChange={setLanguage}
                ariaLabel="Language"
              />
            </div>
          </SectionCard>

          {/* Advanced */}
          <SectionCard label="Advanced" id="set-advanced">
            <div className="dl-field">
              <div>
                <div className="dl-field__label">Export account data</div>
                <div className="dl-field__hint">Download a copy of your agreements and activity.</div>
              </div>
              <Button small variant="secondary" comingSoon>Request export</Button>
            </div>
          </SectionCard>
        </div>
      </div>
    </PageContent>
  );
}

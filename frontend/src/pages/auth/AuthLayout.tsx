/*
 * AuthLayout — the shared shell for /login and /signup. It is NOT the dashboard
 * shell: no sidebar, no topbar, no workspace switcher. It's a standalone composed
 * scene modelled on the reference render:
 *
 *   LEFT  — a light brushed-metal wall with a fluted side panel, an engraved
 *           caption, and the escrow vault (the vault-door Spline scene) mounted into a
 *           machined wall socket: a carved pocket behind it and a rim/lip in front, so
 *           the safe reads as set THROUGH the wall; a soft floor glow.
 *   RIGHT — a clean light panel carrying the wallet-first sign-in form: brand,
 *           headline, subtitle, the {children} steps, and an "Enterprise-grade
 *           security" reassurance card. A {footer} slot sits at the very bottom.
 *
 * It lives under `.dl-app` so the form can reuse the dashboard's pearl primitives
 * (Button, TextInput, StatusChip) and tokens; `.dl-auth` re-specifies the shell
 * layout for this full-page surface. Responsive: two columns on desktop; the vault
 * stacks ABOVE the form on mobile (auth.css).
 */
import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import "../../styles/auth.css";
import { IconArrowLeft, IconShield } from "../../components/app/icons";
import AuthVaultSpline from "./AuthVaultSpline";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Bottom-of-panel link, e.g. "New to DealLock? Sign up." (page-specific). */
  footer?: ReactNode;
}

export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="dl-app dl-auth">
      <Link to="/" className="dl-auth__home">
        <IconArrowLeft />
        <span>Home</span>
      </Link>

      <div className="dl-auth__split">
        {/* LEFT — the brushed-metal wall with the escrow vault set into a niche */}
        <aside className="dl-auth__vault-side" aria-hidden="true">
          <span className="dl-auth__flute" />
          <div className="dl-auth__wall">
            <div className="dl-auth__wall-caption">
              <span className="dl-auth__wall-caption-title">DealLock Escrow Vault</span>
              <span className="dl-auth__wall-caption-body">
                Client funds are secured on-chain
                <br />
                until milestones are met and approved.
              </span>
            </div>
            <div className="dl-auth__vault-stage">
              <span className="dl-auth__vault-socket" />
              <div className="dl-auth__vault-object">
                <AuthVaultSpline />
              </div>
              <span className="dl-auth__vault-lip" />
            </div>
          </div>
          <span className="dl-auth__floor" />
        </aside>

        {/* RIGHT — the wallet-first sign-in panel */}
        <main className="dl-auth__form-side" aria-labelledby="dl-auth-title">
          <div className="dl-auth__form-inner">
            <header className="dl-auth__topbar">
              <div className="dl-auth__brand">
                <span className="dl-auth__brand-mark" aria-hidden="true">
                  <IconShield />
                </span>
                <span className="dl-auth__brand-name">DealLock</span>
              </div>
            </header>

            <div className="dl-auth__head">
              <h1 className="dl-auth__title" id="dl-auth-title">
                {title}
              </h1>
              <p className="dl-auth__sub">{subtitle}</p>
            </div>

            {children}

            <div className="dl-auth__security">
              <span className="dl-auth__security-icon" aria-hidden="true">
                <IconShield />
              </span>
              <div className="dl-auth__security-text">
                <strong>Enterprise-grade security</strong>
                <span>Funds are held in audited on-chain escrow and released only on approval.</span>
                <span className="dl-auth__security-status">All systems operational</span>
              </div>
            </div>

            {footer && <p className="dl-auth__alt">{footer}</p>}
          </div>
        </main>
      </div>
    </div>
  );
}

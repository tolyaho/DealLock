/*
 * VerifyEmailPage (/verify-email) — the email step a wallet-only session must clear
 * before entering /app. It does two things:
 *
 *   1. REAL: request a verification link with the existing startEmail(email) →
 *      POST /email/start-verification. The link is delivered out-of-band (in local
 *      dev it prints to the backend console) and completes via the /app?verifyEmail=
 *      deep link AuthContext already handles.
 *
 *   2. TEMPORARY DEV BYPASS: a code field that accepts ANY non-empty value and marks
 *      the FRONTEND flow complete (devBypassEmailVerification). This unlocks only the
 *      UI shell — the backend `requireVerified` middleware is untouched, so product
 *      APIs still 403 until the real link is opened. See AuthContext's DEV BYPASS
 *      block. Replace the whole code step with real /email/confirm verification.
 *
 * Routing (after the wallet/email states settle):
 *   loading   → calm skeleton
 *   anonymous → /login
 *   verified  → /app/home   (real verification OR dev bypass already applied)
 *   wallet    → the email + dev-code steps below
 */
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { ApiError } from "../../auth/api";
import { Button, TextInput } from "../../components/app";
import { IconArrowRight } from "../../components/app/icons";
import AuthLayout from "./AuthLayout";
import AuthLoading from "./AuthLoading";
import { WalletRow } from "./ConnectAndSign";

const TITLE = "Verify your email.";
const SUBTITLE =
  "Your wallet is signed in. Confirm your email to unlock agreement notifications and your dashboard.";

// Pragmatic client-side check; the backend validates authoritatively.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function VerifyEmailPage() {
  const { status, gateStatus, user, wallets, startEmail, devBypassEmailVerification } = useAuth();
  const navigate = useNavigate();

  const walletAddress = (wallets.find((w) => w.isPrimary) ?? wallets[0])?.address;

  const [email, setEmail] = useState(user?.email ?? "");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  // ── Redirects (all hooks above run first, so hook order stays stable) ──
  if (gateStatus === "loading") {
    return (
      <AuthLayout title={TITLE} subtitle="One moment while we check your session.">
        <AuthLoading />
      </AuthLayout>
    );
  }
  if (status === "anonymous") return <Navigate to="/login" replace />;
  if (gateStatus === "verified") return <Navigate to="/app/home" replace />;

  // status === "wallet" (and not bypassed): show the email + dev-code steps.

  const sendEmail = async () => {
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError(null);
    setSending(true);
    try {
      await startEmail(value);
      setSent(true);
    } catch (e) {
      setEmailError(e instanceof ApiError ? e.message : "Could not send the verification email.");
    } finally {
      setSending(false);
    }
  };

  // TEMPORARY DEV BEHAVIOR: any non-empty code marks the FRONTEND flow complete and
  // lets the user into the /app shell. NOT production-secure — backend product calls
  // still require the real email link to be opened. Remove with the dev bypass.
  const verifyCode = () => {
    if (!code.trim()) {
      setCodeError("Enter the code from your email.");
      return;
    }
    setCodeError(null);
    devBypassEmailVerification();
    navigate("/app/home", { replace: true });
  };

  return (
    <AuthLayout
      title={TITLE}
      subtitle={SUBTITLE}
      footer={<>Need to use a different wallet? <Link to="/login">Log in again</Link>.</>}
    >
      <div className="dl-auth__steps">
        <span className="dl-auth__eyebrow">Step 2 — verify email</span>

        <WalletRow address={walletAddress} tone="secure" label="Signed in" />

        <TextInput
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void sendEmail();
          }}
          hint="We'll send a verification link to this address."
          error={emailError ?? undefined}
          required
        />
        <Button
          block
          variant="metal"
          disabled={sending}
          className={sending ? "is-working" : undefined}
          onClick={() => void sendEmail()}
        >
          {sending ? "Sending link…" : sent ? "Resend verification email" : "Send verification email"}
        </Button>

        {sent && (
          <p className="dl-auth__note" role="status" aria-live="polite">
            Verification link sent to <strong>{email}</strong>. In local dev the link is printed in
            the backend console — open it to complete real verification.
          </p>
        )}

        {/* ── TEMPORARY DEV-ONLY code step ──────────────────────────────────────
         *  Accepts any non-empty value and unlocks the UI shell only. This whole
         *  box is removed once real /email/confirm verification ships. */}
        <div className="dl-auth__devbox">
          <span className="dl-auth__devtag">Dev only</span>
          <TextInput
            label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Enter any code for now"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (codeError) setCodeError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") verifyCode();
            }}
            hint="Temporary: any non-empty value continues. Unlocks the UI shell only — product data still needs the real email link."
            error={codeError ?? undefined}
          />
          <Button block variant="primary" icon={<IconArrowRight />} onClick={verifyCode}>
            Verify &amp; continue
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}

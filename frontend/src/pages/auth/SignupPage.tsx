/*
 * SignupPage (/signup) — wallet-first account creation:
 *   1. Connect wallet  2. Sign message  3. Add email (notifications / recovery)
 *   4. Continue to the dashboard.
 *
 * Email is secondary, not the primary identity: it's only asked for AFTER the
 * wallet is signed in, and it completes out-of-band via the verification link
 * (the backend emails /app?verifyEmail=…; in local dev the link prints to the
 * backend console). We surface a calm "check your email" state, then send the
 * (still wallet-only) user on to /verify-email — never straight to the dashboard.
 */
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { ApiError } from "../../auth/api";
import { Button, TextInput } from "../../components/app";
import { IconArrowRight, IconCheck } from "../../components/app/icons";
import AuthLayout from "./AuthLayout";
import AuthLoading from "./AuthLoading";
import { ConnectAndSign, WalletRow } from "./ConnectAndSign";

const TITLE = "Create your DealLock account.";
const SUBTITLE =
  "Secure client escrow. Connect a wallet to start, then add email for agreement notifications.";

// Pragmatic client-side check; the backend validates authoritatively.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupPage() {
  const { status, gateStatus, user, wallets, startEmail, updateProfile } = useAuth();
  const navigate = useNavigate();

  // After sign-in the session carries the wallet(s); show the primary one.
  const walletAddress = (wallets.find((w) => w.isPrimary) ?? wallets[0])?.address;
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Fully onboarded already (or dev-bypassed) → dashboard.
  if (gateStatus === "verified") return <Navigate to="/app/home" replace />;

  const hasSession = Boolean(user); // wallet signed in, email not yet verified

  const submitEmail = async () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      setNameError("Enter your first and last name.");
      return;
    }
    setNameError(null);
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError(null);
    setSending(true);
    try {
      // Persist the name first (so the avatar is valid right away), then send the link.
      await updateProfile(fn, ln);
      await startEmail(value);
      setSent(true);
    } catch (e) {
      setEmailError(e instanceof ApiError ? e.message : "Could not save your details.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthLayout
      title={TITLE}
      subtitle={SUBTITLE}
      footer={
        status !== "loading" && !hasSession ? (
          <>
            Already have an account? <Link to="/login">Log in</Link>.
          </>
        ) : undefined
      }
    >
      {status === "loading" && <AuthLoading />}

      {status !== "loading" && !hasSession && <ConnectAndSign signLabel="Sign message" />}

      {hasSession && !sent && (
        <div className="dl-auth__steps">
          <WalletRow address={walletAddress} tone="secure" label="Signed in" />
          <div className="dl-auth__namerow">
            <TextInput
              label="First name"
              autoComplete="given-name"
              placeholder="Ada"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                if (nameError) setNameError(null);
              }}
              maxLength={60}
              error={nameError ?? undefined}
              required
            />
            <TextInput
              label="Last name"
              autoComplete="family-name"
              placeholder="Lovelace"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                if (nameError) setNameError(null);
              }}
              maxLength={60}
              required
            />
          </div>
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
              if (e.key === "Enter") void submitEmail();
            }}
            hint="For agreement notifications and account recovery."
            error={emailError ?? undefined}
            required
          />
          <Button
            block
            variant="metal"
            icon={<IconArrowRight />}
            disabled={sending}
            className={sending ? "is-working" : undefined}
            onClick={() => void submitEmail()}
          >
            {sending ? "Sending link…" : "Continue"}
          </Button>
        </div>
      )}

      {hasSession && sent && (
        <div className="dl-auth__sent" role="status" aria-live="polite">
          <span className="dl-auth__sent-seal" aria-hidden="true">
            <IconCheck />
          </span>
          <h2 className="dl-auth__sent-title">Check your email</h2>
          <p className="dl-auth__sent-text">
            We sent a verification link to <strong>{email}</strong>. Open it to finish setting up
            notifications and recovery.
          </p>
          <p className="dl-auth__note">In local dev the link is printed in the backend console.</p>
          <Button block variant="primary" onClick={() => navigate("/verify-email")}>
            Continue to verification
          </Button>
          <button type="button" className="dl-auth__linkbtn" onClick={() => setSent(false)}>
            Use a different email
          </button>
        </div>
      )}
    </AuthLayout>
  );
}

/*
 * LoginPage (/login) — wallet-first sign-in. Connect a wallet, sign the message,
 * then route by session state: a verified session goes to the dashboard, a
 * wallet-only session still owes the email step (→ /verify-email).
 */
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import AuthLayout from "./AuthLayout";
import AuthLoading from "./AuthLoading";
import { ConnectAndSign } from "./ConnectAndSign";

export default function LoginPage() {
  const { status, gateStatus } = useAuth();

  // Fully onboarded (or dev-bypassed) → the dashboard.
  if (gateStatus === "verified") return <Navigate to="/app/home" replace />;
  // Wallet signed in but email not yet verified → finish the email step.
  if (gateStatus === "wallet") return <Navigate to="/verify-email" replace />;

  // gateStatus is "loading" or "anonymous": render the sign-in scene below.
  return (
    <AuthLayout
      title="Log in to DealLock."
      subtitle="Secure client escrow. Ship work with confidence. Funds stay locked until milestones are approved."
      footer={
        status === "loading" ? undefined : (
          <>
            New to DealLock? <Link to="/signup">Sign up</Link>.
          </>
        )
      }
    >
      {status === "loading" ? <AuthLoading /> : <ConnectAndSign signLabel="Sign message" />}
    </AuthLayout>
  );
}

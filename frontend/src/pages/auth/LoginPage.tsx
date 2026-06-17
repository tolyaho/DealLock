/*
 * LoginPage (/login) — wallet-first sign-in. Connect a wallet, sign the message,
 * continue to the dashboard. No email step on login (email is recovery /
 * notifications only — collected at sign-up).
 */
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import AuthLayout from "./AuthLayout";
import AuthLoading from "./AuthLoading";
import { ConnectAndSign } from "./ConnectAndSign";

export default function LoginPage() {
  const { status, isAuthenticated } = useAuth();

  // A live session (wallet or verified) → the dashboard. Login does not gate on
  // the email step.
  if (isAuthenticated) return <Navigate to="/app/home" replace />;

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

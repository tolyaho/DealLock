/*
 * RequireVerified — the route guard for the /app shell. It mirrors the backend's
 * `requireVerified` rule on the client: only a wallet session WITH a verified email
 * may enter the dashboard.
 *
 * It keys off `gateStatus` (not the raw backend `status`) so the temporary dev email
 * bypass can unlock the shell during local development — see AuthContext's DEV BYPASS
 * block. Even so, the backend still gates every product route, so an unverified user
 * only ever sees the (fixture) UI shell.
 *
 *   loading   → a minimal branded loading shell (the GET /auth/me check is settling)
 *   anonymous → /login
 *   wallet    → /verify-email   (signed in, email step not complete)
 *   verified  → render the nested routes
 */
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function RequireVerified() {
  const { gateStatus } = useAuth();

  if (gateStatus === "loading") {
    return (
      <div className="dl-app dl-route-loading" role="status" aria-live="polite" aria-busy="true">
        <span className="dl-route-loading__pulse" aria-hidden="true" />
        <span className="dl-route-loading__label">Checking your session…</span>
      </div>
    );
  }

  if (gateStatus === "anonymous") return <Navigate to="/login" replace />;
  if (gateStatus === "wallet") return <Navigate to="/verify-email" replace />;

  // gateStatus === "verified"
  return <Outlet />;
}

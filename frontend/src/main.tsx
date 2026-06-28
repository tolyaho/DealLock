import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./styles.css";

import { AuthProviders } from "./auth/AuthProviders";
import RequireVerified from "./auth/RequireVerified";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage";
import AppShell from "./components/app/AppShell";
import HomePage from "./pages/app/HomePage";
import ProfilePage from "./pages/app/ProfilePage";
import AgreementsPage from "./pages/app/AgreementsPage";
import CreatePage from "./pages/app/create/CreatePage";
import ActivityPage from "./pages/app/ActivityPage";
import CounterpartiesPage from "./pages/app/CounterpartiesPage";
import MessagesPage from "./pages/app/MessagesPage";
import StatisticsPage from "./pages/app/StatisticsPage";
import SettingsPage from "./pages/app/SettingsPage";
import WalletPage from "./pages/app/WalletPage";
import DesignLabPage from "./pages/app/DesignLabPage";

/*
 * Surfaces, one app:
 *   /              — the marketing landing (unchanged)
 *   /login,/signup — the wallet-first auth pages (AuthLayout, standalone scene)
 *   /verify-email  — the email step a wallet-only session must clear before /app
 *   /app/*         — the dashboard, inside the shared AppShell (design foundation
 *                    only; screens are fixtures). Gated by <RequireVerified>:
 *                    anonymous → /login, wallet-only → /verify-email, verified → in.
 *                    /app/design-lab previews the system.
 *
 * Everything sits inside <AuthProviders> (wagmi + React Query + AuthProvider) so
 * any surface can read the session; it adds no visual chrome to the landing.
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProviders>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          {/* /app is gated: RequireVerified resolves the session, then AppShell frames
              the verified routes. Anonymous → /login, wallet-only → /verify-email. */}
          <Route path="/app" element={<RequireVerified />}>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/app/home" replace />} />
              <Route path="home" element={<HomePage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="agreements" element={<AgreementsPage />} />
              <Route path="create" element={<CreatePage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="counterparties" element={<CounterpartiesPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="statistics" element={<StatisticsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="wallet" element={<WalletPage />} />
              <Route path="design-lab" element={<DesignLabPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProviders>
    </BrowserRouter>
  </StrictMode>,
);

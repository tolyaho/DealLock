import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./styles.css";

import { AuthProviders } from "./auth/AuthProviders";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import AppShell from "./components/app/AppShell";
import HomePage from "./pages/app/HomePage";
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
 *   /app/*         — the dashboard, inside the shared AppShell (design foundation
 *                    only; screens are fixtures). /app/design-lab previews the system.
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

          <Route path="/app" element={<AppShell />}>
            <Route index element={<Navigate to="/app/home" replace />} />
            <Route path="home" element={<HomePage />} />
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProviders>
    </BrowserRouter>
  </StrictMode>,
);

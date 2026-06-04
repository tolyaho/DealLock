import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./styles.css";

import LandingPage from "./pages/LandingPage";
import DashboardShell from "./components/dashboard/DashboardShell";
import HomePage from "./pages/dashboard/HomePage";
import AgreementsPage from "./pages/dashboard/AgreementsPage";
import AgreementDetailPage from "./pages/dashboard/AgreementDetailPage";
import MilestoneReviewPage from "./pages/dashboard/MilestoneReviewPage";
import ProviderPage from "./pages/dashboard/ProviderPage";
import ActivityPage from "./pages/dashboard/ActivityPage";
import MessagesPage from "./pages/dashboard/MessagesPage";
import CounterpartiesPage from "./pages/dashboard/CounterpartiesPage";
import StatisticsPage from "./pages/dashboard/StatisticsPage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import WalletPage from "./pages/dashboard/WalletPage";

/*
 * Two surfaces, one app:
 *   /      — the marketing landing (unchanged)
 *   /app/* — the authenticated dashboard, inside the shared DashboardShell
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/app" element={<DashboardShell />}>
          <Route index element={<Navigate to="/app/home" replace />} />
          <Route path="home" element={<HomePage />} />
          <Route path="agreements" element={<AgreementsPage />} />
          <Route path="agreements/:id" element={<AgreementDetailPage />} />
          <Route
            path="agreements/:id/milestones/:milestoneId/review"
            element={<MilestoneReviewPage />}
          />
          <Route path="provider" element={<ProviderPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="counterparties" element={<CounterpartiesPage />} />
          <Route path="statistics" element={<StatisticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="wallet" element={<WalletPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./styles.css";

import LandingPage from "./pages/LandingPage";
import AppShell from "./components/app/AppShell";
import HomePage from "./pages/app/HomePage";
import AgreementsPage from "./pages/app/AgreementsPage";
import ActivityPage from "./pages/app/ActivityPage";
import CounterpartiesPage from "./pages/app/CounterpartiesPage";
import MessagesPage from "./pages/app/MessagesPage";
import StatisticsPage from "./pages/app/StatisticsPage";
import SettingsPage from "./pages/app/SettingsPage";
import WalletPage from "./pages/app/WalletPage";
import DesignLabPage from "./pages/app/DesignLabPage";

/*
 * Two surfaces, one app:
 *   /      — the marketing landing (unchanged)
 *   /app/* — the dashboard, inside the shared AppShell (design foundation only;
 *            screens are skeletons for now). /app/design-lab previews the system.
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/app" element={<AppShell />}>
          <Route index element={<Navigate to="/app/home" replace />} />
          <Route path="home" element={<HomePage />} />
          <Route path="agreements" element={<AgreementsPage />} />
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
    </BrowserRouter>
  </StrictMode>,
);

import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./lib/auth/AuthProvider";
import { RequireAuth } from "./components/guards";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { configureAnalytics, trackPageview } from "./lib/integrations/analytics";
import AuthPage from "./pages/AuthPage";
import AppShell from "./pages/AppShell";
import Overview from "./pages/Overview";
import MasterDataPage from "./pages/MasterDataPage";
import IntegrationsSettingsPage from "./pages/IntegrationsSettingsPage";
import PlannerPage from "./pages/PlannerPage";
import EvaluationPage from "./pages/EvaluationPage";
import ScenariosPage from "./pages/ScenariosPage";
import ChannelComparisonPage from "./pages/ChannelComparisonPage";
import SkuChannelMatrixPage from "./pages/SkuChannelMatrixPage";
import BudgetOptimizerPage from "./pages/BudgetOptimizerPage";
import PromotionCalendarPage from "./pages/PromotionCalendarPage";
import UploadCenterPage from "./pages/UploadCenterPage";
import HistoryPage from "./pages/HistoryPage";
import ReportsPage from "./pages/ReportsPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

// Initialise analytics once from env (no-ops when unconfigured).
configureAnalytics(null);

function PageviewTracker() {
  const location = useLocation();
  useEffect(() => { trackPageview(location.pathname); }, [location.pathname]);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <PageviewTracker />
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route
                element={
                  <RequireAuth>
                    <AppShell />
                  </RequireAuth>
                }
              >
                <Route path="/" element={<Overview />} />
                <Route path="/planner" element={<PlannerPage />} />
                <Route path="/evaluations" element={<EvaluationPage />} />
                <Route path="/scenarios" element={<ScenariosPage />} />
                <Route path="/channels" element={<ChannelComparisonPage />} />
                <Route path="/matrix" element={<SkuChannelMatrixPage />} />
                <Route path="/optimizer" element={<BudgetOptimizerPage />} />
                <Route path="/calendar" element={<PromotionCalendarPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/uploads" element={<UploadCenterPage />} />
                <Route path="/settings/master-data" element={<MasterDataPage />} />
                <Route path="/settings/integrations" element={<IntegrationsSettingsPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

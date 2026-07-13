import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./lib/auth/AuthProvider";
import { RequireAuth } from "./components/guards";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { configureAnalytics, trackPageview } from "./lib/integrations/analytics";
import AuthPage from "./pages/AuthPage";
import AppShell from "./pages/AppShell";

// Route-level code splitting — each module loads on demand, keeping the initial
// bundle small. The app shell + auth stay eager (needed on first paint).
const Overview = lazy(() => import("./pages/Overview"));
const MasterDataPage = lazy(() => import("./pages/MasterDataPage"));
const IntegrationsSettingsPage = lazy(() => import("./pages/IntegrationsSettingsPage"));
const PlannerPage = lazy(() => import("./pages/PlannerPage"));
const EvaluationPage = lazy(() => import("./pages/EvaluationPage"));
const ScenariosPage = lazy(() => import("./pages/ScenariosPage"));
const ChannelComparisonPage = lazy(() => import("./pages/ChannelComparisonPage"));
const SkuChannelMatrixPage = lazy(() => import("./pages/SkuChannelMatrixPage"));
const BudgetOptimizerPage = lazy(() => import("./pages/BudgetOptimizerPage"));
const PromotionCalendarPage = lazy(() => import("./pages/PromotionCalendarPage"));
const UploadCenterPage = lazy(() => import("./pages/UploadCenterPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));

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

function RouteFallback() {
  return <div className="p-8 text-sm text-slate-500">Loading…</div>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <PageviewTracker />
            <Suspense fallback={<RouteFallback />}>
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
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

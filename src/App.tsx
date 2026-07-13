import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth/AuthProvider";
import { RequireAuth } from "./components/guards";
import AuthPage from "./pages/AuthPage";
import AppShell from "./pages/AppShell";
import Overview from "./pages/Overview";
import MasterDataPage from "./pages/MasterDataPage";
import PlannerPage from "./pages/PlannerPage";
import EvaluationPage from "./pages/EvaluationPage";
import Placeholder from "./pages/Placeholder";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
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
              <Route path="/scenarios" element={<Placeholder title="Scenario Comparison" stage="Stage 8" />} />
              <Route path="/channels" element={<Placeholder title="Channel Comparison" stage="Stage 9" />} />
              <Route path="/matrix" element={<Placeholder title="SKU-Channel Matrix" stage="Stage 10" />} />
              <Route path="/optimizer" element={<Placeholder title="Budget Optimizer" stage="Stage 12" />} />
              <Route path="/calendar" element={<Placeholder title="Promotion Calendar" stage="Stage 13" />} />
              <Route path="/history" element={<Placeholder title="History" stage="Stage 10" />} />
              <Route path="/reports" element={<Placeholder title="Reports" stage="Stage 15" />} />
              <Route path="/uploads" element={<Placeholder title="Upload Center" stage="Stage 14" />} />
              <Route path="/settings/master-data" element={<MasterDataPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

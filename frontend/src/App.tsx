import { lazy, Suspense, useEffect } from "react";
import type { ReactNode } from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import { AppShell } from "@/components/app-shell";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/auth-guard";
import { FullPageLoader } from "@/components/ui/spin";

const AnalyticsPage = lazy(() => import("@/pages/analytics"));
const AssistantPage = lazy(() => import("@/pages/assistant"));
const BudgetsPage = lazy(() => import("@/pages/budgets"));
const GoalsPage = lazy(() => import("@/pages/goals"));
const LandingPage = lazy(() => import("@/pages/landing"));
const LoginPage = lazy(() => import("@/pages/login"));
const NotFoundPage = lazy(() => import("@/pages/not-found"));
const NotificationsPage = lazy(() => import("@/pages/notifications"));
const OverviewPage = lazy(() => import("@/pages/overview"));
const RegisterPage = lazy(() => import("@/pages/register"));
const ResearchPage = lazy(() => import("@/pages/research"));
const ScenariosPage = lazy(() => import("@/pages/scenarios"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const TransactionsPage = lazy(() => import("@/pages/transactions"));

const titles: Record<string, string> = {
  "/": "FinSight AI — See your money clearly",
  "/login": "Sign in — FinSight AI",
  "/register": "Create your account — FinSight AI",
  "/app": "Overview — FinSight AI",
  "/app/transactions": "Transactions — FinSight AI",
  "/app/budgets": "Budgets — FinSight AI",
  "/app/goals": "Goals — FinSight AI",
  "/app/analytics": "Analytics — FinSight AI",
  "/app/scenarios": "Scenario lab — FinSight AI",
  "/app/assistant": "AI assistant — FinSight AI",
  "/app/notifications": "Notifications — FinSight AI",
  "/app/research": "Research lab — FinSight AI",
  "/app/settings": "Settings — FinSight AI",
};

function RouteEffects() {
  const location = useLocation();

  useEffect(() => {
    document.title = titles[location.pathname] ?? "Page not found — FinSight AI";
    if (!location.pathname.startsWith("/app")) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [location.pathname]);

  return null;
}

function PageSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullPageLoader />}>{children}</Suspense>;
}

export default function App() {
  return (
    <>
      <RouteEffects />
      <Routes>
        <Route
          path="/"
          element={
            <PageSuspense>
              <LandingPage />
            </PageSuspense>
          }
        />
        <Route element={<PublicOnlyRoute />}>
          <Route
            path="/login"
            element={
              <PageSuspense>
                <LoginPage />
              </PageSuspense>
            }
          />
          <Route
            path="/register"
            element={
              <PageSuspense>
                <RegisterPage />
              </PageSuspense>
            }
          />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppShell />}>
            <Route
              index
              element={
                <PageSuspense>
                  <OverviewPage />
                </PageSuspense>
              }
            />
            <Route
              path="transactions"
              element={
                <PageSuspense>
                  <TransactionsPage />
                </PageSuspense>
              }
            />
            <Route
              path="budgets"
              element={
                <PageSuspense>
                  <BudgetsPage />
                </PageSuspense>
              }
            />
            <Route
              path="goals"
              element={
                <PageSuspense>
                  <GoalsPage />
                </PageSuspense>
              }
            />
            <Route
              path="analytics"
              element={
                <PageSuspense>
                  <AnalyticsPage />
                </PageSuspense>
              }
            />
            <Route
              path="scenarios"
              element={
                <PageSuspense>
                  <ScenariosPage />
                </PageSuspense>
              }
            />
            <Route
              path="assistant"
              element={
                <PageSuspense>
                  <AssistantPage />
                </PageSuspense>
              }
            />
            <Route
              path="notifications"
              element={
                <PageSuspense>
                  <NotificationsPage />
                </PageSuspense>
              }
            />
            <Route
              path="research"
              element={
                <PageSuspense>
                  <ResearchPage />
                </PageSuspense>
              }
            />
            <Route
              path="settings"
              element={
                <PageSuspense>
                  <SettingsPage />
                </PageSuspense>
              }
            />
            <Route
              path="*"
              element={
                <PageSuspense>
                  <NotFoundPage />
                </PageSuspense>
              }
            />
          </Route>
        </Route>
        <Route
          path="*"
          element={
            <PageSuspense>
              <NotFoundPage />
            </PageSuspense>
          }
        />
      </Routes>
    </>
  );
}

import { Navigate, Outlet, useLocation } from "react-router-dom";

import { FullPageLoader } from "@/components/ui/spin";
import { useAuth } from "@/hooks/use-auth";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageLoader />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <FullPageLoader />;
  if (isAuthenticated) return <Navigate to="/app" replace />;
  return <Outlet />;
}

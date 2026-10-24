import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";

import { AuthContext } from "@/hooks/auth-context";
import type { AuthContextValue } from "@/hooks/auth-context";
import { api } from "@/lib/api";
import type { AuthResponse, User } from "@/lib/types";

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [forcedOut, setForcedOut] = useState(false);
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => (await api.get<{ user: User | null }>("/auth/session")).user,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const onUnauthorized = () => {
      setForcedOut(true);
      queryClient.setQueryData(["auth", "me"], null);
      queryClient.removeQueries({ queryKey: ["dashboard"] });
    };
    window.addEventListener("finsight:unauthorized", onUnauthorized);
    return () => window.removeEventListener("finsight:unauthorized", onUnauthorized);
  }, [queryClient]);

  const applyAuth = useCallback(
    (response: AuthResponse) => {
      setForcedOut(false);
      queryClient.setQueryData(["auth", "me"], response.user);
      void queryClient.invalidateQueries();
      return response.user;
    },
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await api.post<AuthResponse>("/auth/login", { email, password });
      return applyAuth(response);
    },
    [applyAuth],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const response = await api.post<AuthResponse>("/auth/register", {
        name,
        email,
        password,
      });
      return applyAuth(response);
    },
    [applyAuth],
  );

  const demoLogin = useCallback(async () => {
    const response = await api.post<AuthResponse>("/auth/demo");
    return applyAuth(response);
  }, [applyAuth]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setForcedOut(true);
      queryClient.setQueryData(["auth", "me"], null);
      queryClient.clear();
    }
  }, [queryClient]);

  const resetDemo = useCallback(async () => {
    const response = await api.post<AuthResponse>("/auth/demo/reset");
    return applyAuth(response);
  }, [applyAuth]);

  const user = forcedOut ? null : (meQuery.data ?? null);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading: meQuery.isLoading,
      isAuthenticated: Boolean(user),
      login,
      register,
      demoLogin,
      logout,
      resetDemo,
    }),
    [user, meQuery.isLoading, login, register, demoLogin, logout, resetDemo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

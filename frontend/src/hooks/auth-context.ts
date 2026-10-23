import { createContext } from "react";

import type { User } from "@/lib/types";

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  demoLogin: () => Promise<User>;
  logout: () => Promise<void>;
  resetDemo: () => Promise<User>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

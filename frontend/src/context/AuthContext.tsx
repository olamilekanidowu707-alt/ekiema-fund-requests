import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api, ApiError, clearToken, getToken, setToken } from "../api/client";

export type Role = "STAFF" | "MANAGER" | "ACCOUNTANT" | "ADMIN";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  managerId: string | null;
}

interface AuthResponse extends CurrentUser {
  token: string;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    name: string,
    email: string,
    password: string,
    role: "STAFF" | "MANAGER" | "ACCOUNTANT",
    managerId?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      const me = await api.get<CurrentUser>("/auth/me");
      setUser(me);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        setUser(null);
      } else {
        throw err;
      }
    }
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<AuthResponse>("/auth/login", { email, password });
    setToken(res.token);
    setUser(res);
  }

  async function signup(
    name: string,
    email: string,
    password: string,
    role: "STAFF" | "MANAGER" | "ACCOUNTANT",
    managerId?: string
  ) {
    const res = await api.post<AuthResponse>("/auth/signup", { name, email, password, role, managerId });
    setToken(res.token);
    setUser(res);
  }

  async function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, refreshAccessToken, session } from "./api";
import type { TokenResponse, User } from "./types";

type Status = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: Status;
  user: User | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const signedOut = useCallback(() => {
    session.setToken(null);
    setUser(null);
    setStatus("unauthenticated");
    queryClient.clear(); // never show the previous user's cached data
  }, [queryClient]);

  // On first load, try to restore the session from the refresh cookie.
  useEffect(() => {
    session.onExpired(signedOut);
    refreshAccessToken().then((data) => {
      if (data) {
        setUser(data.user);
        setStatus("authenticated");
      } else {
        setStatus("unauthenticated");
      }
    });
  }, [signedOut]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<TokenResponse>("/auth/login", { method: "POST", json: { email, password } });
    session.setToken(data.access_token);
    setUser(data.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      signedOut();
      router.replace("/login");
    }
  }, [router, signedOut]);

  const value = useMemo(
    () => ({ status, user, isAdmin: user?.role === "admin", login, logout }),
    [status, user, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
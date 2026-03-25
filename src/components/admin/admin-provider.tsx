"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useState
} from "react";

const STORAGE_KEY = "happiness_admin_token";

type AdminContextValue = {
  token: string | null;
  isUnlocked: boolean;
  unlock: (password: string) => Promise<{ ok: boolean; message: string }>;
  logout: () => void;
  requestAuth: <T>(action: () => Promise<T>) => Promise<T | null>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored =
        typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
      startTransition(() => {
        setToken(stored ?? null);
      });
    } catch {
      /* ignore */
    }
  }, []);

  const unlock = useCallback(async (password: string): Promise<{ ok: boolean; message: string }> => {
    const res = await fetch("/api/admin/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const data = (await res.json()) as { ok: boolean; message: string; token?: string };
    if (data.ok && typeof data.token === "string") {
      const t = data.token;
      setToken(t);
      try {
        sessionStorage.setItem(STORAGE_KEY, t);
      } catch {
        /* ignore */
      }
    }
    return { ok: data.ok, message: data.message };
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const requestAuth = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | null> => {
      if (token) {
        return action();
      }
      return null;
    },
    [token]
  );

  const value: AdminContextValue = {
    token,
    isUnlocked: Boolean(token),
    unlock,
    logout,
    requestAuth
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}

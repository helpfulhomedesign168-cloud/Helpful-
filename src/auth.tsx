import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { clearApiCache, setAuthRefreshHandler } from "./api/client";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";
export const LIVE_AUTH = import.meta.env.PROD
  ? import.meta.env.VITE_LIVE_AUTH !== "0"
  : import.meta.env.VITE_LIVE_AUTH === "1";

const STORAGE_KEY = "homeflow-session";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type Session = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  user: AuthUser;
};

interface AuthContextValue {
  live: boolean;
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return parsed?.access_token && parsed?.refresh_token ? parsed : null;
  } catch {
    return null;
  }
}

function writeSession(session: Session | null) {
  if (!session) sessionStorage.removeItem(STORAGE_KEY);
  else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(body?.error?.message || "登入失敗，請再試一次。");
  }
  return body as T;
}

async function fetchMe(accessToken: string): Promise<AuthUser> {
  const response = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("SESSION_EXPIRED");
  return (await response.json()) as AuthUser;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(LIVE_AUTH);
  const refreshTimer = useRef<number | undefined>(undefined);
  const refreshPromise = useRef<Promise<string | null> | null>(null);

  async function refreshAccessToken(): Promise<string | null> {
    if (refreshPromise.current) return refreshPromise.current;
    const current = readSession();
    if (!current) return null;
    refreshPromise.current = (async () => {
      try {
        const refreshed = await api<{
          access_token: string;
          refresh_token: string;
          expires_in: number;
        }>("/auth/refresh", {
          method: "POST",
          body: JSON.stringify({ refresh_token: current.refresh_token }),
        });
        const me = await fetchMe(refreshed.access_token);
        const updated: Session = {
          ...current,
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_in: refreshed.expires_in,
          expires_at: Date.now() + refreshed.expires_in * 1000,
          user: me,
        };
        writeSession(updated);
        setSession(updated);
        setUser(me);
        scheduleRefresh(updated);
        return updated.access_token;
      } catch {
        clearApiCache();
        writeSession(null);
        setSession(null);
        setUser(null);
        return null;
      } finally {
        refreshPromise.current = null;
      }
    })();
    return refreshPromise.current;
  }

  function scheduleRefresh(next: Session) {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    const delay = Math.max(next.expires_at - Date.now() - 60_000, 10_000);
    refreshTimer.current = window.setTimeout(() => {
      void refreshAccessToken();
    }, delay);
  }

  useEffect(() => {
    setAuthRefreshHandler(refreshAccessToken);
    return () => setAuthRefreshHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!LIVE_AUTH) {
      setLoading(false);
      return;
    }
    const stored = readSession();
    if (!stored) {
      setLoading(false);
      return;
    }
    setSession(stored);
    setUser(stored.user);
    fetchMe(stored.access_token)
      .then((fresh) => {
        const updated = { ...stored, user: fresh };
        writeSession(updated);
        setSession(updated);
        setUser(fresh);
        scheduleRefresh(updated);
      })
      .catch(async () => {
        await refreshAccessToken();
      })
      .finally(() => setLoading(false));

    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    const result = await api<Omit<Session, "expires_at">>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const next: Session = {
      ...result,
      expires_at: Date.now() + result.expires_in * 1000,
    };
    clearApiCache();
    writeSession(next);
    setSession(next);
    setUser(next.user);
    scheduleRefresh(next);
  }

  function logout() {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    clearApiCache();
    writeSession(null);
    setSession(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        live: LIVE_AUTH,
        user,
        accessToken: session?.access_token ?? null,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Auth context missing");
  return value;
}

function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "登入失敗，請再試一次。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <img className="auth-logo" src="/company-logo.png" alt="好幫手家居裝修設計有限公司" />
        <p className="auth-eyebrow">好幫手 · 工程營運系統</p>
        <h1>登入</h1>
        <p className="auth-intro">請使用公司帳戶登入。此係 Phase 1 登入測試，登入後會按你的角色顯示工作區。</p>
        <form className="auth-form" onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            密碼
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? "登入中…" : "登入"}
          </button>
        </form>
        <p className="auth-note">未開通帳戶請聯絡 Admin。正式上線前仍使用 staging 資料。</p>
      </div>
    </main>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { live, loading, user } = useAuth();
  if (!live) return <>{children}</>;
  if (loading) {
    return (
      <main className="auth-screen">
        <div className="auth-loading">正在驗證登入…</div>
      </main>
    );
  }
  if (!user) return <LoginScreen />;
  return <>{children}</>;
}

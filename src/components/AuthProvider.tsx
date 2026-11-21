"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { clientAuth, firebaseConfigured } from "@/lib/firebase-client";

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  /** 로그인 토큰을 붙여 강사 API 호출. 실패 시 서버의 한국어 오류 메시지로 throw */
  api: <T = unknown>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);

  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(clientAuth(), (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const signIn = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(clientAuth(), provider);
  }, []);

  const logOut = useCallback(() => signOut(clientAuth()), []);

  const api = useCallback(
    async <T,>(path: string, init?: { method?: string; body?: unknown }): Promise<T> => {
      const u = clientAuth().currentUser;
      if (!u) throw new Error("로그인이 필요합니다.");
      const token = await u.getIdToken();
      let res: Response;
      try {
        res = await fetch(path, {
          method: init?.method ?? "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
          },
          body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
        });
      } catch {
        throw new Error("네트워크 연결을 확인한 뒤 다시 시도하세요.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `요청 실패 (${res.status})`);
      return data as T;
    },
    [],
  );

  const value = useMemo(() => ({ user, loading, signIn, logOut, api }), [user, loading, signIn, logOut, api]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}

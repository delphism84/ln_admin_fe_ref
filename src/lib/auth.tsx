'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from './api';

export type Admin = {
  id: string;
  username: string;
  name: string;
  role: string;
  status: string;
  mustChangePassword: boolean;
  permissions: string[];
  lastLoginAt: string | null;
  lastLoginIp?: string;
  createdAt?: string;
  updatedAt?: string;
};

type AuthCtx = {
  admin: Admin | null;
  loading: boolean;
  /** 권한 확인. 버튼·메뉴 숨김용이며 실제 차단은 서버가 한다. */
  can: (...perms: string[]) => boolean;
  setSession: (token: string, admin: Admin) => void;
  logout: () => void;
};

const Ctx = createContext<AuthCtx>({ admin: null, loading: true, can: () => false, setSession: () => {}, logout: () => {} });

const REFRESH_EVERY_MS = 20 * 60 * 1000;
const ACTIVE_WINDOW_MS = 30 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const lastActivity = useRef(Date.now());

  const logout = useCallback(() => {
    setToken(null);
    setAdmin(null);
    window.location.replace('/login');
  }, []);

  const setSession = useCallback((token: string, a: Admin) => {
    setToken(token);
    setAdmin(a);
  }, []);

  useEffect(() => {
    let alive = true;
    if (!getToken()) {
      setLoading(false);
      window.location.replace('/login');
      return;
    }
    api<{ admin: Admin }>('/me')
      .then((r) => alive && setAdmin(r.admin))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // 사용 중이면 세션을 연장한다(토큰 기본 8시간). 30분 넘게 조작이 없으면 연장하지 않아 자연 만료된다.
  useEffect(() => {
    const mark = () => {
      lastActivity.current = Date.now();
    };
    window.addEventListener('pointerdown', mark);
    window.addEventListener('keydown', mark);
    const timer = window.setInterval(() => {
      if (!getToken() || Date.now() - lastActivity.current > ACTIVE_WINDOW_MS) return;
      api<{ token: string; admin: Admin }>('/refresh', { method: 'POST' })
        .then((r) => {
          setToken(r.token);
          setAdmin(r.admin);
        })
        .catch(() => {});
    }, REFRESH_EVERY_MS);
    return () => {
      window.removeEventListener('pointerdown', mark);
      window.removeEventListener('keydown', mark);
      window.clearInterval(timer);
    };
  }, []);

  const value = useMemo<AuthCtx>(() => {
    const set = new Set(admin?.permissions || []);
    return { admin, loading, can: (...perms) => perms.every((p) => set.has(p)), setSession, logout };
  }, [admin, loading, setSession, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}

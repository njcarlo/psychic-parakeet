import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, clearToken, getToken, setToken } from '../lib/api';
import type { AuthUser } from '../lib/types';

type LoginInput = {
  email: string;
  password: string;
};

type RegisterInput = {
  businessName: string;
  ownerName?: string;
  email: string;
  phone?: string;
  password: string;
  timezone: string;
  jurisdictionCode?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeUser(user: AuthUser): AuthUser {
  return {
    ...user,
    businessId: user.businessId ?? user.business_id ?? ''
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get<{ user: AuthUser }>('/auth/me');
      setUser(normalizeUser(response.user));
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (input: LoginInput) => {
    const response = await api.post<{ token: string; user: AuthUser }>('/auth/login', input);
    setToken(response.token);
    setUser(normalizeUser(response.user));
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const response = await api.post<{
      token: string;
      user: AuthUser;
      business?: { name?: string };
    }>('/auth/register', input);
    setToken(response.token);
    setUser(normalizeUser({ ...response.user, businessName: response.business?.name }));
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [loading, login, logout, refresh, register, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

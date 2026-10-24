'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Permission, User } from '@/lib/types';

interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string, remember?: boolean) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Where each role lands after signing in. */
export function homeFor(user: Pick<User, 'role'> | null): string {
  if (!user) return '/login';
  if (user.role === 'admin') return '/admin';
  if (user.role === 'team_member') return '/team';
  return '/dashboard';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ data: User }>('/auth/user');
      setUser(res.data);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 419)) {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = async (email: string, password: string, remember = false) => {
    const res = await api.post<{ data: User }>('/auth/login', { email, password, remember });
    setUser(res.data);
    return res.data;
  };

  const register = async (input: RegisterInput) => {
    const res = await api.post<{ data: User }>('/auth/register', input);
    setUser(res.data);
    return res.data;
  };

  const signOut = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      window.location.href = '/';
    }
  };

  const can = (permission: Permission) => !!user?.permissions.includes(permission);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, register, signOut, refresh, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

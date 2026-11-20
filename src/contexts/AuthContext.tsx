import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { apiClient } from '@/lib/apiClient';
import { sensorService } from '@/services';

// ---- Types (preserved exactly) ----

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'patient' | 'caregiver' | 'clinician';
  createdAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, role: AuthUser['role']) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

// ---- Showcase & Registered Users ----

const DEMO_USERS: Record<string, { password: string; user: AuthUser }> = {
  'demo@neuroglove.app': {
    password: 'Demo1234!',
    user: {
      id: 'demo-patient-001',
      name: 'Rajesh Kumar Sharma (Showcase)',
      email: 'demo@neuroglove.app',
      role: 'patient',
      createdAt: '2026-01-15T08:00:00Z',
    },
  },
  'caregiver@neuroglove.app': {
    password: 'Demo1234!',
    user: {
      id: 'demo-caregiver-001',
      name: 'Dr. Priya Mehta (Caregiver)',
      email: 'caregiver@neuroglove.app',
      role: 'caregiver',
      createdAt: '2026-01-15T08:00:00Z',
    },
  },
};

const STORAGE_KEY = 'neuroglove_auth_user';
const USERS_STORAGE_KEY = 'neuroglove_registered_users';
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function getStoredUsers(): Record<string, { password: string; user: AuthUser }> {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredUser(email: string, password: string, user: AuthUser) {
  try {
    const users = getStoredUsers();
    users[email.toLowerCase().trim()] = { password, user };
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save registered user', e);
  }
}

// ---- Context ----

const AuthContext = createContext<AuthContextValue | null>(null);

function supabaseUserToAuthUser(supabaseUser: { id: string; email?: string; user_metadata?: Record<string, string> }, profile?: { full_name?: string; role?: string } | null): AuthUser {
  const role = (profile?.role as AuthUser['role']) || 'patient';
  return {
    id: supabaseUser.id,
    name: profile?.full_name || supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'User',
    email: supabaseUser.email || '',
    role,
    createdAt: new Date().toISOString(),
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSupabaseConfigured = supabase !== null;

  // ---- Restore session on mount ----
  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Demo mode: restore from sessionStorage
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: AuthUser = JSON.parse(stored);
          setUser(parsed);
        }
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Supabase mode
    supabase!.auth.getSession().then(({ data }: any) => {
      const session = data?.session;
      if (session?.user) {
        // Fetch profile from backend
        apiClient.setAuthToken(session.access_token);
        apiClient.get<{ profile?: { full_name?: string; role?: string } }>('/api/auth/me')
          .then(res => {
            const authUser = supabaseUserToAuthUser(session.user, res.data?.profile);
            setUser(authUser);
          })
          .catch(() => {
            const authUser = supabaseUserToAuthUser(session.user, null);
            setUser(authUser);
          })
          .finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase!.auth.onAuthStateChange(async (_event: any, session: any) => {
      if (session?.user) {
        apiClient.setAuthToken(session.access_token);
        try {
          const res = await apiClient.get<{ profile?: { full_name?: string; role?: string } }>('/api/auth/me');
          const authUser = supabaseUserToAuthUser(session.user, res.data?.profile);
          setUser(authUser);
        } catch {
          const authUser = supabaseUserToAuthUser(session.user, null);
          setUser(authUser);
        }
      } else {
        apiClient.setAuthToken(null);
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [isSupabaseConfigured]);

  // ---- Login ----
  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);

    try {
      if (!isSupabaseConfigured) {
        await delay(500);
        const cleanEmail = email.toLowerCase().trim();

        // 1. Check showcase demo accounts
        const match = DEMO_USERS[cleanEmail];
        if (match && match.password === password) {
          sensorService.reset();
          setUser(match.user);
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(match.user));
          return;
        }

        // 2. Check newly registered user accounts
        const registeredUsers = getStoredUsers();
        const regMatch = registeredUsers[cleanEmail];
        if (regMatch && regMatch.password === password) {
          sensorService.reset();
          setUser(regMatch.user);
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(regMatch.user));
          return;
        }

        throw new Error('Invalid email or password. Use demo@neuroglove.app to showcase the app, or create a new account.');
      }

      // Supabase login
      const { data, error: authError } = await supabase!.auth.signInWithPassword({ email, password });
      if (authError) throw new Error(authError.message);
      if (!data.user) throw new Error('Login failed — no user returned');

      sensorService.reset();
      apiClient.setAuthToken(data.session?.access_token || null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isSupabaseConfigured]);

  // ---- Signup ----
  const signup = useCallback(async (
    name: string,
    email: string,
    password: string,
    role: AuthUser['role']
  ) => {
    setError(null);
    setIsLoading(true);

    try {
      if (!isSupabaseConfigured) {
        await delay(600);
        const cleanEmail = email.toLowerCase().trim();
        const registeredUsers = getStoredUsers();

        if (cleanEmail === 'demo@neuroglove.app' || registeredUsers[cleanEmail]) {
          throw new Error('An account with this email address already exists.');
        }

        const newUser: AuthUser = {
          id: `user-${Date.now()}`,
          name: name.trim(),
          email: cleanEmail,
          role,
          createdAt: new Date().toISOString(),
        };

        saveStoredUser(cleanEmail, password, newUser);
        sensorService.reset();
        setUser(newUser);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
        return;
      }

      // Supabase signup
      const { data, error: authError } = await supabase!.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, role },
        },
      });

      if (authError) throw new Error(authError.message);
      if (!data.user) throw new Error('Sign up failed — no user returned');

      sensorService.reset();

      // Profile is auto-created by DB trigger, but also try to upsert via API
      if (data.session) {
        apiClient.setAuthToken(data.session.access_token);
        try {
          await apiClient.put('/api/auth/profile', { full_name: name, role });
        } catch {
          // Non-fatal — trigger already created profile
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed. Please try again.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isSupabaseConfigured]);

  // ---- Logout ----
  const logout = useCallback(() => {
    sensorService.reset();
    setUser(null);
    setError(null);
    apiClient.setAuthToken(null);

    if (isSupabaseConfigured) {
      supabase!.auth.signOut();
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [isSupabaseConfigured]);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, signup, logout, error, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

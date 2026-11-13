import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// ---- Types ----

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

// ---- Demo credentials ----

const DEMO_USERS: Record<string, { password: string; user: AuthUser }> = {
  'demo@neuroglove.app': {
    password: 'Demo1234!',
    user: {
      id: 'demo-patient-001',
      name: 'Demo User',
      email: 'demo@neuroglove.app',
      role: 'patient',
      createdAt: '2026-01-15T08:00:00Z',
    },
  },
  'caregiver@neuroglove.app': {
    password: 'Demo1234!',
    user: {
      id: 'demo-caregiver-001',
      name: 'Demo Caregiver',
      email: 'caregiver@neuroglove.app',
      role: 'caregiver',
      createdAt: '2026-01-15T08:00:00Z',
    },
  },
};

const STORAGE_KEY = 'neuroglove_auth_user';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ---- Context ----

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session from sessionStorage on mount
  useEffect(() => {
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
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await delay(800); // simulate network
      const match = DEMO_USERS[email.toLowerCase().trim()];
      if (!match || match.password !== password) {
        throw new Error('Invalid email or password. Try demo@neuroglove.app / Demo1234!');
      }
      setUser(match.user);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(match.user));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signup = useCallback(async (
    name: string,
    email: string,
    _password: string,
    role: AuthUser['role']
  ) => {
    setError(null);
    setIsLoading(true);
    try {
      await delay(1000); // simulate network
      // In demo mode, create a session user from the provided details
      const newUser: AuthUser = {
        id: `user-${Date.now()}`,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role,
        createdAt: new Date().toISOString(),
      };
      setUser(newUser);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setError(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

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

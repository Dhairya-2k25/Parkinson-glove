/**
 * NeuroGlove Supabase Browser Client
 * 
 * Provides Supabase Auth client using standard fetch to Supabase Auth v1 REST API.
 * Does not require external dependencies and works seamlessly in all environments.
 * When VITE_SUPABASE_URL is not set, gracefully falls back so demo mode works.
 */

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string || '';
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string || '';

const STORAGE_SESSION_KEY = 'neuroglove_sb_session';

export interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
}

export interface SupabaseSession {
  access_token: string;
  refresh_token?: string;
  user: SupabaseUser;
}

export interface AuthResponse {
  data: {
    user: SupabaseUser | null;
    session: SupabaseSession | null;
  };
  error: { message: string } | null;
}

type AuthStateChangeCallback = (event: 'SIGNED_IN' | 'SIGNED_OUT' | 'INITIAL_SESSION', session: SupabaseSession | null) => void;

class SupabaseAuthClient {
  private url: string;
  private key: string;
  private listeners: Set<AuthStateChangeCallback> = new Set();
  private currentSession: SupabaseSession | null = null;

  constructor(url: string, key: string) {
    this.url = url.replace(/\/$/, '');
    this.key = key;

    // Restore cached session
    try {
      const stored = localStorage.getItem(STORAGE_SESSION_KEY);
      if (stored) {
        this.currentSession = JSON.parse(stored);
      }
    } catch {
      // Ignore storage errors
    }
  }

  private notify(event: 'SIGNED_IN' | 'SIGNED_OUT' | 'INITIAL_SESSION', session: SupabaseSession | null) {
    this.currentSession = session;
    if (session) {
      try {
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
      } catch {}
    } else {
      try {
        localStorage.removeItem(STORAGE_SESSION_KEY);
      } catch {}
    }
    this.listeners.forEach(cb => {
      try {
        cb(event, session);
      } catch (err) {
        console.error('[Supabase Auth Listener Error]', err);
      }
    });
  }

  async getSession(): Promise<{ data: { session: SupabaseSession | null } }> {
    return { data: { session: this.currentSession } };
  }

  onAuthStateChange(callback: AuthStateChangeCallback): { data: { subscription: { unsubscribe: () => void } } } {
    this.listeners.add(callback);
    // Trigger initial notification
    setTimeout(() => {
      try {
        callback('INITIAL_SESSION', this.currentSession);
      } catch {}
    }, 0);

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners.delete(callback);
          },
        },
      },
    };
  }

  async signInWithPassword({ email, password }: { email: string; password: string }): Promise<AuthResponse> {
    if (!this.url || !this.key) {
      return { data: { user: null, session: null }, error: { message: 'Supabase URL/Key not configured' } };
    }

    try {
      const res = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.key,
        },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();
      if (!res.ok) {
        return { data: { user: null, session: null }, error: { message: json.error_description || json.msg || json.message || 'Login failed' } };
      }

      const session: SupabaseSession = {
        access_token: json.access_token,
        refresh_token: json.refresh_token,
        user: json.user,
      };

      this.notify('SIGNED_IN', session);
      return { data: { user: session.user, session }, error: null };
    } catch (err: any) {
      return { data: { user: null, session: null }, error: { message: err?.message || 'Network error during login' } };
    }
  }

  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, any> } }): Promise<AuthResponse> {
    if (!this.url || !this.key) {
      return { data: { user: null, session: null }, error: { message: 'Supabase URL/Key not configured' } };
    }

    try {
      const res = await fetch(`${this.url}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.key,
        },
        body: JSON.stringify({
          email,
          password,
          data: options?.data || {},
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        return { data: { user: null, session: null }, error: { message: json.error_description || json.msg || json.message || 'Sign up failed' } };
      }

      const session: SupabaseSession | null = json.access_token
        ? {
            access_token: json.access_token,
            refresh_token: json.refresh_token,
            user: json.user,
          }
        : null;

      if (session) {
        this.notify('SIGNED_IN', session);
      }

      return { data: { user: json.user || null, session }, error: null };
    } catch (err: any) {
      return { data: { user: null, session: null }, error: { message: err?.message || 'Network error during sign up' } };
    }
  }

  async signOut(): Promise<{ error: null }> {
    if (this.currentSession?.access_token && this.url && this.key) {
      try {
        await fetch(`${this.url}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': this.key,
            'Authorization': `Bearer ${this.currentSession.access_token}`,
          },
        });
      } catch {
        // Sign out locally regardless
      }
    }

    this.notify('SIGNED_OUT', null);
    return { error: null };
  }
}

export class SupabaseClient {
  auth: SupabaseAuthClient;

  constructor(url: string, key: string) {
    this.auth = new SupabaseAuthClient(url, key);
  }
}

export function createClient(url: string, key: string): SupabaseClient {
  return new SupabaseClient(url, key);
}

export const supabase: SupabaseClient | null = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

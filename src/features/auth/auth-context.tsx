/**
 * Session state for the whole app.
 *
 * On mount: purge stale keychain material from a previous install, read the
 * persisted session once, then subscribe to Supabase auth changes. The session
 * is kept in memory here; persistence/refresh is handled by the Supabase client
 * (see lib/supabase.ts). `isLoading` is true only until the first read resolves,
 * so the root layout can hold the splash screen until we know where to route.
 */

import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ensureFreshInstallPurge, registerAuthAutoRefresh, supabase } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  userId: string | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      await ensureFreshInstallPurge();
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      setIsLoading(false);
      registerAuthAutoRefresh();
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, userId: session?.user.id ?? null, isLoading }),
    [session, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

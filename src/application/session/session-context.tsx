import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ok, type Result } from '@/domain/result';
import type { Session } from '@/domain/session';
import { login, type ApiFailure, type LoginCredentials } from '@/infrastructure/api';
import { clearSession, readSession, writeSession } from '@/infrastructure/storage/session-storage';
import { clearTokens, writeTokens } from '@/infrastructure/storage/token-storage';

interface SessionContextValue {
  session: Session | null;
  isRestoring: boolean;
  signIn: (credentials: LoginCredentials) => Promise<Result<void, ApiFailure>>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Restores the session from secure storage on mount so it survives a restart.
 * `isRestoring` keeps the guard from bouncing a signed-in person to the login
 * screen while that read is in flight.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    let active = true;

    readSession()
      .then((stored) => {
        if (active) {
          setSession(stored);
        }
      })
      .finally(() => {
        if (active) {
          setIsRestoring(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (credentials: LoginCredentials) => {
    const result = await login(credentials);
    if (!result.ok) {
      return result;
    }

    await writeTokens(result.value.tokens);
    await writeSession(result.value.user);
    setSession(result.value.user);
    return ok(undefined);
  }, []);

  const signOut = useCallback(async () => {
    await clearTokens();
    await clearSession();
    setSession(null);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ session, isRestoring, signIn, signOut }),
    [session, isRestoring, signIn, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error('useSession precisa estar dentro de SessionProvider.');
  }
  return value;
}

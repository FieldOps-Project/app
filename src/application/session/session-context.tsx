import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ok, type Result } from '@/domain/result';
import type { Session } from '@/domain/session';
import {
  login,
  logout,
  onSessionRejected,
  type ApiFailure,
  type LoginCredentials,
} from '@/infrastructure/api';
import { clearSession, readSession, writeSession } from '@/infrastructure/storage/session-storage';
import { clearTokens, readTokens, writeTokens } from '@/infrastructure/storage/token-storage';

interface SessionContextValue {
  session: Session | null;
  isRestoring: boolean;
  sessionExpired: boolean;
  signIn: (credentials: LoginCredentials) => Promise<Result<void, ApiFailure>>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    let active = true;

    restoreSession()
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

  useEffect(
    () =>
      onSessionRejected(() => {
        setSession(null);
        setSessionExpired(true);
        queryClient.clear();
        clearSession().catch(() => undefined);
      }),
    [queryClient]
  );

  const signIn = useCallback(async (credentials: LoginCredentials) => {
    const result = await login(credentials);
    if (!result.ok) {
      return result;
    }

    await writeTokens(result.value.tokens);
    await writeSession(result.value.user);
    setSessionExpired(false);
    setSession(result.value.user);
    return ok(undefined);
  }, []);

  const signOut = useCallback(async () => {
    const tokens = await readTokens();

    await clearTokens();
    await clearSession();
    setSessionExpired(false);
    setSession(null);
    queryClient.clear();

    if (tokens !== null) {
      void logout(tokens.refreshToken);
    }
  }, [queryClient]);

  const value = useMemo<SessionContextValue>(
    () => ({ session, isRestoring, sessionExpired, signIn, signOut }),
    [session, isRestoring, sessionExpired, signIn, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

async function restoreSession(): Promise<Session | null> {
  const [stored, tokens] = await Promise.all([readSession(), readTokens()]);
  if (stored !== null && tokens === null) {
    await clearSession();
    return null;
  }
  return stored;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error('useSession precisa estar dentro de SessionProvider.');
  }
  return value;
}

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
  /**
   * True after the server refused to renew the session (expired refresh token,
   * or the user was blocked — RN-008). Lets the login screen say why the person
   * is back there. Cleared by the next sign-in.
   */
  sessionExpired: boolean;
  signIn: (credentials: LoginCredentials) => Promise<Result<void, ApiFailure>>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Restores the session from secure storage on mount so it survives a restart.
 * `isRestoring` keeps the guard from bouncing a signed-in person to the login
 * screen while that read is in flight.
 *
 * Whenever the session ends, the in-memory query cache goes with it, so the
 * next person to sign in on the same device never sees the previous one's
 * server data. That cache is only a copy of the API: work recorded on the
 * device lives elsewhere and is never touched here (RN-066).
 */
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

  /**
   * The HTTP layer clears the tokens itself when the server refuses to renew
   * them; what remains is the profile, the cache and the screen, which are ours.
   */
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

  /**
   * Signing out always works, with or without a connection: the local
   * credentials go first and the person is out at once. Revoking the refresh
   * token on the API is then attempted on a best-effort basis (card #7) — if it
   * cannot be reached the token stays valid server-side until it expires, which
   * is the price of never trapping someone in a session they asked to leave.
   * The revocation is not awaited, so a slow network never holds the person on
   * the screen they are leaving.
   *
   * Only credentials are dropped. Nothing recorded on the device is touched.
   */
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

/**
 * A stored profile without its tokens cannot be a working session: every
 * request would be refused with no way to renew. Treat it as signed out and
 * tidy the leftover, rather than showing protected screens that cannot load.
 */
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

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { Session, SessionRole } from '@/domain/session';
import { clearSession, readSession, writeSession } from '@/infrastructure/storage/session-storage';

interface SessionContextValue {
  /** Current session, or `null` when signed out. */
  session: Session | null;
  /** True while the stored session is being read on start-up. */
  isRestoring: boolean;
  /** Starts a session for the given role. */
  signIn: (role: SessionRole) => Promise<void>;
  /** Ends the session and clears secure storage. */
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Simulated sign-in used while EP-02 is not delivered.
 *
 * Only this function is replaced by the real authentication: the context, the
 * route guard and every screen keep working against the same `Session` type.
 */
function simulateSignIn(role: SessionRole): Session {
  return {
    userId: role === 'supervisor' ? 'sup-001' : 'tec-001',
    name: role === 'supervisor' ? 'Marina Duarte' : 'Rafael Nogueira',
    role,
  };
}

/**
 * Provides the session to the whole route tree.
 *
 * The session is restored from secure storage on mount so it survives an app
 * restart. While that read is in flight `isRestoring` stays true, which keeps
 * the guard from bouncing an already signed-in person to the login screen.
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

  const signIn = useCallback(async (role: SessionRole) => {
    const next = simulateSignIn(role);
    await writeSession(next);
    setSession(next);
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setSession(null);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ session, isRestoring, signIn, signOut }),
    [session, isRestoring, signIn, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/**
 * Reads the session context.
 *
 * @throws When called outside {@link SessionProvider}.
 */
export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error('useSession precisa estar dentro de SessionProvider.');
  }
  return value;
}

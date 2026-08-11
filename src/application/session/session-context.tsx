import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { Session, SessionRole } from '@/domain/session';
import { clearSession, readSession, writeSession } from '@/infrastructure/storage/session-storage';

interface SessionContextValue {
  session: Session | null;
  isRestoring: boolean;
  signIn: (role: SessionRole) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** Only this is replaced by the real authentication in EP-02. */
function simulateSignIn(role: SessionRole): Session {
  return {
    userId: role === 'supervisor' ? 'sup-001' : 'tec-001',
    name: role === 'supervisor' ? 'Marina Duarte' : 'Rafael Nogueira',
    role,
  };
}

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

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error('useSession precisa estar dentro de SessionProvider.');
  }
  return value;
}

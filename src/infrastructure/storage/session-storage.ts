import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';

import type { Session } from '@/domain/session';

const SESSION_KEY = 'fieldops.session';

const sessionSchema = z.object({
  userId: z.string().min(1),
  name: z.string(),
  email: z.string(),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'TECHNICIAN', 'CLIENT_VIEWER']),
});

export async function readSession(): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (raw === null) {
      return null;
    }
    const parsed = sessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function writeSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

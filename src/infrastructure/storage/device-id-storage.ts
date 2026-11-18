import * as SecureStore from 'expo-secure-store';

import { newId } from '@/infrastructure/ids';

const DEVICE_ID_KEY = 'fieldops.device-id';

let cached: Promise<string> | null = null;

async function readOrCreate(): Promise<string> {
  const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (stored !== null && stored !== '') {
    return stored;
  }
  const created = newId();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, created);
  return created;
}

export function getDeviceId(): Promise<string> {
  cached ??= readOrCreate().catch((error: unknown) => {
    cached = null;
    throw error;
  });
  return cached;
}

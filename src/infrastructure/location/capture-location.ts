import * as Location from 'expo-location';

import { isValidCoordinate, type LocationCapture } from '@/domain/field-location';

export const LOCATION_TIMEOUT_MS = 15_000;

export type LocationPermissionState = 'granted' | 'undetermined' | 'denied' | 'blocked';

export async function readLocationPermission(): Promise<LocationPermissionState> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.granted) {
      return 'granted';
    }
    if (permission.status === Location.PermissionStatus.UNDETERMINED) {
      return 'undetermined';
    }
    return permission.canAskAgain ? 'denied' : 'blocked';
  } catch {
    return 'undetermined';
  }
}

class CaptureTimeout extends Error {}

function withTimeout<TValue>(promise: Promise<TValue>, milliseconds: number): Promise<TValue> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new CaptureTimeout()), milliseconds);
  });
  return Promise.race([promise, expired]).finally(() => clearTimeout(timer));
}

export async function captureLocation(
  timeoutMs: number = LOCATION_TIMEOUT_MS,
  now: () => string = () => new Date().toISOString()
): Promise<LocationCapture> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      return { status: 'missing', reason: 'PERMISSION_DENIED' };
    }
    if (!(await Location.hasServicesEnabledAsync())) {
      return { status: 'missing', reason: 'SERVICES_DISABLED' };
    }

    const reading = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      timeoutMs
    );
    const { latitude, longitude, accuracy } = reading.coords;
    if (!isValidCoordinate(latitude, longitude)) {
      return { status: 'missing', reason: 'UNAVAILABLE' };
    }
    return {
      status: 'captured',
      position: {
        latitude,
        longitude,
        accuracy: typeof accuracy === 'number' && Number.isFinite(accuracy) ? accuracy : null,
        capturedAt: Number.isFinite(reading.timestamp)
          ? new Date(reading.timestamp).toISOString()
          : now(),
      },
    };
  } catch (error) {
    return {
      status: 'missing',
      reason: error instanceof CaptureTimeout ? 'TIMEOUT' : 'UNAVAILABLE',
    };
  }
}

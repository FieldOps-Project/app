import * as Location from 'expo-location';

import {
  captureLocation,
  readLocationPermission,
} from '@/infrastructure/location/capture-location';

jest.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted', UNDETERMINED: 'undetermined', DENIED: 'denied' },
  Accuracy: { High: 4 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

const mocked = jest.mocked(Location);
const FIX_AT = Date.parse('2026-08-12T13:00:05Z');

function permission(granted: boolean, extra: Partial<Location.LocationPermissionResponse> = {}) {
  return {
    granted,
    status: granted ? 'granted' : 'denied',
    canAskAgain: true,
    expires: 'never',
    ...extra,
  } as Location.LocationPermissionResponse;
}

function reading(latitude: number, longitude: number, accuracy: number | null) {
  return {
    coords: {
      latitude,
      longitude,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: FIX_AT,
  } as Location.LocationObject;
}

beforeEach(() => {
  jest.resetAllMocks();
  mocked.requestForegroundPermissionsAsync.mockResolvedValue(permission(true));
  mocked.hasServicesEnabledAsync.mockResolvedValue(true);
});

describe('captureLocation', () => {
  it('reads latitude, longitude, accuracy and the moment of the fix once (RN-062)', async () => {
    mocked.getCurrentPositionAsync.mockResolvedValue(reading(-23.5012, -47.4531, 18.4));

    await expect(captureLocation()).resolves.toEqual({
      status: 'captured',
      position: {
        latitude: -23.5012,
        longitude: -47.4531,
        accuracy: 18.4,
        capturedAt: '2026-08-12T13:00:05.000Z',
      },
    });
    expect(mocked.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
    expect(mocked.watchPositionAsync).not.toHaveBeenCalled();
  });

  it('keeps poor accuracy as information, not as an error', async () => {
    mocked.getCurrentPositionAsync.mockResolvedValue(reading(-23.5, -47.4, 1500));

    const capture = await captureLocation();
    expect(capture.status === 'captured' && capture.position.accuracy).toBe(1500);
  });

  it('goes on without a position when the permission is refused', async () => {
    mocked.requestForegroundPermissionsAsync.mockResolvedValue(permission(false));

    await expect(captureLocation()).resolves.toEqual({
      status: 'missing',
      reason: 'PERMISSION_DENIED',
    });
    expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('reports the device location turned off', async () => {
    mocked.hasServicesEnabledAsync.mockResolvedValue(false);

    await expect(captureLocation()).resolves.toEqual({
      status: 'missing',
      reason: 'SERVICES_DISABLED',
    });
  });

  it('gives up after the time limit instead of hanging the screen', async () => {
    jest.useFakeTimers();
    mocked.getCurrentPositionAsync.mockReturnValue(new Promise(() => undefined));

    const pending = captureLocation(15_000);
    await jest.advanceTimersByTimeAsync(15_000);

    await expect(pending).resolves.toEqual({ status: 'missing', reason: 'TIMEOUT' });
    jest.useRealTimers();
  });

  it('turns a failure of the native module into a missing position, never a crash', async () => {
    mocked.getCurrentPositionAsync.mockRejectedValue(new Error('Location provider unavailable'));

    await expect(captureLocation()).resolves.toEqual({ status: 'missing', reason: 'UNAVAILABLE' });
  });

  it('never accepts a coordinate outside the valid range', async () => {
    mocked.getCurrentPositionAsync.mockResolvedValue(reading(123, -47.4, 5));

    await expect(captureLocation()).resolves.toEqual({ status: 'missing', reason: 'UNAVAILABLE' });
  });
});

describe('readLocationPermission', () => {
  it('reads the permission without asking for it', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValue(
      permission(false, { status: 'undetermined' as Location.PermissionStatus })
    );

    await expect(readLocationPermission()).resolves.toBe('undetermined');
    expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('tells a refusal the system will not ask again apart from one it will', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValueOnce(permission(false));
    await expect(readLocationPermission()).resolves.toBe('denied');

    mocked.getForegroundPermissionsAsync.mockResolvedValueOnce(
      permission(false, { canAskAgain: false })
    );
    await expect(readLocationPermission()).resolves.toBe('blocked');
  });
});

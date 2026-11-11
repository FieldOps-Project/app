import { useEffect, useState } from 'react';

import {
  readLocationPermission,
  type LocationPermissionState,
} from '@/infrastructure/location/capture-location';

export function useLocationPermission(): LocationPermissionState | null {
  const [state, setState] = useState<LocationPermissionState | null>(null);

  useEffect(() => {
    let active = true;
    void readLocationPermission().then((permission) => {
      if (active) {
        setState(permission);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return state;
}

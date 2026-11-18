import { useEffect, useRef } from 'react';

import { useConnectivity } from '@/application/connectivity/connectivity-context';
import { useOwnerUserId } from '@/application/inspections/use-inspections';
import { useSynchronize } from '@/application/sync/use-synchronization';
import { RECONNECT_STABLE_MS } from '@/domain/connectivity';

export function AutoSync(): null {
  const { offline } = useConnectivity();
  const ownerUserId = useOwnerUserId();
  const { mutate } = useSynchronize();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (offline) {
      wasOffline.current = true;
      return;
    }
    if (!wasOffline.current || ownerUserId === '') {
      return;
    }
    const timer = setTimeout(() => {
      wasOffline.current = false;
      mutate();
    }, RECONNECT_STABLE_MS);
    return () => clearTimeout(timer);
  }, [offline, ownerUserId, mutate]);

  return null;
}

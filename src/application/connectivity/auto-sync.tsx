import { useEffect, useRef } from 'react';

import { useConnectivity } from '@/application/connectivity/connectivity-context';
import { useOwnerUserId } from '@/application/inspections/use-inspections';
import { useSynchronize } from '@/application/sync/use-synchronization';
import { RECONNECT_STABLE_MS, SERVER_RETRY_MS } from '@/domain/connectivity';

export function AutoSync(): null {
  const { offline, reason } = useConnectivity();
  const ownerUserId = useOwnerUserId();
  const { mutate } = useSynchronize();
  const lostNetwork = useRef(false);

  useEffect(() => {
    if (ownerUserId === '') {
      lostNetwork.current = false;
      return;
    }
    if (offline) {
      lostNetwork.current ||= reason === 'no-network';
      return;
    }
    if (!lostNetwork.current) {
      return;
    }
    const timer = setTimeout(() => {
      lostNetwork.current = false;
      mutate();
    }, RECONNECT_STABLE_MS);
    return () => clearTimeout(timer);
  }, [offline, reason, ownerUserId, mutate]);

  useEffect(() => {
    if (ownerUserId === '' || reason !== 'server-unreachable') {
      return;
    }
    const timer = setInterval(() => mutate(), SERVER_RETRY_MS);
    return () => clearInterval(timer);
  }, [reason, ownerUserId, mutate]);

  return null;
}

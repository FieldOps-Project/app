import { useCallback, useEffect, useRef } from 'react';

import { useConnectivity } from '@/application/connectivity/connectivity-context';
import {
  useOwnerUserId,
  usePendingOperationsCount,
} from '@/application/inspections/use-inspections';
import { useSynchronize } from '@/application/sync/use-synchronization';
import { ENQUEUE_SYNC_DELAY_MS, RECONNECT_STABLE_MS, SERVER_RETRY_MS } from '@/domain/connectivity';

export function AutoSync(): null {
  const { offline, reason } = useConnectivity();
  const ownerUserId = useOwnerUserId();
  const pending = usePendingOperationsCount();
  const { mutate, isPending } = useSynchronize();
  const lostNetwork = useRef(false);
  const previousCount = useRef<number | undefined>(undefined);
  const enqueuePending = useRef(false);
  const enqueueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = pending.data;

  const clearEnqueueTimer = useCallback(() => {
    if (enqueueTimer.current !== null) {
      clearTimeout(enqueueTimer.current);
      enqueueTimer.current = null;
    }
  }, []);

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

  useEffect(() => {
    const previous = previousCount.current;
    previousCount.current = ownerUserId === '' ? undefined : count;
    clearEnqueueTimer();

    if (ownerUserId === '' || offline) {
      enqueuePending.current = false;
      return;
    }
    if (previous !== undefined && count !== undefined && count > previous) {
      enqueuePending.current = true;
    }
    if (!enqueuePending.current || isPending) {
      return;
    }
    enqueueTimer.current = setTimeout(() => {
      enqueuePending.current = false;
      enqueueTimer.current = null;
      mutate();
    }, ENQUEUE_SYNC_DELAY_MS);
  }, [count, ownerUserId, offline, isPending, mutate, clearEnqueueTimer]);

  useEffect(() => clearEnqueueTimer, [clearEnqueueTimer]);

  return null;
}

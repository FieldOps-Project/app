import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  toConnectionState,
  toNetworkStatus,
  type ConnectionState,
  type NetworkStatus,
} from '@/domain/connectivity';
import { subscribeToNetwork } from '@/infrastructure/network/network-status';

export interface ConnectivityValue extends ConnectionState {
  reportApiReachable: (reachable: boolean) => void;
}

const ONLINE: ConnectivityValue = {
  offline: false,
  reason: null,
  reportApiReachable: () => undefined,
};

const ConnectivityContext = createContext<ConnectivityValue>(ONLINE);

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [network, setNetwork] = useState<NetworkStatus>('online');
  const [apiReachable, setApiReachable] = useState(true);
  const lastNetwork = useRef<NetworkStatus>('online');

  useEffect(
    () =>
      subscribeToNetwork((snapshot) => {
        const next = toNetworkStatus(snapshot);
        setNetwork(next);
        if (next !== lastNetwork.current) {
          lastNetwork.current = next;
          setApiReachable(true);
        }
      }),
    []
  );

  const reportApiReachable = useCallback((reachable: boolean) => setApiReachable(reachable), []);

  const value = useMemo<ConnectivityValue>(
    () => ({ ...toConnectionState(network, apiReachable), reportApiReachable }),
    [network, apiReachable, reportApiReachable]
  );

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity(): ConnectivityValue {
  return useContext(ConnectivityContext);
}

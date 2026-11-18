import NetInfo from '@react-native-community/netinfo';

import type { NetworkSnapshot } from '@/domain/connectivity';

export function subscribeToNetwork(listener: (snapshot: NetworkSnapshot) => void): () => void {
  return NetInfo.addEventListener((state) =>
    listener({ isConnected: state.isConnected, isInternetReachable: state.isInternetReachable })
  );
}

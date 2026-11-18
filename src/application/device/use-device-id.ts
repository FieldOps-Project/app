import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/infrastructure/api';
import { getDeviceId } from '@/infrastructure/storage/device-id-storage';

export function useDeviceId() {
  return useQuery<string, Error>({
    queryKey: queryKeys.device.id(),
    queryFn: getDeviceId,
    staleTime: Infinity,
    retry: 1,
  });
}

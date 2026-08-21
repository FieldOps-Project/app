import { useQuery } from '@tanstack/react-query';

import { queryKeys, request, type ApiFailure } from '@/infrastructure/api';

/** Response body of the Spring Boot Actuator health endpoint. */
interface HealthResponse {
  status?: string;
}

/**
 * Checks whether the device can actually reach the API.
 *
 * On a local network the usual setup mistake is `EXPO_PUBLIC_API_URL` pointing
 * at an address the device cannot resolve — `localhost` inside an emulator, or
 * the dev machine's IP after it changes networks. A `network` failure here means
 * exactly that: unreachable, not "the API is broken". Typing the error channel
 * as `ApiFailure` lets the screen branch on the failure without any casting.
 *
 * @returns The TanStack Query result for the health check.
 */
export function useApiHealth() {
  return useQuery<HealthResponse, ApiFailure>({
    queryKey: queryKeys.health(),
    queryFn: async () => {
      const result = await request<HealthResponse>({ path: '/actuator/health' });
      if (!result.ok) {
        throw result.error;
      }
      return result.value;
    },
    retry: 0,
  });
}

import { useQuery } from '@tanstack/react-query';

import { request } from '@/infrastructure/api/http-client';

/** Response body of the Spring Boot Actuator health endpoint. */
interface HealthResponse {
  status?: string;
}

/**
 * Queries the API health endpoint to check whether the device can reach it.
 *
 * On a local network the most common setup mistake is `EXPO_PUBLIC_API_URL`
 * pointing at an address the device cannot resolve, such as `localhost` inside
 * an emulator.
 *
 * @returns The TanStack Query result for the health check.
 */
export function useApiHealth() {
  return useQuery({
    queryKey: ['api', 'health'],
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

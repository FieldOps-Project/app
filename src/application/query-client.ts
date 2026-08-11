import { QueryClient } from '@tanstack/react-query';

/**
 * Defaults target field use: insisting on a request with no network only drains
 * battery. Retrying writes belongs to the synchronization outbox (EP-08).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

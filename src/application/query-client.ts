import { QueryClient } from '@tanstack/react-query';

/**
 * Creates the TanStack Query client used by the whole app.
 *
 * Defaults target field use: loaded data stays valid for a few minutes and
 * automatic retry is limited. Retrying write operations is handled by the
 * synchronization outbox (EP-08), not by the cache.
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

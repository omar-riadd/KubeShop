import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import type { Version } from './types';
import { shouldRetryQuery } from './catalog';

export type ServiceName = 'catalog' | 'cart' | 'orders';

export async function fetchServiceVersion(service: ServiceName): Promise<Version> {
  return apiClient<Version>(`/api/${service}/version`, { skipSessionId: true });
}

export function useServiceVersion(service: ServiceName, refetchInterval?: number) {
  return useQuery({
    queryKey: ['version', service],
    queryFn: () => fetchServiceVersion(service),
    refetchInterval,
    retry: shouldRetryQuery,
  });
}

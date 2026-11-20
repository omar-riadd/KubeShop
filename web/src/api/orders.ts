import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import type { Order, OrderList, OrderRequest } from './types';
import { shouldRetryQuery } from './catalog';

export async function createOrder(req: OrderRequest, idempotencyKey: string): Promise<Order> {
  return apiClient<Order>('/api/orders', {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(req),
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ req, idempotencyKey }: { req: OrderRequest; idempotencyKey: string }) =>
      createOrder(req, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    retry: false,
  });
}

export async function fetchOrders(): Promise<OrderList> {
  return apiClient<OrderList>('/api/orders');
}

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: fetchOrders,
    staleTime: 30 * 1000,
    retry: shouldRetryQuery,
  });
}

export async function fetchOrder(id: string): Promise<Order> {
  return apiClient<Order>(`/api/orders/${encodeURIComponent(id)}`);
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrder(id),
    staleTime: 60 * 1000,
    enabled: Boolean(id),
    retry: shouldRetryQuery,
  });
}

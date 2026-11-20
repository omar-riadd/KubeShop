import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import type { Cart } from './types';
import { shouldRetryQuery } from './catalog';

export async function fetchCart(): Promise<Cart> {
  return apiClient<Cart>('/api/cart');
}

export function useCart() {
  return useQuery({
    queryKey: ['cart'],
    queryFn: fetchCart,
    staleTime: 0,
    retry: shouldRetryQuery,
  });
}

export async function addToCart(productId: string, quantity = 1): Promise<Cart> {
  return apiClient<Cart>('/api/cart/items', {
    method: 'POST',
    body: JSON.stringify({ productId, quantity }),
  });
}

export function useAddToCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) =>
      addToCart(productId, quantity),
    onSuccess: (data) => {
      queryClient.setQueryData(['cart'], data);
    },
    retry: false,
  });
}

export async function setCartItemQuantity(productId: string, quantity: number): Promise<Cart> {
  return apiClient<Cart>(`/api/cart/items/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    body: JSON.stringify({ quantity }),
  });
}

export function useSetCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) =>
      setCartItemQuantity(productId, quantity),
    onSuccess: (data) => {
      queryClient.setQueryData(['cart'], data);
    },
    retry: false,
  });
}

export async function removeCartItem(productId: string): Promise<Cart> {
  return apiClient<Cart>(`/api/cart/items/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
  });
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => removeCartItem(productId),
    onSuccess: (data) => {
      queryClient.setQueryData(['cart'], data);
    },
    retry: false,
  });
}

export async function clearCart(): Promise<Cart> {
  return apiClient<Cart>('/api/cart', {
    method: 'DELETE',
  });
}

export function useClearCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearCart,
    onSuccess: (data) => {
      queryClient.setQueryData(['cart'], data);
    },
    retry: false,
  });
}

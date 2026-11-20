import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import type { CategoryList, Product, ProductList } from './types';
import { ApiError } from './errors';

export interface ProductFilters {
  category?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK' || error.code === 'TIMEOUT') return true;
    if (error.status === 502 || error.status === 503 || error.status === 504) return true;
    return false;
  }
  return false;
}

export async function fetchCategories(): Promise<CategoryList> {
  return apiClient<CategoryList>('/api/catalog/categories', { skipSessionId: true });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: shouldRetryQuery,
  });
}

export async function fetchProducts(filters: ProductFilters = {}): Promise<ProductList> {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.q) params.set('q', filters.q);
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  if (filters.offset !== undefined) params.set('offset', String(filters.offset));

  const queryStr = params.toString();
  const url = queryStr ? `/api/catalog/products?${queryStr}` : '/api/catalog/products';
  return apiClient<ProductList>(url, { skipSessionId: true });
}

export function useProducts(filters: ProductFilters = {}) {
  return useQuery({
    queryKey: ['products', { category: filters.category, q: filters.q, offset: filters.offset }],
    queryFn: () => fetchProducts(filters),
    staleTime: 30 * 1000, // 30 seconds
    retry: shouldRetryQuery,
  });
}

export async function fetchProduct(id: string): Promise<Product> {
  return apiClient<Product>(`/api/catalog/products/${encodeURIComponent(id)}`, {
    skipSessionId: true,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
    staleTime: 30 * 1000,
    enabled: Boolean(id),
    retry: shouldRetryQuery,
  });
}

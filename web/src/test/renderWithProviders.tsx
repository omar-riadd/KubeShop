import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast';
import { CartDrawerProvider } from '../context/CartDrawerContext';

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
  path?: string;
}

export function renderWithProviders(
  ui: React.ReactElement,
  { route = '/', path, ...options }: RenderWithProvidersOptions = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const content = path ? (
    <Routes>
      <Route path={path} element={ui} />
    </Routes>
  ) : (
    ui
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <CartDrawerProvider>
          <MemoryRouter initialEntries={[route]}>{content}</MemoryRouter>
        </CartDrawerProvider>
      </ToastProvider>
    </QueryClientProvider>,
    options
  );
}

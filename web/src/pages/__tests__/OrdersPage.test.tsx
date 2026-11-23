import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test/renderWithProviders';
import { OrdersPage } from '../OrdersPage';

const sampleOrder = {
  id: '0b7c1d0e-6f0a-4f43-9d52-2b7a7a2f9b11',
  status: 'PLACED',
  items: [
    {
      productId: 'kb-001',
      name: 'Nimbus 75 Mechanical Keyboard',
      priceCents: 8900,
      quantity: 2,
      lineTotalCents: 17800,
    },
  ],
  totalCents: 17800,
  currency: 'USD',
  customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
  shippingAddress: {
    line1: '1 Analytical Way',
    line2: '',
    city: 'London',
    postalCode: 'N1 9GU',
    country: 'GB',
  },
  createdAt: '2026-11-20T10:15:30Z',
};

describe('OrdersPage', () => {
  it('renders orders list on happy path', async () => {
    server.use(http.get('/api/orders', () => HttpResponse.json({ items: [sampleOrder] })));

    renderWithProviders(<OrdersPage />);

    expect(await screen.findByText('Your Orders')).toBeInTheDocument();
    expect(screen.getByText(sampleOrder.id)).toBeInTheDocument();
    expect(screen.getByText('PLACED')).toBeInTheDocument();
    expect(screen.getByText('$178.00')).toBeInTheDocument();
    expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();
  });

  it('shows loading skeletons while fetching orders', async () => {
    server.use(
      http.get('/api/orders', async () => {
        await delay(200);
        return HttpResponse.json({ items: [sampleOrder] });
      })
    );

    const { container } = renderWithProviders(<OrdersPage />);

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(await screen.findByText('Your Orders')).toBeInTheDocument();
  });

  it('renders empty state when session has no orders', async () => {
    server.use(http.get('/api/orders', () => HttpResponse.json({ items: [] })));

    renderWithProviders(<OrdersPage />);

    expect(await screen.findByText('No orders placed yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /explore catalog/i })).toBeInTheDocument();
  });

  it('shows error state when orders API returns 500', async () => {
    server.use(
      http.get('/api/orders', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Orders DB down', requestId: 'req-o500' } },
          { status: 500 }
        )
      )
    );

    renderWithProviders(<OrdersPage />);

    expect(await screen.findByText('Could not load your orders')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

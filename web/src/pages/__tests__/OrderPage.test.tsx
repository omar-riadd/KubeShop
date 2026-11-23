import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test/renderWithProviders';
import { OrderPage } from '../OrderPage';

const orderId = '0b7c1d0e-6f0a-4f43-9d52-2b7a7a2f9b11';
const sampleOrder = {
  id: orderId,
  status: 'CONFIRMED',
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
    line2: 'Suite 4',
    city: 'London',
    postalCode: 'N1 9GU',
    country: 'GB',
  },
  createdAt: '2026-11-20T10:15:30Z',
};

describe('OrderPage', () => {
  it('renders order details and thank-you banner when placed=true', async () => {
    server.use(http.get('/api/orders/:id', () => HttpResponse.json(sampleOrder)));

    renderWithProviders(<OrderPage />, {
      route: `/orders/${orderId}?placed=true`,
      path: '/orders/:id',
    });

    expect(await screen.findByText('Order Details')).toBeInTheDocument();
    expect(screen.getByText('Thank You for Your Order!')).toBeInTheDocument();
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
    expect(screen.getByText('Nimbus 75 Mechanical Keyboard')).toBeInTheDocument();
    expect(screen.getByText('1 Analytical Way')).toBeInTheDocument();
    expect(screen.getByText('Suite 4')).toBeInTheDocument();
  });

  it('shows loading skeletons while fetching order', async () => {
    server.use(
      http.get('/api/orders/:id', async () => {
        await delay(200);
        return HttpResponse.json(sampleOrder);
      })
    );

    const { container } = renderWithProviders(<OrderPage />, {
      route: `/orders/${orderId}`,
      path: '/orders/:id',
    });

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(await screen.findByText('Order Details')).toBeInTheDocument();
  });

  it('renders NotFoundPage for non-UUID order ID', () => {
    renderWithProviders(<OrderPage />, {
      route: '/orders/not-a-uuid',
      path: '/orders/:id',
    });

    expect(screen.getByText(/404/i)).toBeInTheDocument();
  });

  it('shows error state when order API returns 500', async () => {
    server.use(
      http.get('/api/orders/:id', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'DB error', requestId: 'req-od500' } },
          { status: 500 }
        )
      )
    );

    renderWithProviders(<OrderPage />, {
      route: `/orders/${orderId}`,
      path: '/orders/:id',
    });

    expect(await screen.findByText('Order Not Found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

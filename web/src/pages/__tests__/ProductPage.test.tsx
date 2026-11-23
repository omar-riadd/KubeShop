import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test/renderWithProviders';
import { ProductPage } from '../ProductPage';

describe('ProductPage', () => {
  it('renders product details and adds to cart on happy path', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductPage />, {
      route: '/products/kb-001',
      path: '/products/:id',
    });

    expect(await screen.findByTestId('product-title')).toHaveTextContent(
      'Nimbus 75 Mechanical Keyboard'
    );
    expect(screen.getByText(/75% hot-swappable mechanical keyboard/i)).toBeInTheDocument();

    await user.click(screen.getByTestId('add-to-cart'));
    expect(
      await screen.findByText(/Added 1 × Nimbus 75 Mechanical Keyboard to cart\./i)
    ).toBeInTheDocument();
  });

  it('shows loading skeletons while fetching product', async () => {
    server.use(
      http.get('/api/catalog/products/:id', async () => {
        await delay(200);
        return HttpResponse.json({
          id: 'kb-001',
          name: 'Nimbus 75 Mechanical Keyboard',
          description: 'Mechanical keyboard',
          category: 'keyboards',
          priceCents: 8900,
          currency: 'USD',
          imageUrl: '/images/products/kb-001.svg',
        });
      })
    );

    const { container } = renderWithProviders(<ProductPage />, {
      route: '/products/kb-001',
      path: '/products/:id',
    });

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(await screen.findByTestId('product-title')).toBeInTheDocument();
  });

  it('renders NotFoundPage for invalid product ID format', () => {
    renderWithProviders(<ProductPage />, {
      route: '/products/invalid-id',
      path: '/products/:id',
    });

    expect(screen.getByText(/404/i)).toBeInTheDocument();
  });

  it('shows error state when product API returns 500', async () => {
    server.use(
      http.get('/api/catalog/products/:id', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Upstream failure', requestId: 'req-p500' } },
          { status: 500 }
        )
      )
    );

    renderWithProviders(<ProductPage />, {
      route: '/products/kb-001',
      path: '/products/:id',
    });

    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

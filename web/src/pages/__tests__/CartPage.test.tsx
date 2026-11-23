import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test/renderWithProviders';
import { CartPage } from '../CartPage';

const populatedCart = {
  items: [
    {
      productId: 'kb-001',
      name: 'Nimbus 75 Mechanical Keyboard',
      priceCents: 8900,
      quantity: 2,
      lineTotalCents: 17800,
      imageUrl: '/images/products/kb-001.svg',
    },
    {
      productId: 'ms-001',
      name: 'Orbit Ergonomic Mouse',
      priceCents: 5900,
      quantity: 1,
      lineTotalCents: 5900,
      imageUrl: '/images/products/ms-001.svg',
    },
  ],
  itemCount: 3,
  subtotalCents: 23700,
  currency: 'USD',
};

describe('CartPage', () => {
  it('renders cart items, subtotal, and allows removing an item', async () => {
    const user = userEvent.setup();
    let removed = false;
    server.use(
      http.get('/api/cart', () =>
        HttpResponse.json(
          removed
            ? {
                items: [populatedCart.items[1]],
                itemCount: 1,
                subtotalCents: 5900,
                currency: 'USD',
              }
            : populatedCart
        )
      ),
      http.delete('/api/cart/items/:productId', () => {
        removed = true;
        return HttpResponse.json({
          items: [populatedCart.items[1]],
          itemCount: 1,
          subtotalCents: 5900,
          currency: 'USD',
        });
      })
    );

    renderWithProviders(<CartPage />);

    expect(await screen.findByText('Shopping Cart')).toBeInTheDocument();
    expect(screen.getByText('Nimbus 75 Mechanical Keyboard')).toBeInTheDocument();
    expect(screen.getByText('Orbit Ergonomic Mouse')).toBeInTheDocument();
    expect(screen.getAllByText('$237.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('proceed-to-checkout')).toBeInTheDocument();

    const removeButtons = screen.getAllByRole('button', { name: /remove item/i });
    await user.click(removeButtons[0]);

    expect(await screen.findByText('Item removed from cart')).toBeInTheDocument();
  });

  it('shows loading skeletons while cart is loading', async () => {
    server.use(
      http.get('/api/cart', async () => {
        await delay(200);
        return HttpResponse.json(populatedCart);
      })
    );

    const { container } = renderWithProviders(<CartPage />);

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(await screen.findByText('Shopping Cart')).toBeInTheDocument();
  });

  it('renders empty state when cart has no items', async () => {
    server.use(
      http.get('/api/cart', () =>
        HttpResponse.json({ items: [], itemCount: 0, subtotalCents: 0, currency: 'USD' })
      )
    );

    renderWithProviders(<CartPage />);

    expect(await screen.findByText('Your cart is empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /browse catalog/i })).toBeInTheDocument();
  });

  it('shows error state when cart API returns 500', async () => {
    server.use(
      http.get('/api/cart', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Redis down', requestId: 'req-c500' } },
          { status: 500 }
        )
      )
    );

    renderWithProviders(<CartPage />);

    expect(await screen.findByText('Could not load your cart')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

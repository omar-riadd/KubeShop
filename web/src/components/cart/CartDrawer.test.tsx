import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test/renderWithProviders';
import { CartDrawer } from './CartDrawer';
import { useCartDrawer } from '../../context/CartDrawerContext';
import React, { useEffect } from 'react';

// Wrapper to open drawer automatically
const DrawerTestWrapper: React.FC<{ initiallyOpen?: boolean }> = ({ initiallyOpen = true }) => {
  const { openDrawer } = useCartDrawer();
  useEffect(() => {
    if (initiallyOpen) openDrawer();
  }, [initiallyOpen, openDrawer]);

  return <CartDrawer />;
};

describe('CartDrawer', () => {
  it('renders cart drawer with items and free shipping progress', async () => {
    server.use(
      http.get('/api/cart', () =>
        HttpResponse.json({
          sessionId: 'test-session',
          items: [
            {
              productId: 'kb-001',
              name: 'Nimbus 75 Mechanical Keyboard',
              priceCents: 8900,
              currency: 'USD',
              quantity: 1,
              imageUrl: '/images/products/kb-001.svg',
            },
          ],
          itemCount: 1,
          subtotalCents: 8900,
          currency: 'USD',
        })
      )
    );

    renderWithProviders(<DrawerTestWrapper initiallyOpen={true} />);

    expect(
      await screen.findByRole('dialog', { name: /shopping cart drawer/i })
    ).toBeInTheDocument();
    expect(await screen.findByText('Nimbus 75 Mechanical Keyboard')).toBeInTheDocument();
    expect(screen.getByText(/Free SRE Dispatch/i)).toBeInTheDocument();
    expect(screen.getByTestId('drawer-checkout-button')).toBeInTheDocument();
  });

  it('shows unlocked free shipping when subtotal >= $100', async () => {
    server.use(
      http.get('/api/cart', () =>
        HttpResponse.json({
          sessionId: 'test-session',
          items: [
            {
              productId: 'au-001',
              name: 'Tracer Studio Headphones',
              priceCents: 14900,
              currency: 'USD',
              quantity: 1,
              imageUrl: '/images/products/au-001.svg',
            },
          ],
          itemCount: 1,
          subtotalCents: 14900,
          currency: 'USD',
        })
      )
    );

    renderWithProviders(<DrawerTestWrapper initiallyOpen={true} />);

    expect(
      await screen.findByText(/Free Priority SRE Dispatch applied to order/i)
    ).toBeInTheDocument();
  });

  it('closes drawer when clicking close button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DrawerTestWrapper initiallyOpen={true} />);

    const closeBtn = await screen.findByTestId('close-cart-drawer');
    await user.click(closeBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

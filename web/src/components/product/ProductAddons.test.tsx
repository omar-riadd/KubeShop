import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { WhatsInTheBox } from './WhatsInTheBox';
import { BundleOffer } from './BundleOffer';
import { SpecComparisonModal } from './SpecComparisonModal';
import { mockProducts } from '../../mocks/fixtures';

describe('Product Addons', () => {
  const currentProduct = mockProducts[0]; // Nimbus 75 (keyboards)

  describe('WhatsInTheBox', () => {
    it('renders category-specific unboxing hardware items', () => {
      renderWithProviders(<WhatsInTheBox product={currentProduct} />);

      expect(screen.getByRole('heading', { name: /what’s in the box/i })).toBeInTheDocument();
      expect(screen.getByText('Braided USB-C Cable')).toBeInTheDocument();
      expect(screen.getByText('2-in-1 Puller Tool')).toBeInTheDocument();
      expect(screen.getByText('3x Extra Switches')).toBeInTheDocument();
    });
  });

  describe('BundleOffer', () => {
    it('renders bundle suggestion with discounted companion accessory', () => {
      renderWithProviders(
        <BundleOffer currentProduct={currentProduct} allProducts={mockProducts} />
      );

      expect(
        screen.getByRole('heading', { name: /frequently bought together/i })
      ).toBeInTheDocument();
      expect(screen.getByTestId('add-bundle-to-cart')).toBeInTheDocument();
      expect(screen.getByText(/Save 10% on companion/i)).toBeInTheDocument();
    });

    it('adds bundle to cart and triggers success notification', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <BundleOffer currentProduct={currentProduct} allProducts={mockProducts} />
      );

      const addBtn = screen.getByTestId('add-bundle-to-cart');
      await user.click(addBtn);

      expect(await screen.findByRole('status')).toHaveTextContent(/Bundle added!/i);
    });
  });

  describe('SpecComparisonModal', () => {
    it('renders comparison table across category hardware when open', () => {
      renderWithProviders(
        <SpecComparisonModal
          open={true}
          onClose={() => {}}
          currentProduct={currentProduct}
          allProducts={mockProducts}
        />
      );

      expect(
        screen.getByRole('heading', { name: /compare KEYBOARDS specifications/i })
      ).toBeInTheDocument();
      expect(screen.getByText('Form Factor')).toBeInTheDocument();
      expect(screen.getByText('Mounting Style')).toBeInTheDocument();
      expect(screen.getByText('Polling Rate')).toBeInTheDocument();
    });
  });
});

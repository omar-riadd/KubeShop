import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../../mocks/server';
import { mockProducts } from '../../mocks/fixtures';
import { renderWithProviders } from '../../test/renderWithProviders';
import { CatalogPage } from '../CatalogPage';

describe('CatalogPage', () => {
  it('renders products and categories on happy path', async () => {
    const threeProducts = mockProducts.slice(0, 3);
    server.use(
      http.get('/api/catalog/products', () =>
        HttpResponse.json({ items: threeProducts, total: threeProducts.length })
      )
    );

    renderWithProviders(<CatalogPage />);

    expect(await screen.findByText('Nimbus 75 Mechanical Keyboard')).toBeInTheDocument();
    expect(screen.getByText('Helm 60 Wireless Keyboard')).toBeInTheDocument();
    expect(screen.getByText('Pod TKL Low-Profile Keyboard')).toBeInTheDocument();
    expect(screen.getByText('3 products')).toBeInTheDocument();
    expect(screen.getByTestId('category-chip-keyboards')).toBeInTheDocument();
  });

  it('shows loading skeletons while products are loading', async () => {
    server.use(
      http.get('/api/catalog/products', async () => {
        await delay(200);
        return HttpResponse.json({ items: mockProducts.slice(0, 1), total: 1 });
      })
    );

    const { container } = renderWithProviders(<CatalogPage />);

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(await screen.findByText('Nimbus 75 Mechanical Keyboard')).toBeInTheDocument();
  });

  it('shows error state when catalog API returns 500', async () => {
    server.use(
      http.get('/api/catalog/products', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Catalog DB down', requestId: 'req-500' } },
          { status: 500 }
        )
      )
    );

    renderWithProviders(<CatalogPage />);

    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows empty state and lets user add item to cart and filter by category', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CatalogPage />);

    const addBtn = await screen.findByTestId('add-to-cart-kb-001');
    await user.click(addBtn);

    expect(
      await screen.findByText(/Added Nimbus 75 Mechanical Keyboard to cart\./i)
    ).toBeInTheDocument();

    server.use(http.get('/api/catalog/products', () => HttpResponse.json({ items: [], total: 0 })));

    await user.click(screen.getByTestId('category-chip-mice'));

    await waitFor(() => {
      expect(screen.getByText('No products match your search')).toBeInTheDocument();
    });
  });
});

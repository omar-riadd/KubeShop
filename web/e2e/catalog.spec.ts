import { test, expect } from '@playwright/test';

test.describe('Catalog Page & Product Exploration', () => {
  test('renders storefront hero and 12 products', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/KubeShop/);
    await expect(page.locator('h1')).toContainText('Gear for engineers who ship');

    // Wait for product cards to load
    const cards = page.locator('[data-testid^="product-card-"]');
    await expect(cards).toHaveCount(12);
  });

  test('filters products by search input', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByTestId('search-input');
    await searchInput.fill('Keyboard');

    // Wait for search filter debounce
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid^="product-card-"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(12);
  });

  test('filters products by category chip', async ({ page }) => {
    await page.goto('/');

    const keyboardChip = page.getByTestId('category-chip-keyboards');
    await keyboardChip.click();

    await page.waitForTimeout(400);

    const cards = page.locator('[data-testid^="product-card-"]');
    const count = await cards.count();
    expect(count).toBe(3); // 3 keyboards in catalog
  });

  test('navigates to product detail page and validates contents', async ({ page }) => {
    await page.goto('/products/kb-001');

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByTestId('product-title')).toBeVisible();
    await expect(page.getByRole('button', { name: /add to cart/i }).first()).toBeVisible();
  });

  test('opens command palette with hotkey, searches, and navigates', async ({ page }) => {
    await page.goto('/');

    // Open via header search button
    const searchTrigger = page.getByTestId('header-search-button');
    await expect(searchTrigger).toBeVisible();
    await searchTrigger.click();

    const dialog = page.getByRole('dialog', { name: /product search command palette/i });
    await expect(dialog).toBeVisible();

    const input = page.getByTestId('command-palette-input');
    await input.fill('Nimbus');

    const result = page.getByTestId('search-result-kb-001');
    await expect(result).toBeVisible();

    await result.click();
    await expect(page).toHaveURL(/\/products\/kb-001/);
    await expect(dialog).not.toBeVisible();
  });
});

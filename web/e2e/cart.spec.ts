import { test, expect } from '@playwright/test';

test.describe('Cart Operations', () => {
  test('adds item to cart and manages line items', async ({ page }) => {
    // Start at catalog
    await page.goto('/');

    // Add first product to cart
    const addBtn = page.locator('[data-testid^="add-to-cart-"]').first();
    await addBtn.click();

    // Verify toast notification appears
    await expect(page.getByRole('status')).toBeVisible();

    // Navigate to /cart
    await page.goto('/cart');

    await expect(page.locator('h1')).toContainText('Shopping Cart');
    await expect(page.getByTestId('proceed-to-checkout')).toBeVisible();

    // Increase quantity via stepper
    const incBtn = page.getByRole('button', { name: /increase quantity/i }).first();
    await incBtn.click();

    await page.waitForTimeout(400);

    // Remove item from cart
    const removeBtn = page.getByRole('button', { name: /remove item/i }).first();
    await removeBtn.click();

    // Verify cart is now empty
    await expect(page.getByText(/your cart is empty/i)).toBeVisible();
  });
});

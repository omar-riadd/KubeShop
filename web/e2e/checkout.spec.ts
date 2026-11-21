import { test, expect } from '@playwright/test';

test.describe('End-to-End Checkout Flow', () => {
  test('places an order and redirects to confirmation', async ({ page }) => {
    // 1. Add product to cart
    await page.goto('/products/kb-001');
    await page.getByRole('button', { name: /add to cart/i }).click();

    // 2. Go to checkout
    await page.goto('/checkout');
    await expect(page.locator('h1')).toContainText('Checkout');

    // 3. Fill customer info
    await page.getByLabel('Full Name').fill('Ada Lovelace');
    await page.getByLabel('Email Address').fill('ada@example.com');

    // 4. Fill shipping address
    await page.getByLabel('Street Address').fill('1 Analytical Way');
    await page.getByLabel('City').fill('London');
    await page.getByLabel('Postal / ZIP Code').fill('EC1A 1BB');

    // 5. Submit order
    const placeOrderBtn = page.getByTestId('place-order-btn');
    await placeOrderBtn.click();

    // 6. Verify navigation to /orders/{id}?placed=true
    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+\?placed=true/i);
    await expect(page.getByText(/thank you for your order/i)).toBeVisible();
    await expect(page.getByText('Ada Lovelace').first()).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Platform Status & Rollout Monitor', () => {
  test('displays microservice telemetry and runs traffic probe', async ({ page }) => {
    await page.goto('/status');

    await expect(page.locator('h1')).toContainText('System Status & Rollout Monitor');
    await expect(page.getByText('Catalog Service')).toBeVisible();
    await expect(page.getByText('Cart Service')).toBeVisible();
    await expect(page.getByText('Orders Service')).toBeVisible();

    // Run Canary Traffic Probe
    const probeBtn = page.getByRole('button', { name: /probe 20 requests/i });
    await expect(probeBtn).toBeVisible();
    await probeBtn.click();

    // Verify probe results render distribution
    await expect(page.getByText('Version Distribution')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Pods Responded:')).toBeVisible();
  });
});

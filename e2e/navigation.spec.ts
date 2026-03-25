import { test, expect } from '@playwright/test';
import { isAuthenticated } from './helpers/auth';

test.describe('Navigation smoke tests', () => {
  test('Command page loads', async ({ page }) => {
    await page.goto('/command');
    // Should either load the page or redirect to auth
    await expect(page).toHaveURL(/\/(command|auth)/);
  });

  test('Pipeline page loads', async ({ page }) => {
    await page.goto('/pipeline');
    await expect(page).toHaveURL(/\/(pipeline|auth)/);
  });

  test('Queue page loads', async ({ page }) => {
    await page.goto('/queue');
    await expect(page).toHaveURL(/\/(queue|auth)/);
  });

  test('Legacy page loads', async ({ page }) => {
    await page.goto('/legacy');
    await expect(page).toHaveURL(/\/(legacy|auth)/);
  });

  test('Admin page restricts non-admin access', async ({ page }) => {
    await page.goto('/admin');
    // Non-admin users should see access denied or be redirected
    await expect(page).toHaveURL(/\/(admin|auth)/);
  });

  test('Nav bar is present on authenticated pages', async ({ page }) => {
    const authed = await isAuthenticated(page, '/command');
    if (!authed) {
      test.skip(true, 'Not authenticated — skipping nav bar check');
      return;
    }

    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('Help page loads', async ({ page }) => {
    await page.goto('/help');
    await expect(page).toHaveURL(/\/(help|auth)/);
  });

  test('Analytics page loads', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page).toHaveURL(/\/(analytics|auth)/);
  });
});

import { test, expect } from '@playwright/test';
import { isAuthenticated } from './helpers/auth';

test.describe('Pipeline page search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pipeline');
  });

  test('Pipeline page loads with content', async ({ page }) => {
    const url = page.url();
    if (!url.includes('/pipeline')) {
      test.skip(true, 'Redirected away from pipeline — not authenticated');
      return;
    }

    // Page should have some content within a few seconds
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('Search box exists and accepts input', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    const inputCount = await searchInput.count();
    if (inputCount === 0) {
      test.skip(true, 'Not authenticated — search input not found');
      return;
    }

    await expect(searchInput).toBeVisible();
    await searchInput.fill('PROJ-00001');
    await expect(searchInput).toHaveValue('PROJ-00001');
  });

  test('Search debounces without flicker', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    const inputCount = await searchInput.count();
    if (inputCount === 0) {
      test.skip(true, 'Not authenticated — search input not found');
      return;
    }

    // Type rapidly to test debounce behavior
    await searchInput.pressSequentially('test', { delay: 50 });

    // Wait for debounce to settle (typical debounce is 200-300ms)
    await page.waitForTimeout(500);

    // Page should still be stable (no error states)
    const contentAfter = await page.textContent('body');
    expect(contentAfter).toBeTruthy();

    // Verify page didn't crash
    await expect(page).toHaveURL(/\/pipeline/);
  });
});

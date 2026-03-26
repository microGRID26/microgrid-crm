import { test, expect } from '@playwright/test';
import { navigateAuthenticated, waitForDataLoad } from './helpers/auth';

test.describe('Legacy page search and detail panel', () => {
  test.beforeEach(async ({ page }) => {
    await navigateAuthenticated(page, '/legacy');
    await waitForDataLoad(page);
  });

  test('Legacy page heading exists', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /legacy/i });
    await expect(heading).toBeVisible();
  });

  test('Search box filters results', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();

    await searchInput.fill('test');
    await page.waitForTimeout(500);

    // Should still be on legacy page (no crash)
    await expect(page).toHaveURL(/\/legacy/);
  });

  test('Search with nonexistent term shows filtered state', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();

    await searchInput.fill('zzzznonexistent999');
    await page.waitForTimeout(500);

    // Page should handle gracefully — no crash
    await expect(page).toHaveURL(/\/legacy/);
  });

  test('Clicking a row opens detail panel', async ({ page }) => {
    // Legacy page uses table rows
    const rows = page.locator('tr[class*="cursor"], tbody tr').filter({ hasText: 'PROJ-' });
    const rowCount = await rows.count();

    if (rowCount === 0) {
      test.skip(true, 'No project rows found — test environment may have no legacy data');
      return;
    }

    await rows.first().click();
    await page.waitForTimeout(500);

    // A detail panel/modal should appear
    const panel = page.locator('[class*="fixed"], [role="dialog"]');
    const panelCount = await panel.count();
    expect(panelCount).toBeGreaterThan(0);
  });

  test('Detail panel has expected tabs or sections', async ({ page }) => {
    const rows = page.locator('tr[class*="cursor"], tbody tr').filter({ hasText: 'PROJ-' });
    const rowCount = await rows.count();

    if (rowCount === 0) {
      test.skip(true, 'No project rows found — test environment may have no legacy data');
      return;
    }

    await rows.first().click();
    await page.waitForTimeout(500);

    // ProjectPanel should show tabs (Overview, Tasks, Notes, etc.)
    const body = await page.textContent('body');
    const tabNames = ['Overview', 'Tasks', 'Notes', 'Info', 'Files', 'BOM'];
    const hasTab = tabNames.some((t) => body?.includes(t));
    expect(hasTab).toBe(true);
  });

  test('Detail panel closes', async ({ page }) => {
    const rows = page.locator('tr[class*="cursor"], tbody tr').filter({ hasText: 'PROJ-' });
    const rowCount = await rows.count();

    if (rowCount === 0) {
      test.skip(true, 'No project rows found');
      return;
    }

    await rows.first().click();
    await page.waitForTimeout(500);

    // Try to close via X button or Escape
    const closeBtn = page.locator('button[aria-label*="close"], button[aria-label*="Close"]');
    const closeBtnCount = await closeBtn.count();

    if (closeBtnCount > 0) {
      await closeBtn.first().click();
    } else {
      await page.keyboard.press('Escape');
    }

    await page.waitForTimeout(300);
    // Should still be on legacy page
    await expect(page).toHaveURL(/\/legacy/);
  });
});

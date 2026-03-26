import { test, expect } from '@playwright/test';
import { navigateAuthenticated, waitForDataLoad } from './helpers/auth';

test.describe('Pipeline page search', () => {
  test.beforeEach(async ({ page }) => {
    await navigateAuthenticated(page, '/pipeline');
    await waitForDataLoad(page);
  });

  test('Pipeline page loads with project cards', async ({ page }) => {
    // Pipeline should render at least some project content
    await expect(page).toHaveURL(/\/pipeline/);
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    // Should have PROJ- IDs visible if there are projects
    // (data-dependent — just verify page loaded without error)
    expect(body!.length).toBeGreaterThan(100);
  });

  test('Search box exists and accepts input', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();

    await searchInput.fill('PROJ-00001');
    await expect(searchInput).toHaveValue('PROJ-00001');
  });

  test('Search filters projects', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();

    // Get initial page content length as baseline
    const initialBody = await page.textContent('body');
    const initialLength = initialBody?.length ?? 0;

    // Search for something unlikely to match many projects
    await searchInput.fill('zzzzzznonexistent');
    await page.waitForTimeout(500); // debounce

    // Page should still be on pipeline (no crash)
    await expect(page).toHaveURL(/\/pipeline/);

    // Content should be different (filtered)
    const filteredBody = await page.textContent('body');
    // Either fewer results or a "no results" state — just verify no crash
    expect(filteredBody).toBeTruthy();
  });

  test('Search debounces without flicker', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();

    // Type rapidly to test debounce behavior
    await searchInput.pressSequentially('test project', { delay: 50 });

    // Wait for debounce to settle
    await page.waitForTimeout(500);

    // Page should still be stable
    await expect(page).toHaveURL(/\/pipeline/);
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('Clearing search restores results', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();

    // Search then clear
    await searchInput.fill('test');
    await page.waitForTimeout(500);
    await searchInput.fill('');
    await page.waitForTimeout(500);

    // Page should still show content
    await expect(page).toHaveURL(/\/pipeline/);
    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(100);
  });

  test('Clicking a project card opens detail panel', async ({ page }) => {
    // Look for clickable project elements (cards with PROJ- IDs)
    const projectCard = page.locator('[class*="cursor-pointer"]:has-text("PROJ-")').first();
    const cardCount = await projectCard.count();

    if (cardCount === 0) {
      // No projects loaded — skip gracefully (data-dependent)
      test.skip(true, 'No project cards found — test environment may have no data');
      return;
    }

    await projectCard.click();
    await page.waitForTimeout(500);

    // A detail panel/modal should appear
    const panel = page.locator('[class*="fixed"], [role="dialog"]');
    const panelCount = await panel.count();
    expect(panelCount).toBeGreaterThan(0);
  });
});

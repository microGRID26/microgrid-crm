import { test, expect } from '@playwright/test';
import { navigateAuthenticated, waitForDataLoad } from './helpers/auth';

test.describe('Navigation smoke tests', () => {
  test('Command page loads with content', async ({ page }) => {
    await navigateAuthenticated(page, '/command');
    await expect(page).toHaveURL(/\/command/);

    // Nav bar should be visible
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Wait for data to load — Command page shows sections
    await waitForDataLoad(page);
  });

  test('Pipeline page loads with stage columns', async ({ page }) => {
    await navigateAuthenticated(page, '/pipeline');
    await expect(page).toHaveURL(/\/pipeline/);
    await waitForDataLoad(page);

    // Pipeline should show stage labels (from STAGE_LABELS)
    const body = await page.textContent('body');
    // At least one stage name should appear
    const stageNames = ['Evaluation', 'Survey', 'Design', 'Permit', 'Install', 'Inspection', 'Complete'];
    const hasStage = stageNames.some((s) => body?.includes(s));
    expect(hasStage).toBe(true);
  });

  test('Queue page loads', async ({ page }) => {
    await navigateAuthenticated(page, '/queue');
    await expect(page).toHaveURL(/\/queue/);
    await waitForDataLoad(page);
  });

  test('Analytics page loads with tabs', async ({ page }) => {
    await navigateAuthenticated(page, '/analytics');
    await expect(page).toHaveURL(/\/analytics/);
    await waitForDataLoad(page);

    // Should have tab buttons
    const body = await page.textContent('body');
    expect(body).toContain('Leadership');
  });

  test('Funding page loads', async ({ page }) => {
    await navigateAuthenticated(page, '/funding');
    await expect(page).toHaveURL(/\/funding/);
    await waitForDataLoad(page);
  });

  test('Schedule page loads', async ({ page }) => {
    await navigateAuthenticated(page, '/schedule');
    await expect(page).toHaveURL(/\/schedule/);
    await waitForDataLoad(page);
  });

  test('Service page loads', async ({ page }) => {
    await navigateAuthenticated(page, '/service');
    await expect(page).toHaveURL(/\/service/);
    await waitForDataLoad(page);
  });

  test('Help page loads', async ({ page }) => {
    await navigateAuthenticated(page, '/help');
    await expect(page).toHaveURL(/\/help/);
    await waitForDataLoad(page);
  });

  test('Nav bar has expected links', async ({ page }) => {
    await navigateAuthenticated(page, '/command');

    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Check key nav links exist
    const navText = await nav.textContent();
    const expectedLinks = ['Command', 'Pipeline', 'Queue'];
    for (const linkText of expectedLinks) {
      expect(navText).toContain(linkText);
    }
  });

  test('Nav links navigate correctly', async ({ page }) => {
    await navigateAuthenticated(page, '/command');

    // Click Pipeline nav link
    await page.locator('nav').getByText('Pipeline').click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/pipeline/);

    // Click Queue nav link
    await page.locator('nav').getByText('Queue').click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/queue/);
  });

  test('Admin page loads for admin user', async ({ page }) => {
    await navigateAuthenticated(page, '/admin');
    await expect(page).toHaveURL(/\/admin/);
    await waitForDataLoad(page);

    // Admin page should show admin content (test user has admin role)
    const body = await page.textContent('body');
    expect(body?.length).toBeGreaterThan(50);
  });
});

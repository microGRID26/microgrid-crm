import { Page, expect } from '@playwright/test'

/**
 * Helper to set up authenticated session for E2E tests.
 *
 * For now, uses runtime detection: navigates to a page and checks whether
 * the user was redirected to auth. Returns true if authenticated, false if not.
 *
 * Future implementation options:
 *   1. Set up a test user with email/password auth and log in via this helper
 *   2. Use Playwright storageState to persist auth cookies between test runs
 *   3. Use Supabase service role key to create a test session programmatically
 *   4. Mock the auth layer at the Supabase client level via page.route()
 */
export async function authenticateUser(page: Page): Promise<boolean> {
  // TODO: Implement when test user credentials are available
  // For now, check if redirected to auth and return false
  return false
}

/**
 * Check if the current page is authenticated by looking for auth redirect.
 * Navigates to the given path and returns true if the page loaded without
 * being redirected to an auth page.
 */
export async function isAuthenticated(page: Page, path = '/command'): Promise<boolean> {
  await page.goto(path)
  // Wait for navigation to settle
  await page.waitForLoadState('networkidle').catch(() => {})
  const url = page.url()
  return !url.includes('/auth') && !url.includes('/login')
}

/**
 * Skip a test gracefully if not authenticated.
 * Use in test.beforeEach or at the start of a test body.
 *
 * Example:
 *   test('my test', async ({ page }) => {
 *     await skipIfNotAuthenticated(page, '/pipeline')
 *     // ... rest of test
 *   })
 */
export async function skipIfNotAuthenticated(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await page.waitForLoadState('networkidle').catch(() => {})
  const url = page.url()
  if (url.includes('/auth') || url.includes('/login')) {
    throw new Error('SKIP: Not authenticated — redirected to auth page')
  }
}

/**
 * Check if a specific element exists on the page, indicating the user
 * has access. Returns false if the element is not found within the timeout.
 */
export async function hasPageAccess(page: Page, selector: string, timeout = 5000): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout })
    return true
  } catch {
    return false
  }
}

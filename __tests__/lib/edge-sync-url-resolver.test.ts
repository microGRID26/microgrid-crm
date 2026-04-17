import { describe, it, expect } from 'vitest'
import { resolveEdgeWebhookUrl } from '@/lib/api/edge-sync'

/**
 * Regression tests for the URL resolver that was silently broken in
 * production for ~14 days (2026-04-17 webhook audit). The two failure
 * modes were:
 *   - env var `NEXT_PUBLIC_EDGE_WEBHOOK_URL` had the webhook path already
 *     appended, and the calling code appended it again → double-path 307
 *   - env-var values pasted in Vercel UI sometimes had whitespace or
 *     trailing slashes that produced a subtly different fetch target
 */
describe('resolveEdgeWebhookUrl', () => {
  it('appends the webhook path when the env var is a base URL', () => {
    expect(resolveEdgeWebhookUrl('https://edge-portal-blush.vercel.app'))
      .toBe('https://edge-portal-blush.vercel.app/api/webhooks/nova')
  })

  it('does not double-append when the env var already ends in the path', () => {
    expect(resolveEdgeWebhookUrl('https://edge-portal-blush.vercel.app/api/webhooks/nova'))
      .toBe('https://edge-portal-blush.vercel.app/api/webhooks/nova')
  })

  it('strips a trailing slash and still collapses to the canonical URL', () => {
    expect(resolveEdgeWebhookUrl('https://edge-portal-blush.vercel.app/api/webhooks/nova/'))
      .toBe('https://edge-portal-blush.vercel.app/api/webhooks/nova')
  })

  it('strips multiple trailing slashes', () => {
    expect(resolveEdgeWebhookUrl('https://host///'))
      .toBe('https://host/api/webhooks/nova')
  })

  it('trims whitespace from the env var value (leading space incident)', () => {
    // Leading space — MG.EDGE_WEBHOOK_SECRET had a similar bug that
    // killed HMAC; same class of bug on the URL would produce an
    // invalid hostname. Trim defensively.
    expect(resolveEdgeWebhookUrl(' https://host/api/webhooks/nova'))
      .toBe('https://host/api/webhooks/nova')
  })

  it('trims a trailing newline (SPARK-style bug)', () => {
    expect(resolveEdgeWebhookUrl('https://host/api/webhooks/nova\n'))
      .toBe('https://host/api/webhooks/nova')
  })

  it('returns empty string when env var is undefined', () => {
    expect(resolveEdgeWebhookUrl(undefined)).toBe('')
  })

  it('returns empty string when env var is null', () => {
    expect(resolveEdgeWebhookUrl(null)).toBe('')
  })

  it('returns empty string when env var is whitespace only', () => {
    expect(resolveEdgeWebhookUrl('   \n\t')).toBe('')
  })

  it('handles the exact production prod URL shape', () => {
    // Mirror of what is actually set in Vercel prod for NEXT_PUBLIC_EDGE_WEBHOOK_URL
    expect(resolveEdgeWebhookUrl('https://edge-portal-blush.vercel.app/api/webhooks/nova'))
      .toBe('https://edge-portal-blush.vercel.app/api/webhooks/nova')
  })
})

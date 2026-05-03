import * as Sentry from '@sentry/react-native'
import Constants from 'expo-constants'

// DSN-gated Sentry init. When EXPO_PUBLIC_SENTRY_DSN is not set (e.g. local dev
// without a configured DSN, or before the org admin creates the Sentry project
// per greg_action #489), this is a no-op — the SDK loads but never connects.
//
// Phase 2 of the unified-app plan (~/.claude/plans/robust-enchanting-dawn.md):
// crash + error monitoring on the native customer/employee surface, separate
// Sentry project from CRM ('microgrid-mobile') so customer error volumes are
// attributable.

const dsn =
  process.env.EXPO_PUBLIC_SENTRY_DSN ??
  (Constants.expoConfig?.extra?.sentryDsn as string | undefined) ??
  ''

const environment =
  process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ??
  (__DEV__ ? 'development' : 'production')

const release =
  Constants.expoConfig?.version ?? '0.0.0'

export function initSentry() {
  if (!dsn) {
    if (__DEV__) {
      // Surface during dev so it's obvious why crashes aren't reaching Sentry.
      console.warn('[sentry] EXPO_PUBLIC_SENTRY_DSN not set — Sentry init skipped')
    }
    return
  }

  Sentry.init({
    dsn,
    environment,
    release,
    // Conservative defaults for v1. Tighten / adjust after first week of real data.
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30_000,
    // PII off by default — customer-side data flows through Supabase, not Sentry.
    sendDefaultPii: false,
    // Don't ship any breadcrumb that includes a Supabase URL with auth tokens.
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        if (breadcrumb.data?.url && /supabase\.co/.test(String(breadcrumb.data.url))) {
          // Drop query string + auth tokens
          breadcrumb.data.url = String(breadcrumb.data.url).split('?')[0]
        }
      }
      return breadcrumb
    },
  })
}

export const wrap = Sentry.wrap
export { Sentry }

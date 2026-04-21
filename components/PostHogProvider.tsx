'use client'

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { capturePageview } from '@/lib/analytics/posthog'

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'

function PageviewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return
    const qs = searchParams?.toString()
    const url = qs ? `${pathname}?${qs}` : pathname
    capturePageview(typeof window !== 'undefined' ? window.location.origin + url : url)
  }, [pathname, searchParams])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!KEY) return
    if (posthog.__loaded) return
    posthog.init(KEY, {
      api_host: HOST,
      capture_pageview: false,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
      // Conservative masking for a CRM: hide every text input by default.
      // Loosen selectively once we know which fields are safe to record.
      session_recording: {
        maskAllInputs: true,
      },
      loaded: (ph) => {
        if (process.env.NODE_ENV === 'development') ph.debug(false)
        // Fire the first pageview once the script is truly loaded. On hard
        // page load the PageviewTracker effect may run before __loaded is
        // true and no-op; this closes that gap without double-capturing
        // on subsequent soft navigations (pathname won't change).
        ph.capture('$pageview')
      },
    })
  }, [])

  return (
    <>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </>
  )
}

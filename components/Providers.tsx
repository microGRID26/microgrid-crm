'use client'

import { Suspense } from 'react'
import { OrgProvider } from '@/lib/hooks/useOrg'
import { ErrorToastProvider } from '@/components/ErrorToastProvider'
import QARunOverlay from '@/components/qa/QARunOverlay'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorToastProvider>
      <OrgProvider>
        {children}
        {/* QA Daily Driver overlay — self-no-ops unless ?qa_run=<id> is in URL */}
        <Suspense fallback={null}>
          <QARunOverlay />
        </Suspense>
      </OrgProvider>
    </ErrorToastProvider>
  )
}

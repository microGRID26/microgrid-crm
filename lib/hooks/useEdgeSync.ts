// lib/hooks/useEdgeSync.ts — Fire-and-forget EDGE webhook triggers
// Used by ProjectPanel automation chain to send events to EDGE Portal.
// All calls are async but non-blocking — failures are logged, never thrown.

import { useCallback } from 'react'
import { sendToEdge, syncFundingToEdge } from '@/lib/api/edge-sync'
import type { EdgeEventType } from '@/lib/api/edge-sync'

/**
 * Hook that provides fire-and-forget EDGE sync functions.
 * Wraps sendToEdge calls so they never block the UI.
 */
export function useEdgeSync() {

  /** Notify EDGE that Install Complete task was marked Complete */
  const notifyInstallComplete = useCallback((projectId: string, installDate: string) => {
    void sendToEdge('project.install_complete', projectId, {
      install_complete_date: installDate,
    })
    // Also sync full funding data since M2 just became eligible
    void syncFundingToEdge(projectId)
  }, [])

  /** Notify EDGE that PTO Received task was marked Complete */
  const notifyPTOReceived = useCallback((projectId: string, ptoDate: string) => {
    void sendToEdge('project.pto_received', projectId, {
      pto_date: ptoDate,
    })
    // Also sync full funding data since M3 just became eligible
    void syncFundingToEdge(projectId)
  }, [])

  /** Notify EDGE that project stage has changed */
  const notifyStageChanged = useCallback((projectId: string, oldStage: string, newStage: string) => {
    void sendToEdge('project.stage_changed', projectId, {
      old_stage: oldStage,
      new_stage: newStage,
    })
  }, [])

  /** Notify EDGE of a funding milestone update */
  const notifyFundingMilestone = useCallback((projectId: string, milestone: string, status: string) => {
    void sendToEdge('funding.milestone_updated', projectId, {
      milestone,
      status,
    })
  }, [])

  /** Notify EDGE that project is now In Service */
  const notifyInService = useCallback((projectId: string) => {
    void sendToEdge('project.in_service', projectId, {
      in_service_date: new Date().toISOString().slice(0, 10),
    })
  }, [])

  /** Generic send — for custom events */
  const send = useCallback((event: EdgeEventType, projectId: string, data: Record<string, unknown>) => {
    void sendToEdge(event, projectId, data)
  }, [])

  return {
    notifyInstallComplete,
    notifyPTOReceived,
    notifyStageChanged,
    notifyFundingMilestone,
    notifyInService,
    send,
  }
}

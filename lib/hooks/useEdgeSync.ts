'use client'

// Fire-and-forget EDGE webhook triggers — proxied through /api/edge-events
// so EDGE_WEBHOOK_SECRET stays server-side and HMAC signing always fires.
import { useCallback } from 'react'
import { sendEdgeEvent, syncEdgeFunding } from '@/lib/api/edge-events-client'
import type { EdgeEventType } from '@/lib/api/edge-sync'

export function useEdgeSync() {
  const notifyInstallComplete = useCallback((projectId: string, installDate: string) => {
    sendEdgeEvent('project.install_complete', projectId, { install_complete_date: installDate })
    syncEdgeFunding(projectId)
  }, [])

  const notifyPTOReceived = useCallback((projectId: string, ptoDate: string) => {
    sendEdgeEvent('project.pto_received', projectId, { pto_date: ptoDate })
    syncEdgeFunding(projectId)
  }, [])

  const notifyStageChanged = useCallback((projectId: string, oldStage: string, newStage: string) => {
    sendEdgeEvent('project.stage_changed', projectId, { old_stage: oldStage, new_stage: newStage })
  }, [])

  const notifyFundingMilestone = useCallback((projectId: string, milestone: string, status: string) => {
    sendEdgeEvent('funding.milestone_updated', projectId, { milestone, status })
  }, [])

  const notifyInService = useCallback((projectId: string) => {
    sendEdgeEvent('project.in_service', projectId, {
      in_service_date: new Date().toISOString().slice(0, 10),
    })
  }, [])

  const send = useCallback((event: EdgeEventType, projectId: string, data: Record<string, unknown>) => {
    sendEdgeEvent(event, projectId, data)
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

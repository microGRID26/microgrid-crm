import type { EdgeEventType } from './edge-sync'

export function sendEdgeEvent(event: EdgeEventType, projectId: string, data: Record<string, unknown>): void {
  void fetch('/api/edge-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, projectId, data }),
  }).catch((err) => console.error('[edge-events] send failed:', err))
}

export function syncEdgeFunding(projectId: string): void {
  void fetch('/api/edge-events/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, type: 'funding' }),
  }).catch((err) => console.error('[edge-events] sync funding failed:', err))
}

export function syncEdgeProject(projectId: string): Promise<boolean> {
  return fetch('/api/edge-events/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, type: 'project' }),
  })
    .then(res => res.ok)
    .catch(() => false)
}

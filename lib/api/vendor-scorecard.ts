// lib/api/vendor-scorecard.ts — Vendor performance scorecard calculations
// Aggregates metrics from engineering_assignments, work_orders, purchase_orders,
// and project_materials to score vendor performance on a 0–100 scale.

import { db } from '@/lib/db'

// ── Types ────────────────────────────────────────────────────────────────────

export interface VendorMetrics {
  avg_turnaround_days: number | null   // engineering: created_at → completed_at
  revision_rate: number | null         // engineering: avg revision_count
  completion_rate: number | null       // work orders: complete / total (%)
  avg_fulfillment_days: number | null  // POs: submitted_at → delivered_at
  total_assignments: number
  total_work_orders: number
  total_material_requests: number      // actually PO count for this vendor
}

export interface VendorScore {
  vendor_id: string
  vendor_name: string
  category: string
  metrics: VendorMetrics
  overall_score: number  // 0–100 composite
  trend: 'improving' | 'declining' | 'stable'
}

// ── Score helpers ────────────────────────────────────────────────────────────

/** Convert average turnaround days to a 0–100 score */
function scoreTurnaround(days: number): number {
  if (days <= 3) return 100
  if (days <= 7) return 80
  if (days <= 14) return 60
  if (days <= 21) return 40
  return 20
}

/** Convert average revision rate to a 0–100 score */
function scoreRevisionRate(rate: number): number {
  if (rate === 0) return 100
  if (rate <= 0.5) return 80
  if (rate <= 1) return 60
  return 40
}

/** Convert fulfillment days to a 0–100 score (same scale as turnaround) */
function scoreFulfillment(days: number): number {
  if (days <= 3) return 100
  if (days <= 7) return 80
  if (days <= 14) return 60
  if (days <= 21) return 40
  return 20
}

/** Weighted average of available metric scores. Nulls are skipped. */
function computeOverallScore(metrics: VendorMetrics): number {
  const parts: { score: number; weight: number }[] = []

  if (metrics.avg_turnaround_days !== null) {
    parts.push({ score: scoreTurnaround(metrics.avg_turnaround_days), weight: 3 })
  }
  if (metrics.revision_rate !== null) {
    parts.push({ score: scoreRevisionRate(metrics.revision_rate), weight: 2 })
  }
  if (metrics.completion_rate !== null) {
    parts.push({ score: metrics.completion_rate, weight: 3 })
  }
  if (metrics.avg_fulfillment_days !== null) {
    parts.push({ score: scoreFulfillment(metrics.avg_fulfillment_days), weight: 2 })
  }

  if (parts.length === 0) return 0

  const totalWeight = parts.reduce((s, p) => s + p.weight, 0)
  const weightedSum = parts.reduce((s, p) => s + p.score * p.weight, 0)
  return Math.round(weightedSum / totalWeight)
}

// ── Trend calculation ────────────────────────────────────────────────────────
// Compare last-30-day metrics against previous-30-day metrics for assignments

function computeTrend(
  recentAvgDays: number | null,
  olderAvgDays: number | null,
  recentRevRate: number | null,
  olderRevRate: number | null,
): 'improving' | 'declining' | 'stable' {
  let signals = 0 // positive = improving

  if (recentAvgDays !== null && olderAvgDays !== null) {
    if (recentAvgDays < olderAvgDays * 0.9) signals++
    else if (recentAvgDays > olderAvgDays * 1.1) signals--
  }

  if (recentRevRate !== null && olderRevRate !== null) {
    if (recentRevRate < olderRevRate * 0.9) signals++
    else if (recentRevRate > olderRevRate * 1.1) signals--
  }

  if (signals > 0) return 'improving'
  if (signals < 0) return 'declining'
  return 'stable'
}

// ── Main loader ──────────────────────────────────────────────────────────────

export async function loadVendorScores(): Promise<VendorScore[]> {
  const supabase = db()

  // 1. Load all active vendors
  const { data: vendors, error: vendorErr } = await supabase
    .from('vendors')
    .select('id, name, category')
    .eq('active', true)
    .order('name')
    .limit(2000)

  if (vendorErr) {
    console.error('[loadVendorScores] vendors:', vendorErr.message)
    return []
  }
  if (!vendors || vendors.length === 0) return []

  // 2. Load all engineering assignments (completed ones have metrics)
  const { data: assignments, error: assignErr } = await supabase
    .from('engineering_assignments')
    .select('id, assigned_org, status, revision_count, created_at, completed_at')
    .limit(5000)

  if (assignErr) console.error('[loadVendorScores] assignments:', assignErr.message)
  const allAssignments = (assignments ?? []) as {
    id: string; assigned_org: string; status: string; revision_count: number;
    created_at: string; completed_at: string | null
  }[]

  // 3. Load work orders (match to vendor via assigned_crew or assigned_to text)
  const { data: workOrders, error: woErr } = await supabase
    .from('work_orders')
    .select('id, type, status, assigned_crew, assigned_to, time_on_site_minutes, created_at, completed_at')
    .limit(5000)

  if (woErr) console.error('[loadVendorScores] work_orders:', woErr.message)
  const allWOs = (workOrders ?? []) as {
    id: string; type: string; status: string; assigned_crew: string | null;
    assigned_to: string | null; time_on_site_minutes: number | null;
    created_at: string; completed_at: string | null
  }[]

  // 4. Load purchase orders (vendor text field → vendor name matching)
  const { data: pos, error: poErr } = await supabase
    .from('purchase_orders')
    .select('id, vendor, status, created_at, submitted_at, delivered_at')
    .limit(5000)

  if (poErr) console.error('[loadVendorScores] purchase_orders:', poErr.message)
  const allPOs = (pos ?? []) as {
    id: string; vendor: string; status: string; created_at: string;
    submitted_at: string | null; delivered_at: string | null
  }[]

  // 5. Build lookup maps by vendor name (case-insensitive)
  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 86400000
  const sixtyDaysAgo = now - 60 * 86400000

  const scores: VendorScore[] = []

  for (const v of vendors as { id: string; name: string; category: string | null }[]) {
    const vNameLower = v.name.toLowerCase()

    // ── Engineering assignments: match on assigned_org containing vendor name
    const vendorAssignments = allAssignments.filter(
      a => a.assigned_org?.toLowerCase().includes(vNameLower) || vNameLower.includes(a.assigned_org?.toLowerCase() ?? '###')
    )

    const completedAssignments = vendorAssignments.filter(a => a.status === 'complete' && a.completed_at)

    let avgTurnaroundDays: number | null = null
    let revisionRate: number | null = null
    let recentAvgDays: number | null = null
    let olderAvgDays: number | null = null
    let recentRevRate: number | null = null
    let olderRevRate: number | null = null

    if (completedAssignments.length > 0) {
      // Overall turnaround
      const turnarounds = completedAssignments.map(a => {
        const start = new Date(a.created_at).getTime()
        const end = new Date(a.completed_at!).getTime()
        return Math.max(0, (end - start) / 86400000)
      })
      avgTurnaroundDays = Math.round((turnarounds.reduce((s, d) => s + d, 0) / turnarounds.length) * 10) / 10

      // Overall revision rate
      const totalRevisions = completedAssignments.reduce((s, a) => s + (a.revision_count || 0), 0)
      revisionRate = Math.round((totalRevisions / completedAssignments.length) * 100) / 100

      // Trend: recent 30 days vs previous 30 days
      const recentCompleted = completedAssignments.filter(a => new Date(a.completed_at!).getTime() >= thirtyDaysAgo)
      const olderCompleted = completedAssignments.filter(a => {
        const t = new Date(a.completed_at!).getTime()
        return t >= sixtyDaysAgo && t < thirtyDaysAgo
      })

      if (recentCompleted.length > 0) {
        const rt = recentCompleted.map(a => (new Date(a.completed_at!).getTime() - new Date(a.created_at).getTime()) / 86400000)
        recentAvgDays = rt.reduce((s, d) => s + d, 0) / rt.length
        recentRevRate = recentCompleted.reduce((s, a) => s + (a.revision_count || 0), 0) / recentCompleted.length
      }
      if (olderCompleted.length > 0) {
        const ot = olderCompleted.map(a => (new Date(a.completed_at!).getTime() - new Date(a.created_at).getTime()) / 86400000)
        olderAvgDays = ot.reduce((s, d) => s + d, 0) / ot.length
        olderRevRate = olderCompleted.reduce((s, a) => s + (a.revision_count || 0), 0) / olderCompleted.length
      }
    }

    // ── Work orders: match on assigned_crew or assigned_to containing vendor name
    const vendorWOs = allWOs.filter(
      wo => wo.assigned_crew?.toLowerCase().includes(vNameLower) ||
            wo.assigned_to?.toLowerCase().includes(vNameLower)
    )

    let completionRate: number | null = null
    if (vendorWOs.length > 0) {
      const completed = vendorWOs.filter(wo => wo.status === 'complete' || wo.status === 'completed')
      completionRate = Math.round((completed.length / vendorWOs.length) * 100)
    }

    // ── Purchase orders: match on vendor name
    const vendorPOs = allPOs.filter(
      po => po.vendor?.toLowerCase().includes(vNameLower) || vNameLower.includes(po.vendor?.toLowerCase() ?? '###')
    )

    let avgFulfillmentDays: number | null = null
    const deliveredPOs = vendorPOs.filter(po => po.delivered_at && po.submitted_at)
    if (deliveredPOs.length > 0) {
      const days = deliveredPOs.map(po => {
        const start = new Date(po.submitted_at!).getTime()
        const end = new Date(po.delivered_at!).getTime()
        return Math.max(0, (end - start) / 86400000)
      })
      avgFulfillmentDays = Math.round((days.reduce((s, d) => s + d, 0) / days.length) * 10) / 10
    }

    // ── Build metrics & score
    const metrics: VendorMetrics = {
      avg_turnaround_days: avgTurnaroundDays,
      revision_rate: revisionRate,
      completion_rate: completionRate,
      avg_fulfillment_days: avgFulfillmentDays,
      total_assignments: vendorAssignments.length,
      total_work_orders: vendorWOs.length,
      total_material_requests: vendorPOs.length,
    }

    const overall = computeOverallScore(metrics)
    const trend = computeTrend(recentAvgDays, olderAvgDays, recentRevRate, olderRevRate)

    scores.push({
      vendor_id: v.id,
      vendor_name: v.name,
      category: v.category ?? 'other',
      metrics,
      overall_score: overall,
      trend,
    })
  }

  // Sort by overall score descending
  scores.sort((a, b) => b.overall_score - a.overall_score)
  return scores
}

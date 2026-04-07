'use client'

import { useState, useEffect, useCallback } from 'react'
import { db } from '@/lib/db'
import {
  Activity, CheckCircle2, XCircle, Ban, SkipForward, Circle,
  ChevronDown, ChevronUp, Loader2,
} from 'lucide-react'

interface ActivityItem {
  id: string
  status: string
  tested_at: string
  tester_name: string
  case_title: string
}

const STATUS_META: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  pass:    { icon: CheckCircle2, color: 'text-emerald-500' },
  fail:    { icon: XCircle,      color: 'text-red-500' },
  blocked: { icon: Ban,          color: 'text-amber-500' },
  skipped: { icon: SkipForward,  color: 'text-gray-500' },
  pending: { icon: Circle,       color: 'text-gray-500' },
}

function statusVerb(status: string): string {
  switch (status) {
    case 'pass': return 'passed'
    case 'fail': return 'failed'
    case 'blocked': return 'blocked'
    case 'skipped': return 'skipped'
    default: return 'tested'
  }
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffSec = Math.floor((now - then) / 1000)
  if (diffSec < 10) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}

export function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchActivity = useCallback(async () => {
    try {
      const { data } = await db()
        .from('test_results')
        .select(`
          id, status, tested_at,
          tester:users!test_results_tester_id_fkey ( name ),
          test_case:test_cases!test_results_test_case_id_fkey ( title )
        `)
        .neq('status', 'pending')
        .order('tested_at', { ascending: false })
        .limit(20)

      if (data) {
        const items: ActivityItem[] = data.map((row: Record<string, unknown>) => {
          const tester = row.tester as { name: string } | null
          const testCase = row.test_case as { title: string } | null
          return {
            id: row.id as string,
            status: row.status as string,
            tested_at: row.tested_at as string,
            tester_name: tester?.name ?? 'Unknown',
            case_title: testCase?.title ?? 'Unknown test',
          }
        })
        setActivities(items)
      }
    } catch (err) {
      console.error('Activity feed error:', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchActivity()
    const interval = setInterval(fetchActivity, 30_000)
    return () => clearInterval(interval)
  }, [fetchActivity])

  return (
    <div className="mt-8 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-semibold text-white">Team Activity</h3>
          {activities.length > 0 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400">
              {activities.length}
            </span>
          )}
        </div>
        {collapsed
          ? <ChevronDown className="w-4 h-4 text-gray-500" />
          : <ChevronUp className="w-4 h-4 text-gray-500" />}
      </button>

      {!collapsed && (
        <div className="border-t border-gray-700 max-h-[280px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
            </div>
          ) : activities.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-gray-500 text-sm">No team activity yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700/50">
              {activities.map(item => {
                const meta = STATUS_META[item.status] ?? STATUS_META.pending
                const Icon = meta.icon
                return (
                  <div key={item.id} className="flex items-center gap-3 px-5 py-2.5">
                    <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${meta.color}`} />
                    <p className="flex-1 text-sm text-gray-300 truncate">
                      <span className="font-medium text-white">{item.tester_name}</span>
                      {' '}{statusVerb(item.status)}{' '}
                      <span className="text-gray-500">&ldquo;{item.case_title}&rdquo;</span>
                    </p>
                    <span className="text-[11px] text-gray-500 whitespace-nowrap flex-shrink-0">
                      {relativeTime(item.tested_at)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

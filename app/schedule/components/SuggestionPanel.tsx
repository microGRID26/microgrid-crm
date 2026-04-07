'use client'

import { useEffect, useState, useCallback } from 'react'
import { db } from '@/lib/db'
import { generateScheduleSuggestions, type ScheduleSuggestion } from '@/lib/api/schedule-suggestions'
import { cn } from '@/lib/utils'
import { handleApiError } from '@/lib/errors'

const TASK_LABELS: Record<string, string> = {
  install: 'Installation',
  inspection: 'Inspection',
  survey: 'Site Survey',
}

const TASK_BADGE_COLORS: Record<string, string> = {
  install:    'bg-green-900/60 text-green-300',
  inspection: 'bg-amber-900/60 text-amber-300',
  survey:     'bg-blue-900/60  text-blue-300',
}

const JOB_TYPE_MAP: Record<string, string> = {
  install:    'install',
  inspection: 'inspection',
  survey:     'survey',
}

interface SuggestionPanelProps {
  onScheduled?: () => void
  orgId?: string
}

export function SuggestionPanel({ onScheduled, orgId }: SuggestionPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [suggestions, setSuggestions] = useState<ScheduleSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [scheduling, setScheduling] = useState<string | null>(null) // project_id being scheduled
  const [error, setError] = useState<string | null>(null)

  const loadSuggestions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const results = await generateScheduleSuggestions(orgId)
      setSuggestions(results)
    } catch (err) {
      handleApiError(err, '[SuggestionPanel] load')
      setError('Failed to load suggestions')
    }
    setLoading(false)
  }, [orgId])

  // Load when panel is first expanded
  useEffect(() => {
    if (expanded && suggestions.length === 0 && !loading) {
      loadSuggestions()
    }
  }, [expanded, suggestions.length, loading, loadSuggestions])

  async function handleSchedule(suggestion: ScheduleSuggestion) {
    if (!suggestion.suggested_crew || !suggestion.suggested_date) return

    const confirmed = window.confirm(
      `Schedule ${suggestion.project_name} for ${TASK_LABELS[suggestion.task_type] ?? suggestion.task_type} on ${
        new Date(suggestion.suggested_date + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric',
        })
      } with ${suggestion.suggested_crew_name ?? 'crew'}?`
    )
    if (!confirmed) return

    setScheduling(suggestion.project_id)
    try {
      const { error: insertErr } = await db().from('schedule').insert({
        project_id: suggestion.project_id,
        crew_id: suggestion.suggested_crew,
        job_type: JOB_TYPE_MAP[suggestion.task_type] ?? suggestion.task_type,
        date: suggestion.suggested_date,
        status: 'scheduled',
        notes: `Auto-suggested (proximity: ${suggestion.proximity_score})`,
      })
      if (insertErr) {
        handleApiError(insertErr, '[SuggestionPanel] schedule insert')
      } else {
        // Remove from list
        setSuggestions(prev => prev.filter(s => s.project_id !== suggestion.project_id))
        onScheduled?.()
      }
    } catch (err) {
      handleApiError(err, '[SuggestionPanel] schedule')
    }
    setScheduling(null)
  }

  function proximityBar(score: number) {
    const width = Math.min(100, Math.max(0, score))
    const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-gray-500'
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full', color)} style={{ width: `${width}%` }} />
        </div>
        <span className="text-[10px] text-gray-400">{score}</span>
      </div>
    )
  }

  return (
    <div className="no-print border-b border-gray-800">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={cn('w-3 h-3 text-gray-400 transition-transform', expanded && 'rotate-90')}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs font-medium text-gray-300">Schedule Suggestions</span>
          {suggestions.length > 0 && (
            <span className="text-[10px] bg-green-900/60 text-green-300 px-1.5 py-0.5 rounded-full">
              {suggestions.length}
            </span>
          )}
        </div>
        {expanded && (
          <button
            onClick={e => { e.stopPropagation(); loadSuggestions() }}
            className="text-[10px] text-gray-500 hover:text-gray-300"
          >
            Refresh
          </button>
        )}
      </button>

      {/* Collapsible content */}
      {expanded && (
        <div className="px-4 pb-3">
          {loading && (
            <div className="text-xs text-green-400 animate-pulse py-2">Analyzing projects and crew availability...</div>
          )}

          {error && (
            <div className="text-xs text-red-400 py-2">{error}</div>
          )}

          {!loading && !error && suggestions.length === 0 && (
            <div className="text-xs text-gray-500 py-2">
              No projects ready for scheduling, or all ready projects are already scheduled.
            </div>
          )}

          {!loading && suggestions.length > 0 && (
            <div className="grid gap-2 max-h-64 overflow-y-auto">
              {suggestions.map(s => (
                <div
                  key={`${s.project_id}-${s.task_type}`}
                  className="flex items-center gap-3 bg-gray-800/60 rounded-lg px-3 py-2 hover:bg-gray-800 transition-colors"
                >
                  {/* Task type badge */}
                  <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded', TASK_BADGE_COLORS[s.task_type])}>
                    {TASK_LABELS[s.task_type] ?? s.task_type}
                  </span>

                  {/* Project info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate">{s.project_name}</div>
                    <div className="text-[10px] text-gray-400 truncate">
                      {[s.city, s.zip, s.systemkw ? `${s.systemkw} kW` : null].filter(Boolean).join(' · ')}
                    </div>
                  </div>

                  {/* Suggested crew + date */}
                  <div className="text-right shrink-0">
                    <div className="text-xs text-gray-200">{s.suggested_crew_name ?? 'Any crew'}</div>
                    <div className="text-[10px] text-gray-400">
                      {new Date(s.suggested_date + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric',
                      })}
                    </div>
                  </div>

                  {/* Proximity score */}
                  <div className="shrink-0 w-24">
                    {proximityBar(s.proximity_score)}
                    <div className="text-[10px] text-gray-500 truncate mt-0.5" title={s.reason}>
                      {s.reason.split(' — ')[1] ?? s.reason}
                    </div>
                  </div>

                  {/* Schedule button */}
                  <button
                    onClick={() => handleSchedule(s)}
                    disabled={scheduling === s.project_id}
                    className="shrink-0 text-xs font-medium text-green-400 hover:text-green-300 bg-green-900/30 hover:bg-green-900/50 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                  >
                    {scheduling === s.project_id ? '...' : 'Schedule'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Nav } from '@/components/Nav'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { useOrg } from '@/lib/hooks'
import { fmtDate, fmt$, cn, STAGE_LABELS } from '@/lib/utils'
import { loadProjectById } from '@/lib/api'
import { db } from '@/lib/db'
import { ProjectPanel } from '@/components/project/ProjectPanel'
import type { Project } from '@/types/database'
import {
  classifyTier, haversineDistance, estimateDriveMinutes,
  computeReadinessScore, computePriorityScore, optimizeRoute,
  getMonday, getWeekLabel, getNextWeeks,
  loadRampConfig, loadAllReadiness, loadAllSchedule, loadScheduledProjectIds,
  scheduleProject, updateScheduleEntry, completeScheduleEntry, cancelScheduleEntry,
  upsertReadiness,
  TIER_INFO, RAMP_STATUS_COLORS,
} from '@/lib/api/ramp-planner'
import type { Tier, RampConfig, ProjectReadiness, RampScheduleEntry, RoutePoint } from '@/lib/api/ramp-planner'
import { Calendar, MapPin, Truck, ChevronLeft, ChevronRight, Check, X, Zap, AlertTriangle, Target } from 'lucide-react'

// ── Zip geocode cache (reused from map page) ─────────────────────────────────
const zipCache = new Map<string, [number, number]>()
async function geocodeZip(zip: string): Promise<[number, number] | null> {
  if (zipCache.has(zip)) return zipCache.get(zip)!
  try {
    const resp = await fetch(`https://api.zippopotam.us/us/${zip}`)
    if (!resp.ok) return null
    const data = await resp.json()
    const lat = parseFloat(data.places?.[0]?.latitude)
    const lng = parseFloat(data.places?.[0]?.longitude)
    if (isNaN(lat) || isNaN(lng)) return null
    zipCache.set(zip, [lat, lng])
    return [lat, lng]
  } catch { return null }
}

// ── Project with computed fields ─────────────────────────────────────────────
interface RampProject {
  id: string; name: string; city: string | null; address: string | null; zip: string | null
  ahj: string | null; stage: string; module: string | null; inverter: string | null; battery: string | null
  systemkw: number | null; contract: number | null; pm: string | null; blocker: string | null
  tier: Tier; lat: number; lng: number
  distanceMiles: number; driveMinutes: number
  readiness: ProjectReadiness | null; readinessScore: number
  priorityScore: number
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function RampUpPage() {
  const { user, loading: authLoading } = useCurrentUser()
  const isManager = user?.isManager ?? false
  const { orgId } = useOrg()

  const [projects, setProjects] = useState<RampProject[]>([])
  const [schedule, setSchedule] = useState<RampScheduleEntry[]>([])
  const [scheduledIds, setScheduledIds] = useState<Set<string>>(new Set())
  const [config, setConfig] = useState<RampConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedWeek, setSelectedWeek] = useState(getMonday(new Date()))
  const [panelProject, setPanelProject] = useState<Project | null>(null)
  const [tab, setTab] = useState<'planner' | 'queue' | 'timeline'>('planner')

  // Load everything
  const loadAll = useCallback(async () => {
    setLoading(true)
    const [cfg, readinessMap, sched, schedIds] = await Promise.all([
      loadRampConfig(),
      loadAllReadiness(),
      loadAllSchedule(),
      loadScheduledProjectIds(),
    ])
    setConfig(cfg)
    setSchedule(sched)
    setScheduledIds(schedIds)

    // Load install + inspection stage projects
    let q = db().from('projects')
      .select('id, name, city, address, zip, ahj, stage, module, inverter, battery, systemkw, contract, pm, blocker')
      .in('stage', ['install', 'inspection'])
      .not('disposition', 'in', '("In Service","Loyalty","Cancelled")')
      .limit(2000)
    if (orgId) q = q.eq('org_id', orgId)
    const { data: rawProjects } = await q

    if (!rawProjects || !cfg) { setLoading(false); return }

    // Geocode all zips
    const zips = [...new Set((rawProjects as any[]).map(p => p.zip).filter(Boolean))]
    await Promise.all(zips.map(z => geocodeZip(z)))

    // Compute all fields
    const maxContract = Math.max(...(rawProjects as any[]).map(p => Number(p.contract) || 0), 1)
    const allMapped: RampProject[] = []

    // First pass: compute distances
    for (const p of rawProjects as any[]) {
      if (!p.zip) continue
      const coords = zipCache.get(p.zip)
      if (!coords) continue

      const tier = classifyTier(p.ahj, p.module, p.inverter, p.battery)
      const dist = haversineDistance(cfg.warehouse_lat, cfg.warehouse_lng, coords[0], coords[1])
      const readiness = readinessMap.get(p.id) ?? null
      const readinessScore = readiness ? computeReadinessScore(readiness) : (tier === 1 ? 60 : 0)

      allMapped.push({
        ...p,
        tier,
        lat: coords[0],
        lng: coords[1],
        distanceMiles: Math.round(dist * 10) / 10,
        driveMinutes: estimateDriveMinutes(dist),
        readiness,
        readinessScore,
        priorityScore: 0, // computed below
      })
    }

    // Second pass: compute priority scores with cluster counts
    const zipCounts = new Map<string, number>()
    for (const p of allMapped) {
      if (p.zip) zipCounts.set(p.zip, (zipCounts.get(p.zip) ?? 0) + 1)
    }
    const maxDist = Math.max(...allMapped.map(p => p.distanceMiles), 1)

    for (const p of allMapped) {
      p.priorityScore = Math.round(computePriorityScore(
        p.readinessScore,
        p.distanceMiles,
        zipCounts.get(p.zip ?? '') ?? 0,
        Number(p.contract) || 0,
        maxDist,
        maxContract,
        { readiness: cfg.weight_readiness, proximity: cfg.weight_proximity, cluster: cfg.weight_cluster, value: cfg.weight_value }
      ) * 10) / 10
    }

    allMapped.sort((a, b) => b.priorityScore - a.priorityScore)
    setProjects(allMapped)
    setLoading(false)
  }, [orgId])

  useEffect(() => { loadAll() }, [loadAll])

  // Derived data
  const tierCounts = useMemo(() => {
    const counts = { 1: { count: 0, value: 0 }, 2: { count: 0, value: 0 }, 3: { count: 0, value: 0 }, 4: { count: 0, value: 0 } }
    for (const p of projects) {
      counts[p.tier].count++
      counts[p.tier].value += Number(p.contract) || 0
    }
    return counts
  }, [projects])

  const unscheduled = useMemo(() => projects.filter(p => !scheduledIds.has(p.id)), [projects, scheduledIds])
  const weekSchedule = useMemo(() => schedule.filter(s => s.scheduled_week === selectedWeek && s.status !== 'cancelled'), [schedule, selectedWeek])
  const weeks = useMemo(() => getNextWeeks(16), [])

  // Auto-suggest top projects for the week
  const suggestions = useMemo(() => {
    if (!config) return []
    const slotsNeeded = config.crews_count * config.installs_per_crew_per_week
    const weekAlready = weekSchedule.length
    const remaining = slotsNeeded - weekAlready
    if (remaining <= 0) return []
    return unscheduled.filter(p => p.tier === 1).slice(0, Math.max(remaining * 2, 8))
  }, [unscheduled, config, weekSchedule])

  // Handlers
  const handleSchedule = async (projectId: string, crewName: string, slot: number) => {
    const project = projects.find(p => p.id === projectId)
    await scheduleProject({
      project_id: projectId,
      crew_name: crewName,
      scheduled_week: selectedWeek,
      slot,
      status: 'planned',
      priority_score: project?.priorityScore ?? 0,
      distance_miles: project?.distanceMiles ?? null,
      drive_minutes: project?.driveMinutes ?? null,
      created_by: user?.name,
    })
    loadAll()
  }

  const handleComplete = async (id: string) => {
    await completeScheduleEntry(id)
    loadAll()
  }

  const handleCancel = async (id: string) => {
    const reason = prompt('Reason for cancellation:')
    if (reason === null) return
    await cancelScheduleEntry(id, reason)
    loadAll()
  }

  const handleReadinessToggle = async (projectId: string, field: string, current: boolean) => {
    const readiness = projects.find(p => p.id === projectId)?.readiness ?? {}
    await upsertReadiness(projectId, { ...readiness, [field]: !current } as any, user?.name)
    loadAll()
  }

  const openProject = async (id: string) => {
    const p = await loadProjectById(id)
    if (p) setPanelProject(p)
  }

  // Week navigation
  const weekIdx = weeks.indexOf(selectedWeek)
  const prevWeek = () => { if (weekIdx > 0) setSelectedWeek(weeks[weekIdx - 1]) }
  const nextWeek = () => { if (weekIdx < weeks.length - 1) setSelectedWeek(weeks[weekIdx + 1]) }

  // Route for the week
  const weekRoute = useMemo(() => {
    if (!config || weekSchedule.length === 0) return null
    const points: RoutePoint[] = weekSchedule.map(s => {
      const p = projects.find(pr => pr.id === s.project_id)
      return p ? { id: p.id, lat: p.lat, lng: p.lng, label: `${p.name} (${p.id})` } : null
    }).filter(Boolean) as RoutePoint[]
    if (points.length === 0) return null
    return optimizeRoute({ lat: config.warehouse_lat, lng: config.warehouse_lng }, points)
  }, [weekSchedule, projects, config])

  if (authLoading) return <div className="min-h-screen bg-gray-950"><Nav active="Ramp-Up" /></div>
  if (!isManager) return <div className="min-h-screen bg-gray-950"><Nav active="Ramp-Up" /><div className="max-w-7xl mx-auto px-4 py-20 text-center text-gray-500">Not authorized.</div></div>

  const TIER_COLORS = { 1: 'border-green-500', 2: 'border-amber-500', 3: 'border-blue-500', 4: 'border-red-500' }
  const TIER_BG = { 1: 'bg-green-900/20', 2: 'bg-amber-900/20', 3: 'bg-blue-900/20', 4: 'bg-red-900/20' }
  const TIER_TEXT = { 1: 'text-green-400', 2: 'text-amber-400', 3: 'text-blue-400', 4: 'text-red-400' }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Nav active="Ramp-Up" />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><Target className="w-5 h-5 text-green-400" /> Install Ramp-Up Planner</h1>
            <p className="text-xs text-gray-500 mt-1">
              {config ? `${config.crews_count} crews × ${config.installs_per_crew_per_week} installs/week = ${config.crews_count * config.installs_per_crew_per_week} installs/week` : 'Loading...'}
              {config && <span className="ml-2 text-gray-600">| Warehouse: {config.warehouse_address}</span>}
            </p>
          </div>
        </div>

        {/* Tier Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {([1, 2, 3, 4] as Tier[]).map(tier => (
            <div key={tier} className={cn('rounded-lg p-3 border', TIER_COLORS[tier], TIER_BG[tier])}>
              <div className="flex items-center justify-between">
                <span className={cn('text-xs font-semibold', TIER_TEXT[tier])}>Tier {tier}: {TIER_INFO[tier].label}</span>
                <span className="text-lg font-bold text-white">{tierCounts[tier].count}</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-1">{TIER_INFO[tier].description}</div>
              <div className="text-xs text-gray-300 mt-1">{fmt$(tierCounts[tier].value)}</div>
              {TIER_INFO[tier].blockers.length > 0 && (
                <div className="text-[9px] text-gray-500 mt-1">{TIER_INFO[tier].blockers[0]}</div>
              )}
            </div>
          ))}
        </div>

        {/* Tab Bar */}
        <div className="flex gap-4 border-b border-gray-700">
          {([
            { key: 'planner', label: 'Week Planner', icon: <Calendar className="w-3.5 h-3.5" /> },
            { key: 'queue', label: `Readiness Queue (${unscheduled.filter(p => p.tier === 1).length} Tier 1)`, icon: <Zap className="w-3.5 h-3.5" /> },
            { key: 'timeline', label: '30/60/90 Timeline', icon: <Truck className="w-3.5 h-3.5" /> },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('flex items-center gap-1.5 text-xs pb-2 border-b-2 transition-colors',
                tab === t.key ? 'text-white border-green-500' : 'text-gray-500 border-transparent hover:text-gray-300')}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── WEEK PLANNER TAB ──────────────────────────────────────────── */}
        {tab === 'planner' && (
          <div className="space-y-4">
            {/* Week selector */}
            <div className="flex items-center gap-3">
              <button onClick={prevWeek} disabled={weekIdx <= 0} className="p-1 text-gray-400 hover:text-white disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm font-semibold text-white min-w-[180px] text-center">{getWeekLabel(selectedWeek)}</span>
              <button onClick={nextWeek} disabled={weekIdx >= weeks.length - 1} className="p-1 text-gray-400 hover:text-white disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
              <span className="text-[10px] text-gray-500">Week {weekIdx + 1} of {weeks.length}</span>
              <span className="text-[10px] text-gray-500 ml-auto">{weekSchedule.length} / {(config?.crews_count ?? 2) * (config?.installs_per_crew_per_week ?? 2)} slots filled</span>
            </div>

            {/* Crew schedules */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['Crew A', 'Crew B'].map(crew => {
                const crewJobs = weekSchedule.filter(s => s.crew_name === crew)
                return (
                  <div key={crew} className="bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Truck className="w-4 h-4 text-gray-400" /> {crew}</h3>
                      <span className="text-[10px] text-gray-500">{crewJobs.length} / {config?.installs_per_crew_per_week ?? 2} jobs</span>
                    </div>
                    {[1, 2].map(slot => {
                      const job = crewJobs.find(j => j.slot === slot)
                      const project = job ? projects.find(p => p.id === job.project_id) : null
                      return (
                        <div key={slot} className={cn('border rounded-lg p-3 mb-2', job ? 'border-gray-700 bg-gray-900/50' : 'border-dashed border-gray-700 bg-gray-900/20')}>
                          <div className="text-[10px] text-gray-500 mb-1">Job {slot}</div>
                          {job && project ? (
                            <div>
                              <div className="flex items-center justify-between">
                                <button onClick={() => openProject(project.id)} className="text-sm font-medium text-white hover:text-green-400">{project.name}</button>
                                <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-medium', RAMP_STATUS_COLORS[job.status])}>{job.status}</span>
                              </div>
                              <div className="text-[10px] text-gray-400 mt-1">
                                {project.id} · {project.city} · {project.distanceMiles}mi · ~{project.driveMinutes}min drive
                              </div>
                              <div className="text-[10px] text-gray-500 mt-0.5">
                                {project.systemkw}kW · {fmt$(Number(project.contract) || 0)} · Tier {project.tier}
                              </div>
                              <div className="flex gap-2 mt-2">
                                {job.status === 'planned' && (
                                  <button onClick={() => updateScheduleEntry(job.id, { status: 'confirmed' }).then(loadAll)}
                                    className="text-[10px] px-2 py-0.5 bg-indigo-900/40 text-indigo-400 rounded hover:opacity-80">Confirm</button>
                                )}
                                {(job.status === 'planned' || job.status === 'confirmed') && (
                                  <button onClick={() => handleComplete(job.id)}
                                    className="text-[10px] px-2 py-0.5 bg-green-900/40 text-green-400 rounded hover:opacity-80"><Check className="w-3 h-3 inline" /> Complete</button>
                                )}
                                <button onClick={() => handleCancel(job.id)}
                                  className="text-[10px] px-2 py-0.5 bg-red-900/40 text-red-400 rounded hover:opacity-80"><X className="w-3 h-3 inline" /> Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-600">
                              Empty slot — assign from suggestions below
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* Route Summary */}
            {weekRoute && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Week Route Summary</h4>
                <div className="flex gap-6 text-xs">
                  <div><span className="text-gray-500">Total Distance:</span> <span className="text-white font-medium">{weekRoute.totalMiles} mi</span></div>
                  <div><span className="text-gray-500">Total Drive Time:</span> <span className="text-white font-medium">{Math.round(weekRoute.totalMinutes / 60 * 10) / 10} hrs</span></div>
                  <div><span className="text-gray-500">Stops:</span> <span className="text-white font-medium">{weekRoute.ordered.length}</span></div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-500 flex-wrap">
                  {weekRoute.legs.map((leg, i) => (
                    <React.Fragment key={i}>
                      <span className={leg.from === 'Warehouse' || leg.to === 'Warehouse' ? 'text-amber-400' : 'text-gray-300'}>{leg.from === 'Warehouse' ? '🏭' : ''}{leg.from.slice(0, 20)}</span>
                      <span className="text-gray-600">→ {leg.miles}mi</span>
                    </React.Fragment>
                  ))}
                  <span className="text-amber-400">🏭 Warehouse</span>
                </div>
              </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Suggested Projects (Tier 1, sorted by priority score)</h4>
                <div className="space-y-2">
                  {suggestions.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-gray-900/50 rounded-lg px-3 py-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openProject(p.id)} className="text-xs font-medium text-white hover:text-green-400">{p.name}</button>
                          <span className="text-[10px] text-green-400 font-mono">{p.id}</span>
                          <span className={cn('text-[9px] px-1.5 py-0.5 rounded', TIER_BG[p.tier], TIER_TEXT[p.tier])}>T{p.tier}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {p.city} · {p.distanceMiles}mi · ~{p.driveMinutes}min · {p.systemkw}kW · {fmt$(Number(p.contract) || 0)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs font-bold text-green-400">{p.priorityScore}</div>
                          <div className="text-[9px] text-gray-500">score</div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => handleSchedule(p.id, 'Crew A', (weekSchedule.filter(s => s.crew_name === 'Crew A').length) + 1)}
                            className="text-[10px] px-2 py-1 bg-green-900/40 text-green-400 rounded hover:opacity-80">+ Crew A</button>
                          <button onClick={() => handleSchedule(p.id, 'Crew B', (weekSchedule.filter(s => s.crew_name === 'Crew B').length) + 1)}
                            className="text-[10px] px-2 py-1 bg-blue-900/40 text-blue-400 rounded hover:opacity-80">+ Crew B</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── READINESS QUEUE TAB ───────────────────────────────────────── */}
        {tab === 'queue' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Tier 1 projects sorted by priority score. Toggle readiness items to update scores.</p>
            {unscheduled.filter(p => p.tier === 1).map(p => (
              <div key={p.id} className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <button onClick={() => openProject(p.id)} className="text-sm font-medium text-white hover:text-green-400">{p.name}</button>
                    <span className="text-[10px] text-green-400 font-mono ml-2">{p.id}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-400">{p.priorityScore}</div>
                    <div className="text-[9px] text-gray-500">priority score</div>
                  </div>
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                  {p.city} · {p.distanceMiles}mi from warehouse · {p.systemkw}kW · {fmt$(Number(p.contract) || 0)} · AHJ: {p.ahj}
                </div>
                {/* Readiness checklist */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {[
                    { key: 'equipment_ready', label: 'Equipment' },
                    { key: 'homeowner_confirmed', label: 'Homeowner' },
                    { key: 'permit_clear', label: 'Permit' },
                    { key: 'utility_approved', label: 'Utility' },
                    { key: 'hoa_approved', label: 'HOA' },
                    { key: 'redesign_complete', label: 'Redesign' },
                    { key: 'crew_available', label: 'Crew' },
                  ].map(item => {
                    const checked = (p.readiness as any)?.[item.key] ?? false
                    return (
                      <button key={item.key} onClick={() => handleReadinessToggle(p.id, item.key, checked)}
                        className={cn('text-[10px] px-2 py-0.5 rounded border transition-colors',
                          checked ? 'bg-green-900/40 border-green-700 text-green-400' : 'bg-gray-900 border-gray-700 text-gray-500 hover:text-gray-300')}>
                        {checked && <Check className="w-2.5 h-2.5 inline mr-0.5" />}{item.label}
                      </button>
                    )
                  })}
                  <span className="text-[10px] text-gray-600 ml-auto">Readiness: {p.readinessScore}/100</span>
                </div>
              </div>
            ))}
            {unscheduled.filter(p => p.tier === 1).length === 0 && (
              <div className="text-center py-12 text-gray-500 text-sm">All Tier 1 projects are scheduled.</div>
            )}
          </div>
        )}

        {/* ── TIMELINE TAB ──────────────────────────────────────────────── */}
        {tab === 'timeline' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">Rolling 16-week view. Auto-updates as projects complete.</p>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="grid grid-cols-1 gap-1">
                {weeks.map((week, i) => {
                  const weekJobs = schedule.filter(s => s.scheduled_week === week && s.status !== 'cancelled')
                  const completed = weekJobs.filter(s => s.status === 'completed').length
                  const planned = weekJobs.length
                  const target = (config?.crews_count ?? 2) * (config?.installs_per_crew_per_week ?? 2)
                  const revenue = weekJobs.reduce((sum, s) => {
                    const p = projects.find(pr => pr.id === s.project_id)
                    return sum + (Number(p?.contract) || 0)
                  }, 0)
                  const isCurrentWeek = week === getMonday(new Date())
                  const isPast = new Date(week) < new Date(getMonday(new Date()))

                  return (
                    <div key={week}
                      onClick={() => { setSelectedWeek(week); setTab('planner') }}
                      className={cn('flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors',
                        isCurrentWeek ? 'bg-green-900/20 border border-green-700/50' : 'hover:bg-gray-700/30',
                        selectedWeek === week && 'ring-1 ring-green-500/50')}>
                      <span className="text-[10px] text-gray-500 w-16 flex-shrink-0">Wk {i + 1}</span>
                      <span className="text-xs text-gray-300 w-32 flex-shrink-0">{getWeekLabel(week)}</span>
                      {/* Progress bar */}
                      <div className="flex-1 h-4 bg-gray-900 rounded-full overflow-hidden flex">
                        {completed > 0 && <div className="bg-green-600 h-full" style={{ width: `${completed / target * 100}%` }} />}
                        {planned > completed && <div className="bg-blue-600/50 h-full" style={{ width: `${(planned - completed) / target * 100}%` }} />}
                      </div>
                      <span className="text-[10px] text-gray-400 w-16 text-right">{planned}/{target} jobs</span>
                      <span className="text-[10px] text-green-400 w-20 text-right">{revenue > 0 ? fmt$(revenue) : '—'}</span>
                      {isCurrentWeek && <span className="text-[9px] text-green-400 font-medium">THIS WEEK</span>}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Revenue forecast */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '30-Day Forecast', weeks: 4 },
                { label: '60-Day Forecast', weeks: 8 },
                { label: '90-Day Forecast', weeks: 12 },
              ].map(period => {
                const periodWeeks = weeks.slice(0, period.weeks)
                const periodJobs = schedule.filter(s => periodWeeks.includes(s.scheduled_week) && s.status !== 'cancelled')
                const periodRevenue = periodJobs.reduce((sum, s) => {
                  const p = projects.find(pr => pr.id === s.project_id)
                  return sum + (Number(p?.contract) || 0)
                }, 0)
                return (
                  <div key={period.label} className="bg-gray-800 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-gray-500 uppercase">{period.label}</div>
                    <div className="text-lg font-bold text-green-400 mt-1">{periodJobs.length} installs</div>
                    <div className="text-xs text-gray-300">{fmt$(periodRevenue)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Project Panel */}
      {panelProject && (
        <ProjectPanel project={panelProject} onClose={() => setPanelProject(null)} onProjectUpdated={() => {}} />
      )}
    </div>
  )
}

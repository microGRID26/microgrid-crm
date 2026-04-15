'use client'

import { fmt$ } from '@/lib/utils'

interface PipelineStage { stage: string; count: number; value: number; label: string; color: string }

interface LeadershipTabProps {
  stats: {
    totalProjects: number
    totalValue: number
    pipeline: PipelineStage[]
    ahjCount: number
    legacyRecordsCount: number
  }
  maxCount: number
}

export function LeadershipTab({ stats, maxCount }: LeadershipTabProps) {
  return (
    <div className="space-y-8 md:space-y-14">

      {/* HERO — The number */}
      <div className="text-center py-6 md:py-12 relative">
        <div className="absolute inset-0 rounded-3xl" style={{ background: 'radial-gradient(ellipse at center, rgba(29,158,117,0.08) 0%, transparent 70%)' }} />
        <div className="animate-count text-4xl md:text-7xl font-black text-green-400 print:text-green-700 tracking-tight drop-shadow-[0_0_30px_rgba(29,158,117,0.3)]">
          {fmt$(stats.totalValue)}
        </div>
        <div className="animate-count text-base md:text-xl text-gray-300 mt-2 md:mt-3 print:text-gray-700" style={{ animationDelay: '0.2s' }}>
          Portfolio Under Management
        </div>
        <div className="animate-count text-xs md:text-sm text-gray-500 mt-1 md:mt-2" style={{ animationDelay: '0.4s' }}>
          {stats.totalProjects.toLocaleString()} active projects · 7 automated pipeline stages · {stats.legacyRecordsCount.toLocaleString()} legacy records preserved
        </div>
      </div>

      {/* PIPELINE FUNNEL — Full width, tall bars */}
      <div>
        <h2 className="text-xs text-gray-500 uppercase tracking-wider mb-4 font-semibold">Pipeline Breakdown</h2>
        <div className="space-y-2">
          {stats.pipeline.map(s => (
            <div key={s.stage} className="flex items-center gap-2 md:gap-3">
              <div className="w-16 md:w-24 text-right flex-shrink-0">
                <div className="text-[10px] md:text-xs font-bold" style={{ color: s.color }}>{s.label}</div>
              </div>
              <div className="flex-1">
                <div className="h-10 md:h-14 rounded-lg bg-gray-800/50 print:bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-lg flex items-center justify-between px-2 md:px-4 animate-grow animate-pulse-glow"
                    style={{ width: `${Math.max((s.count / maxCount) * 100, 15)}%`, backgroundColor: `${s.color}15`, borderLeft: `4px solid ${s.color}`, boxShadow: `inset 0 0 30px ${s.color}10` }}>
                    <span className="text-[10px] md:text-sm font-bold print:text-black">{s.count}</span>
                    <span className="text-[10px] md:text-sm font-bold text-green-400 print:text-green-700 hidden sm:inline">{fmt$(s.value)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* THE STORY — 3 panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-6 print:bg-red-50 print:border-red-200 animate-slide animate-slide-1">
          <div className="text-red-400 text-xs font-bold uppercase tracking-wider mb-2">The Challenge</div>
          <p className="text-sm text-gray-300 print:text-gray-700">Managing 900+ solar installations across multiple crews, 1,633 permit authorities, and complex funding milestones with spreadsheets doesn't scale. Projects fall through cracks. Revenue gets delayed.</p>
        </div>
        <div className="bg-blue-950/20 border border-blue-900/30 rounded-xl p-6 print:bg-blue-50 print:border-blue-200 animate-slide animate-slide-2">
          <div className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">The Solution</div>
          <p className="text-sm text-gray-300 print:text-gray-700">Purpose-built platform with automated 7-stage pipeline, real-time crew scheduling with route optimization, integrated ticketing, and AI-powered data access. Every action is tracked, every milestone triggers the next.</p>
        </div>
        <div className="bg-green-950/20 border border-green-900/30 rounded-xl p-6 print:bg-green-50 print:border-green-200 animate-slide animate-slide-3">
          <div className="text-green-400 text-xs font-bold uppercase tracking-wider mb-2">The Impact</div>
          <p className="text-sm text-gray-300 print:text-gray-700">Zero projects lost in transition. Automated funding milestones. 30/60/90 day revenue forecasting. Crew route optimization reduces drive time. Multi-tenant ready for the EDGE partner network.</p>
        </div>
      </div>

      {/* TOP 4 ADVANTAGES — Big cards */}
      <div>
        <h2 className="text-xs text-gray-500 uppercase tracking-wider mb-4 font-semibold">Core Differentiators</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { icon: '⚡', title: 'Automated Pipeline', desc: 'When a task completes, the next one activates. When all tasks finish, the project advances. When install completes, M2 funding becomes eligible. No manual handoffs.', color: '#f59e0b' },
            { icon: '🏢', title: 'Built for the EDGE Network', desc: 'Multi-tenant architecture with org-scoped data, cross-org engineering assignments, NTP approval workflows, and inter-org invoicing. Ready for partner EPCs.', color: '#8b5cf6' },
            { icon: '🤖', title: 'AI-Powered Data Access', desc: 'Ask Atlas in plain English: "Show me Houston projects over $50K stuck in permitting." Get instant answers from your live data. No SQL, no reports to build.', color: '#3b82f6' },
            { icon: '📈', title: 'Install Ramp Planner', desc: 'Readiness scoring across 900+ projects. Geographic crew clustering. Auto-fill weekly schedules. 30/60/90 day revenue forecasts. Built for the funded ramp-up.', color: '#1D9E75' },
          ].map(a => (
            <div key={a.title} className="bg-gray-800 rounded-xl p-6 border border-gray-700 print:border-gray-300 print:bg-gray-50">
              <div className="flex items-start gap-4">
                <span className="text-3xl">{a.icon}</span>
                <div>
                  <h3 className="text-base font-bold print:text-black" style={{ color: a.color }}>{a.title}</h3>
                  <p className="text-sm text-gray-400 mt-1 print:text-gray-600">{a.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1 pl-1">
          <span>Also: SLA tracking</span><span>·</span><span>{stats.ahjCount.toLocaleString()} AHJ records</span><span>·</span><span>Crew route optimization</span><span>·</span><span>Full audit trail</span><span>·</span><span>Real-time across all devices</span>
        </div>
      </div>

      {/* RAMP FORECAST — Big */}
      <div>
        <h2 className="text-xs text-gray-500 uppercase tracking-wider mb-4 font-semibold">Install Ramp-Up Forecast</h2>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 print:border-gray-300 print:bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
            {[
              { period: 'Month 1', crews: 2, installs: 16, revenue: '$700K', color: '#1D9E75' },
              { period: 'Month 2', crews: 4, installs: 32, revenue: '$1.4M', color: '#3b82f6' },
              { period: 'Month 3', crews: 6, installs: 48, revenue: '$2.1M', color: '#8b5cf6' },
              { period: 'Month 4', crews: 8, installs: 64, revenue: '$2.8M', color: '#f59e0b' },
            ].map(p => (
              <div key={p.period} className="text-center">
                <div className="text-xs text-gray-500">{p.period}</div>
                <div className="text-3xl font-black mt-1" style={{ color: p.color }}>{p.installs}</div>
                <div className="text-[10px] text-gray-400">{p.crews} crews × 2/week</div>
                <div className="text-sm font-bold text-white mt-1 print:text-black">{p.revenue}</div>
              </div>
            ))}
          </div>
          <div className="flex items-end gap-1 h-40">
            {Array.from({ length: 16 }, (_, i) => {
              const crews = i < 4 ? 2 : 2 + Math.floor((i - 4) / 2) + 1
              const h = (crews * 2 / 16) * 100
              const color = i < 4 ? '#1D9E75' : i < 8 ? '#3b82f6' : i < 12 ? '#8b5cf6' : '#f59e0b'
              return <div key={i} className="flex-1 rounded-t animate-grow" style={{ height: `${h}%`, backgroundColor: color, animationDelay: `${i * 0.08}s`, boxShadow: `0 0 8px ${color}30` }} />
            })}
          </div>
          <div className="flex justify-between mt-2 text-[9px] text-gray-500"><span>Week 1 — 4 installs/wk</span><span>Week 16 — 16 installs/wk</span></div>
        </div>
      </div>

      {/* WHAT'S NEXT */}
      <div>
        <h2 className="text-xs text-gray-500 uppercase tracking-wider mb-4 font-semibold">Roadmap</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { phase: 'Done', title: 'Customer App + EDGE Portal', desc: 'Native iOS/Android Expo app with Atlas AI chat, iMessage ticketing, push notifications. EDGE financier portal live with bidirectional webhooks.', status: 'Shipped', color: '#22c55e' },
            { phase: 'Phase 2', title: 'Planset Generator + Monitoring', desc: 'Automated PE planset generation (8 sheets). Duracell system monitoring API integration for real-time battery and production data.', status: 'In Progress', color: '#f59e0b' },
            { phase: 'Phase 3', title: 'Route Optimization + Scale', desc: 'Google Routes API for real drive times. Day-level crew scheduling. Performance indexes and Postgres aggregation for 5K+ projects.', status: 'Up Next', color: '#3b82f6' },
          ].map(r => (
            <div key={r.phase} className="bg-gray-800 rounded-xl p-5 border border-gray-700 print:border-gray-300 print:bg-gray-50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: `${r.color}20`, color: r.color }}>{r.phase}</span>
                <span className="text-[10px] text-gray-500">{r.status}</span>
              </div>
              <h3 className="text-sm font-bold text-white print:text-black">{r.title}</h3>
              <p className="text-xs text-gray-400 mt-1 print:text-gray-600">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

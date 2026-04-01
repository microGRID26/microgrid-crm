'use client'

import { Nav } from '@/components/Nav'

// ── Visual Infographic of the MicroGRID CRM Platform ─────────────────────────
// Target audience: non-technical team members (PMs, ops, sales, leadership)

const CATEGORIES = [
  {
    name: 'Core Workflow',
    color: '#1D9E75',
    pages: ['Command Center', 'My Queue', 'Pipeline', 'Schedule', 'NTP'],
    desc: 'Daily tools for PMs and ops',
  },
  {
    name: 'Operations',
    color: '#3b82f6',
    pages: ['Tickets', 'Work Orders', 'Change Orders', 'Engineering', 'Audit'],
    desc: 'Issue tracking and field operations',
  },
  {
    name: 'Financial',
    color: '#22c55e',
    pages: ['Funding', 'Commissions', 'Invoices', 'Sales Teams'],
    desc: 'Money flow and sales management',
  },
  {
    name: 'Supply Chain',
    color: '#f59e0b',
    pages: ['Inventory', 'Vendors', 'Warranty', 'Fleet'],
    desc: 'Equipment, materials, vehicles',
  },
  {
    name: 'Planning & Analytics',
    color: '#8b5cf6',
    pages: ['Ramp-Up Planner', 'Project Map', 'Analytics', 'Atlas AI'],
    desc: 'Data-driven decisions',
  },
  {
    name: 'Administration',
    color: '#ec4899',
    pages: ['Admin Portal', 'System', 'Permissions', 'Help Center'],
    desc: 'Configuration and access control',
  },
]

const DATA_NODES = [
  { label: 'Projects', count: '938 active', color: '#1D9E75', size: 'lg' },
  { label: 'Legacy', count: '14,705', color: '#6b7280', size: 'md' },
  { label: 'Notes', count: '330K+', color: '#3b82f6', size: 'md' },
  { label: 'Tasks', count: '67K+ history', color: '#f59e0b', size: 'md' },
  { label: 'Schedule', count: 'Daily jobs', color: '#22c55e', size: 'sm' },
  { label: 'Tickets', count: 'Issues & cases', color: '#ec4899', size: 'sm' },
  { label: 'Funding', count: '12K records', color: '#8b5cf6', size: 'sm' },
  { label: 'Equipment', count: '2,517 items', color: '#06b6d4', size: 'sm' },
  { label: 'AHJs', count: '1,633', color: '#f97316', size: 'sm' },
  { label: 'Users', count: 'Role-based', color: '#ef4444', size: 'sm' },
]

const AUTOMATIONS = [
  { trigger: 'Task marked Complete', action: 'Auto-advance to next pipeline stage', icon: '→' },
  { trigger: 'Install Complete', action: 'Set M2 funding to Eligible', icon: '💰' },
  { trigger: 'PTO Received', action: 'Set M3 funding to Eligible', icon: '💰' },
  { trigger: 'NTP Approved', action: 'Update ramp-up readiness score', icon: '📋' },
  { trigger: 'Equipment Delivered', action: 'Mark equipment ready in planner', icon: '📦' },
  { trigger: 'Task stuck', action: 'Auto-set project blocker + notify PM', icon: '🚫' },
  { trigger: 'Follow-up overdue', action: 'Notification in bell + daily digest', icon: '🔔' },
  { trigger: '@Mention in note', action: 'Instant notification badge', icon: '💬' },
  { trigger: 'Ticket assigned', action: 'Notify assignee via bell', icon: '🎫' },
  { trigger: 'Schedule job complete', action: 'Sync task status on project', icon: '✅' },
]

const PERSONAS = [
  {
    role: 'Project Manager',
    color: '#1D9E75',
    tools: ['Command Center — morning dashboard with action items', 'Queue — prioritized worklist with smart filters', 'Pipeline — visual Kanban board', 'ProjectPanel — task management and notes', 'Mobile crew view — field operations'],
  },
  {
    role: 'Operations Lead',
    color: '#3b82f6',
    tools: ['Schedule — crew calendar with batch complete', 'Ramp-Up Planner — install scheduling with route optimization', 'Tickets — issue tracking with SLA', 'Work Orders — field work with checklists', 'Inventory — materials and purchase orders'],
  },
  {
    role: 'Manager / Leadership',
    color: '#8b5cf6',
    tools: ['Analytics — 6 dashboards with custom date ranges', 'Project Map — geographic view of all projects', 'Funding — M1/M2/M3 milestone tracking', 'Ramp-Up Timeline — 30/60/90 day forecast', 'Atlas AI — natural language data queries'],
  },
  {
    role: 'Admin',
    color: '#ec4899',
    tools: ['Permission Matrix — role-based access control', 'Ticket Categories — configurable categories and SLAs', 'Feature Flags — gradual rollout', 'AHJ/Utility/HOA — reference data management', 'System Settings — org configuration'],
  },
]

const STATS = [
  { label: 'Pages', value: '50+', sub: 'Full-featured views' },
  { label: 'API Functions', value: '200+', sub: 'Data access layer' },
  { label: 'Tests', value: '2,506', sub: 'Automated quality checks' },
  { label: 'Database Tables', value: '45+', sub: 'Structured data' },
  { label: 'Automations', value: '10+', sub: 'Zero-click workflows' },
  { label: 'Migrations', value: '66', sub: 'Schema evolution' },
]

export default function InfographicPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Nav active="Infographic" />

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-16">

        {/* ═══ HERO ═══ */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">
            <span className="text-green-400">MicroGRID</span> CRM Platform
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Built by Atlas — a complete solar project management system tracking 938 active projects
            through a 7-stage pipeline from sale to in-service.
          </p>

          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-8">
            {STATS.map(s => (
              <div key={s.label} className="bg-gray-800 rounded-xl p-4 text-center border border-gray-700">
                <div className="text-3xl font-bold text-green-400">{s.value}</div>
                <div className="text-sm font-semibold text-white mt-1">{s.label}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ THE PLATFORM ═══ */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">The Platform</h2>
          <p className="text-sm text-gray-500 mb-6">50+ pages organized into 6 categories. Every page is role-gated and mobile-responsive.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORIES.map(cat => (
              <div key={cat.name} className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-opacity-100 transition-colors"
                style={{ borderColor: `${cat.color}40` }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  <h3 className="text-sm font-bold text-white">{cat.name}</h3>
                </div>
                <p className="text-[10px] text-gray-500 mb-3">{cat.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {cat.pages.map(page => (
                    <span key={page} className="text-[10px] px-2 py-0.5 rounded-full border"
                      style={{ borderColor: `${cat.color}60`, color: cat.color, backgroundColor: `${cat.color}10` }}>
                      {page}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ THE DATA ═══ */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">The Data</h2>
          <p className="text-sm text-gray-500 mb-6">45+ database tables storing every aspect of the solar installation lifecycle. All changes audited.</p>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex flex-wrap justify-center gap-4">
              {DATA_NODES.map(node => (
                <div key={node.label} className={`rounded-xl border text-center transition-transform hover:scale-105 ${
                  node.size === 'lg' ? 'px-8 py-6 min-w-[140px]' : node.size === 'md' ? 'px-6 py-4 min-w-[120px]' : 'px-4 py-3 min-w-[100px]'
                }`} style={{ borderColor: `${node.color}60`, backgroundColor: `${node.color}10` }}>
                  <div className={`font-bold ${node.size === 'lg' ? 'text-lg' : 'text-sm'}`} style={{ color: node.color }}>{node.label}</div>
                  <div className={`text-gray-400 mt-1 ${node.size === 'lg' ? 'text-sm' : 'text-[10px]'}`}>{node.count}</div>
                </div>
              ))}
            </div>

            {/* Connection lines (visual only) */}
            <div className="flex justify-center mt-6">
              <div className="text-[10px] text-gray-600 text-center max-w-md">
                Every project connects to tasks, notes, schedule entries, funding milestones, tickets, materials, warranties, and more.
                All data is org-scoped with row-level security.
              </div>
            </div>
          </div>
        </div>

        {/* ═══ THE AUTOMATION ═══ */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">The Automation</h2>
          <p className="text-sm text-gray-500 mb-6">10+ zero-click workflows that fire automatically when conditions are met. No manual intervention needed.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {AUTOMATIONS.map((a, i) => (
              <div key={i} className="bg-gray-800 rounded-lg px-4 py-3 flex items-center gap-3 border border-gray-700">
                <span className="text-xl flex-shrink-0">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-400">When: <span className="text-white font-medium">{a.trigger}</span></div>
                  <div className="text-xs text-green-400">Then: {a.action}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ THE FEATURES BY PERSONA ═══ */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Built For Your Role</h2>
          <p className="text-sm text-gray-500 mb-6">Every role has purpose-built tools. Here is what each person uses daily.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PERSONAS.map(p => (
              <div key={p.role} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                  <h3 className="text-sm font-bold" style={{ color: p.color }}>{p.role}</h3>
                </div>
                <div className="space-y-1.5">
                  {p.tools.map((tool, i) => {
                    const [name, desc] = tool.split(' — ')
                    return (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: p.color }} />
                        <div>
                          <span className="text-white font-medium">{name}</span>
                          {desc && <span className="text-gray-500"> — {desc}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ PIPELINE ═══ */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">The Pipeline</h2>
          <p className="text-sm text-gray-500 mb-6">Every project flows through 7 stages. Each stage has defined tasks, SLA targets, and automation triggers.</p>

          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {[
              { stage: 'Evaluation', color: '#3b82f6', tasks: 5 },
              { stage: 'Site Survey', color: '#8b5cf6', tasks: 3 },
              { stage: 'Design', color: '#ec4899', tasks: 6 },
              { stage: 'Permitting', color: '#f59e0b', tasks: 5 },
              { stage: 'Installation', color: '#f97316', tasks: 3 },
              { stage: 'Inspection', color: '#06b6d4', tasks: 6 },
              { stage: 'Complete', color: '#22c55e', tasks: 2 },
            ].map((s, i) => (
              <div key={s.stage} className="flex items-center flex-shrink-0">
                <div className="rounded-xl px-5 py-4 text-center min-w-[120px] border transition-transform hover:scale-105"
                  style={{ backgroundColor: `${s.color}15`, borderColor: `${s.color}40` }}>
                  <div className="text-sm font-bold" style={{ color: s.color }}>{s.stage}</div>
                  <div className="text-[10px] text-gray-500 mt-1">{s.tasks} tasks</div>
                </div>
                {i < 6 && (
                  <div className="mx-1 text-gray-600 text-lg">→</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div className="text-center py-8 border-t border-gray-800">
          <p className="text-gray-600 text-xs">
            Built and maintained by Atlas (AI) for MicroGRID Energy / EDGE
          </p>
          <p className="text-gray-700 text-[10px] mt-1">
            2,506 tests · 66 migrations · 74 test files · Next.js 16 · React 19 · Supabase · Tailwind CSS
          </p>
        </div>
      </div>
    </div>
  )
}

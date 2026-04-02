import type { HelpTopicData } from './index'

function TicketingOverview() {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">The Tickets page tracks issues, complaints, and requests tied to projects. Every ticket has a category, priority, SLA targets, and a full audit trail. Tickets can be linked to sales reps for per-rep complaint tracking — filter by rep to see their ticket history and complaint ratio.</p>
      <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">8 TICKET CATEGORIES</div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { cat: 'service', color: 'bg-blue-900/40 text-blue-400' },
            { cat: 'sales', color: 'bg-amber-900/40 text-amber-400' },
            { cat: 'billing', color: 'bg-green-900/40 text-green-400' },
            { cat: 'warranty', color: 'bg-purple-900/40 text-purple-400' },
            { cat: 'permitting', color: 'bg-cyan-900/40 text-cyan-400' },
            { cat: 'installation', color: 'bg-orange-900/40 text-orange-400' },
            { cat: 'design', color: 'bg-pink-900/40 text-pink-400' },
            { cat: 'other', color: 'bg-gray-700/40 text-gray-400' },
          ].map(c => (
            <span key={c.cat} className={`px-2 py-0.5 rounded text-[10px] font-medium ${c.color}`}>{c.cat}</span>
          ))}
        </div>
      </div>
      <div className="bg-gray-800/50 rounded-lg p-3">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">STATUS LIFECYCLE</div>
        <div className="space-y-1">
          {[
            { status: 'Open', color: 'bg-blue-500/20 text-blue-400', desc: 'New ticket, not yet assigned' },
            { status: 'Assigned', color: 'bg-indigo-500/20 text-indigo-400', desc: 'Assigned to a team member' },
            { status: 'In Progress', color: 'bg-amber-500/20 text-amber-400', desc: 'Actively being worked on' },
            { status: 'Waiting on Customer', color: 'bg-purple-500/20 text-purple-400', desc: 'Needs customer response' },
            { status: 'Waiting on Vendor', color: 'bg-orange-500/20 text-orange-400', desc: 'Waiting for vendor/supplier' },
            { status: 'Escalated', color: 'bg-red-500/20 text-red-400', desc: 'Escalated to management' },
            { status: 'Resolved', color: 'bg-green-500/20 text-green-400', desc: 'Fixed — requires resolution category' },
            { status: 'Closed', color: 'bg-gray-500/20 text-gray-400', desc: 'Completed and closed' },
          ].map(s => (
            <div key={s.status} className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium w-36 text-center ${s.color}`}>{s.status}</span>
              <span className="text-[11px] text-gray-400">{s.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CreateTicket() {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">Click &quot;New Ticket&quot; to open the creation form. Required: Title. Optional: description, category, subcategory, priority, source, project ID, assignment.</p>
      <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">CREATE TICKET FORM</div>
        <div className="space-y-1.5">
          <div className="flex gap-2 items-center text-xs">
            <span className="text-gray-500 w-20">Title</span>
            <span className="bg-gray-700 rounded px-2 py-0.5 text-white flex-1">Cracked panel discovered during inspection</span>
          </div>
          <div className="flex gap-2 items-center text-xs">
            <span className="text-gray-500 w-20">Category</span>
            <span className="bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded text-[10px]">service</span>
            <span className="text-gray-600">→</span>
            <span className="text-gray-400 text-[10px]">panel_damage</span>
          </div>
          <div className="flex gap-2 items-center text-xs">
            <span className="text-gray-500 w-20">Priority</span>
            <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded text-[10px]">high</span>
          </div>
          <div className="flex gap-2 items-center text-xs">
            <span className="text-gray-500 w-20">Project</span>
            <span className="text-green-400 font-mono text-[11px]">PROJ-28692</span>
          </div>
        </div>
        <p className="text-[10px] text-gray-500 mt-2">Subcategories auto-populate based on category. Each subcategory has default SLA targets.</p>
      </div>
    </div>
  )
}

function SLATracking() {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">Every ticket has two SLA targets: Response (time to first comment or assignment) and Resolution (time to resolve). SLA status shows as colored dots in the table.</p>
      <div className="bg-gray-800/50 rounded-lg p-3">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">SLA INDICATORS</div>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex gap-1"><span className="w-3 h-3 rounded-full bg-green-500" /><span className="w-3 h-3 rounded-full bg-green-500" /></div>
            <span className="text-xs text-gray-300">Both SLAs on track</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1"><span className="w-3 h-3 rounded-full bg-green-500" /><span className="w-3 h-3 rounded-full bg-amber-500" /></div>
            <span className="text-xs text-gray-300">Response OK, resolution approaching target (75%+)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1"><span className="w-3 h-3 rounded-full bg-red-500" /><span className="w-3 h-3 rounded-full bg-red-500" /></div>
            <span className="text-xs text-gray-300">Both SLAs breached</span>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t border-gray-700">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">DEFAULT SLA TARGETS BY PRIORITY</div>
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            <div className="text-gray-400">Urgent: 4h response / 24h resolve</div>
            <div className="text-gray-400">High: 8-12h response / 48h resolve</div>
            <div className="text-gray-400">Normal: 24h response / 72h resolve</div>
            <div className="text-gray-400">Low: 48h response / 168h resolve</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResolvingTickets() {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">When you click &quot;→ Resolved&quot;, a modal prompts for a resolution category and notes. This is required for data-driven tracking of how issues are resolved.</p>
      <div className="bg-gray-800/50 rounded-lg p-3">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">15 RESOLUTION CATEGORIES</div>
        <div className="grid grid-cols-2 gap-1">
          {[
            'Fixed / Repaired', 'Equipment Replaced', 'Refund Issued', 'System Redesigned',
            'Permit Resubmitted', 'Rescheduled', 'Vendor Resolved', 'Customer Error',
            'No Action Needed', 'Duplicate Ticket', 'Rep Disciplined', 'Rep Terminated',
            'Escalated to External', 'Warranty Claim Filed', 'Partial Fix',
          ].map(r => (
            <div key={r} className="text-[11px] text-gray-400 py-0.5">• {r}</div>
          ))}
        </div>
        <p className="text-[10px] text-gray-500 mt-2">Resolution categories are filterable in analytics — track which types of resolutions are most common per category.</p>
      </div>
    </div>
  )
}

export const ticketingTopics: HelpTopicData[] = [
  {
    id: 'ticketing-overview',
    title: 'Ticketing System',
    description: 'Track issues, complaints, and requests with categories, priorities, and SLA tracking',
    category: 'Daily Workflow',
    keywords: ['tickets', 'issues', 'complaints', 'service', 'support', 'cases', 'tracking'],
    tryItLink: '/tickets',
    relatedTopics: ['service-page', 'work-orders'],
    content: TicketingOverview,
  },
  {
    id: 'create-ticket',
    title: 'Creating Tickets',
    description: 'How to create a new ticket with category, priority, and project linkage',
    category: 'Daily Workflow',
    keywords: ['create', 'new ticket', 'submit', 'report issue', 'category', 'subcategory'],
    tryItLink: '/tickets',
    relatedTopics: ['ticketing-overview'],
    content: CreateTicket,
  },
  {
    id: 'sla-tracking',
    title: 'SLA Tracking',
    description: 'Response and resolution SLA targets with visual indicators',
    category: 'Daily Workflow',
    keywords: ['sla', 'response time', 'resolution time', 'breached', 'target', 'performance'],
    tryItLink: '/tickets',
    relatedTopics: ['ticketing-overview', 'resolving-tickets'],
    content: SLATracking,
  },
  {
    id: 'resolving-tickets',
    title: 'Resolving Tickets',
    description: 'How to resolve tickets with resolution categories and notes',
    category: 'Daily Workflow',
    keywords: ['resolve', 'close', 'resolution', 'fix', 'complete', 'categories'],
    tryItLink: '/tickets',
    relatedTopics: ['ticketing-overview', 'sla-tracking'],
    content: ResolvingTickets,
  },
]

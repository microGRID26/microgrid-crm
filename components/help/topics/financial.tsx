import type { HelpTopicData } from './index'

function FundingOverview() {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">Every project has three funding milestones:</p>
      <div className="space-y-2 text-xs">
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-green-500">
          <span className="text-green-400 font-bold">M1 -- Advance</span>
          <p className="text-gray-400 mt-1">Paid at or near the sale. Funded by the financier after NTP is confirmed.</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-blue-500">
          <span className="text-blue-400 font-bold">M2 -- Substantial Completion</span>
          <p className="text-gray-400 mt-1">Funded when installation is complete. Typically 65% of contract value.</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-amber-500">
          <span className="text-amber-400 font-bold">M3 -- Final</span>
          <p className="text-gray-400 mt-1">Funded after PTO and in-service. Typically 35% of contract value.</p>
        </div>
      </div>
    </div>
  )
}

function FundingPage() {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">The Funding page provides a full-featured dashboard for managing M1/M2/M3 milestones across all active projects.</p>
      <div className="space-y-2 text-xs">
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-green-500">
          <span className="text-green-400 font-bold">Inline Editing</span>
          <p className="text-gray-400 mt-1">Click any amount, date, or notes cell to edit directly. Press Enter to save, Escape to cancel. Status dropdowns update instantly.</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-blue-500">
          <span className="text-blue-400 font-bold">Task-Based Sections</span>
          <p className="text-gray-400 mt-1">Three collapsible sections above the table: Ready to Submit, Awaiting Payment (with stale submission highlighting), and Needs Attention (pending/revision).</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-amber-500">
          <span className="text-amber-400 font-bold">Filters, Sorting & Export</span>
          <p className="text-gray-400 mt-1">Filter by status, financier, and search (name, ID, city, AHJ). Click any column header to sort. Export filtered results to CSV.</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-red-500">
          <span className="text-red-400 font-bold">NF Codes</span>
          <p className="text-gray-400 mt-1">Click + in the NF Codes column to search and assign nonfunded codes. Click x to remove. Up to 3 codes per project.</p>
        </div>
      </div>
    </div>
  )
}

function FundingStatuses() {
  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex items-center gap-2"><span className="bg-amber-900 text-amber-300 px-2 py-0.5 rounded">RTS</span><span className="text-gray-400">-- Ready To Start, milestone triggered</span></div>
      <div className="flex items-center gap-2"><span className="bg-blue-900 text-blue-300 px-2 py-0.5 rounded">Sub</span><span className="text-gray-400">-- Submitted to financier, awaiting payment</span></div>
      <div className="flex items-center gap-2"><span className="bg-red-900 text-red-300 px-2 py-0.5 rounded">Pnd</span><span className="text-gray-400">-- Pending Resolution, nonfunded code issue</span></div>
      <div className="flex items-center gap-2"><span className="bg-amber-900 text-amber-300 px-2 py-0.5 rounded">Rev</span><span className="text-gray-400">-- Revision Required, needs someone to redo a task</span></div>
      <div className="flex items-center gap-2"><span className="bg-green-900 text-green-300 px-2 py-0.5 rounded">Fun</span><span className="text-gray-400">-- Funded, payment received</span></div>
    </div>
  )
}

function FundingTriggers() {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">Milestones trigger automatically when PMs complete tasks:</p>
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="bg-green-900 text-green-300 px-1.5 py-0.5 rounded">Install Complete</span>
          <span className="text-gray-500">&rarr;</span>
          <span className="bg-blue-900 text-blue-300 px-1.5 py-0.5 rounded">M2 Eligible</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-green-900 text-green-300 px-1.5 py-0.5 rounded">PTO Received</span>
          <span className="text-gray-500">&rarr;</span>
          <span className="bg-blue-900 text-blue-300 px-1.5 py-0.5 rounded">M3 Eligible</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-2">No manual action needed -- milestones become Eligible the moment the task is marked Complete.</p>
    </div>
  )
}

function InvoiceManagement() {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">The Invoice system handles billing between organizations. One org creates an invoice with line items, sends it to another org, and tracks payment.</p>
      <div className="space-y-2 text-xs">
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-green-500">
          <span className="text-green-400 font-bold">Creating an Invoice</span>
          <p className="text-gray-400 mt-1">Click New Invoice, select a recipient org, optionally link a project and milestone, add line items (description, quantity, unit price), set a due date, and create. Invoice numbers are auto-generated as INV-YYYYMMDD-NNN.</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-blue-500">
          <span className="text-blue-400 font-bold">Sending and Tracking</span>
          <p className="text-gray-400 mt-1">Send the invoice to mark it as Sent. The recipient org sees it in their queue. Status progresses through Sent, Viewed, and Paid. Overdue and Disputed statuses handle exceptions.</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-amber-500">
          <span className="text-amber-400 font-bold">Payment</span>
          <p className="text-gray-400 mt-1">The receiving org marks an invoice as Paid, recording the amount, payment method, and reference number. Paid and Cancelled are terminal statuses.</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-purple-500">
          <span className="text-purple-400 font-bold">Invoice Rule Templates</span>
          <p className="text-gray-400 mt-1">When creating an invoice, use the "Apply Rule Template" dropdown to pre-populate line items from a saved template. 8 default templates cover the full billing ecosystem: Sales &amp; Marketing to EPC, NewCo Supply to EPC, Rush Engineering to EPC ($1,200 flat fee), EPC to EDGE at NTP/Install/PTO milestones, and recurring energy/VPP flows. Admins manage templates in Admin &gt; Invoice Rules.</p>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-xs">
        <div className="flex items-center gap-2"><span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded">Draft</span><span className="text-gray-400">-- Created, not yet sent</span></div>
        <div className="flex items-center gap-2"><span className="bg-blue-900 text-blue-300 px-2 py-0.5 rounded">Sent</span><span className="text-gray-400">-- Delivered to recipient org</span></div>
        <div className="flex items-center gap-2"><span className="bg-cyan-900 text-cyan-300 px-2 py-0.5 rounded">Viewed</span><span className="text-gray-400">-- Opened by recipient</span></div>
        <div className="flex items-center gap-2"><span className="bg-green-900 text-green-300 px-2 py-0.5 rounded">Paid</span><span className="text-gray-400">-- Payment received (terminal)</span></div>
        <div className="flex items-center gap-2"><span className="bg-red-900 text-red-300 px-2 py-0.5 rounded">Overdue</span><span className="text-gray-400">-- Past due date, unpaid</span></div>
        <div className="flex items-center gap-2"><span className="bg-orange-900 text-orange-300 px-2 py-0.5 rounded">Disputed</span><span className="text-gray-400">-- Contested by recipient</span></div>
        <div className="flex items-center gap-2"><span className="bg-gray-800 text-gray-400 px-2 py-0.5 rounded">Cancelled</span><span className="text-gray-400">-- Voided (terminal)</span></div>
      </div>
    </div>
  )
}

function CommissionCalculator() {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">The Commission Calculator helps sales reps, closers, team leaders, and managers estimate and track per-deal commissions.</p>
      <div className="space-y-2 text-xs">
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-green-500">
          <span className="text-green-400 font-bold">Calculator Tab</span>
          <p className="text-gray-400 mt-1">Enter system size (kW), adder revenue, and referral count, then select your role. The calculator applies per-watt rates for solar, a percentage for adders, and a flat fee per referral to show a detailed breakdown and total.</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-blue-500">
          <span className="text-blue-400 font-bold">Commission Structure</span>
          <p className="text-gray-400 mt-1">Solar commissions are calculated as system watts times a per-watt rate (e.g., Sales Rep $0.50/W, Closer $0.25/W). Adder commissions are a percentage of total adder revenue. Referral bonuses are a flat fee per referral. All rates are admin-configurable.</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-amber-500">
          <span className="text-amber-400 font-bold">Earnings Tab</span>
          <p className="text-gray-400 mt-1">View commission history filtered by period (month, quarter, year, all time). Admins see all records with a PM filter. Non-admins see their own records only. Sortable columns, per-deal breakdowns, and CSV export.</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-purple-500">
          <span className="text-purple-400 font-bold">Rate Card Tab (Admin Only)</span>
          <p className="text-gray-400 mt-1">Admins manage commission rates: add, edit, and delete per-role rates. Six default rates are seeded (Sales Rep, Closer, Team Leader Override, Manager Override, Adder Commission, Referral Bonus). Rates are org-scoped for multi-tenant support.</p>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-xs">
        <div className="flex items-center gap-2"><span className="bg-amber-900 text-amber-300 px-2 py-0.5 rounded">Pending</span><span className="text-gray-400">-- Commission calculated, awaiting approval</span></div>
        <div className="flex items-center gap-2"><span className="bg-blue-900 text-blue-300 px-2 py-0.5 rounded">Approved</span><span className="text-gray-400">-- Approved for payment</span></div>
        <div className="flex items-center gap-2"><span className="bg-green-900 text-green-300 px-2 py-0.5 rounded">Paid</span><span className="text-gray-400">-- Payment issued (terminal)</span></div>
        <div className="flex items-center gap-2"><span className="bg-red-900 text-red-300 px-2 py-0.5 rounded">Cancelled</span><span className="text-gray-400">-- Voided (terminal)</span></div>
      </div>
    </div>
  )
}

function EarningsDashboard() {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">The Earnings Dashboard gives every rep and PM visibility into their personal commission history, monthly trends, and team rankings.</p>
      <div className="space-y-2 text-xs">
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-green-500">
          <span className="text-green-400 font-bold">My Earnings Tab</span>
          <p className="text-gray-400 mt-1">See total earned, this month, pending, and paid in hero stat cards. A 6-month trend chart shows earnings trajectory. The recent deals table is sortable by project, kW, role, commission amounts, status, and date. Click any project to open the full ProjectPanel.</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-amber-500">
          <span className="text-amber-400 font-bold">Leaderboard Tab</span>
          <p className="text-gray-400 mt-1">See team rankings by total commission, deal count, or total kW. Period selectors (month, quarter, year) let you compare performance across timeframes. Your own row is highlighted with a green accent and "(you)" label. Summary cards show top earner, average commission, total team earnings, and total deals.</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-blue-500">
          <span className="text-blue-400 font-bold">Admin View</span>
          <p className="text-gray-400 mt-1">Admins can switch the user dropdown to view any team member's earnings. Non-admins see only their own data.</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-purple-500">
          <span className="text-purple-400 font-bold">Tiered Commissions</span>
          <p className="text-gray-400 mt-1">Volume tiers automatically increase per-watt rates as reps close more deals or accumulate more watts in a period. Geo modifiers adjust rates by market (city, state, or region). Both are configured by admins and applied transparently during commission calculation.</p>
        </div>
      </div>
    </div>
  )
}

function SalesTeamsPersonnel() {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">The Sales Teams page is your central hub for managing sales team structure, pay scales, override distribution, and personnel. Admin access required.</p>
      <div className="space-y-2 text-xs">
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-green-500">
          <span className="text-green-400 font-bold">Teams Tab</span>
          <p className="text-gray-400 mt-1">Create teams with leadership assignments (VP, Regional, Manager, Asst. Manager). Each team has a stack rate ($/W) that determines the override pool. Expand a team card to see its members, pay scales, and statuses.</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-blue-500">
          <span className="text-blue-400 font-bold">Personnel Tab</span>
          <p className="text-gray-400 mt-1">Add, filter, and sort sales reps. Assign each rep to a team, pay scale tier, and role. Track status (Onboarding, Active, Inactive, Terminated). Expandable rows show onboarding document progress. CSV export available.</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-amber-500">
          <span className="text-amber-400 font-bold">Pay Scales Tab</span>
          <p className="text-gray-400 mt-1">Define named pay tiers (e.g., Consultant at $0.20/W, Pro at $0.25/W, Elite at $0.30/W). Each tier has a per-watt rate, adder percentage, and referral bonus. Visual comparison cards show all active tiers side by side.</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-purple-500">
          <span className="text-purple-400 font-bold">Distribution Tab</span>
          <p className="text-gray-400 mt-1">Configure how the override pool is split across roles (Energy Consultant 40%, Energy Advisor 40%, PM 3%, etc.). A validation banner warns if active percentages do not sum to 100%. Visual bar chart shows the split.</p>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-3">Override = (Team Stack Rate - Rep Pay Scale Rate) x System Watts. The override amount is then distributed across leadership per the distribution percentages.</p>
    </div>
  )
}

function RepOnboarding() {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">When a new sales rep is added, their onboarding document checklist is automatically created from the active requirements list.</p>
      <div className="space-y-2 text-xs">
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-green-500">
          <span className="text-green-400 font-bold">Onboarding Tab</span>
          <p className="text-gray-400 mt-1">The Onboarding tab on the Sales page shows all reps currently in onboarding status. Each rep has a document checklist with progress tracking. Filter by team or search by name.</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-blue-500">
          <span className="text-blue-400 font-bold">Document Status Flow</span>
          <p className="text-gray-400 mt-1">Each document progresses through: Pending, Sent, Viewed, Signed, Uploaded, Verified (or Rejected). Lifecycle timestamps are auto-set at each transition -- for example, sent_at is recorded when marked Sent.</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border-l-2 border-amber-500">
          <span className="text-amber-400 font-bold">Default Requirements</span>
          <p className="text-gray-400 mt-1">Seven default documents are seeded: Offer Letter, W9, Background Check Authorization, Driver License (Front &amp; Back), Profile Photo, and Independent Contractor Agreement. Admins can add or modify requirements.</p>
        </div>
      </div>
    </div>
  )
}

export const financialTopics: HelpTopicData[] = [
  {
    id: 'funding-overview',
    title: 'Funding Milestones',
    description: 'M1, M2, M3 milestone overview',
    category: 'Financial',
    keywords: ['funding', 'milestone', 'm1', 'm2', 'm3', 'advance', 'completion', 'final'],
    relatedTopics: ['funding-statuses', 'funding-triggers'],
    content: FundingOverview,
  },
  {
    id: 'funding-page',
    title: 'Funding Page',
    description: 'Inline editing, task sections, stale alerts, CSV export',
    category: 'Financial',
    keywords: ['funding', 'page', 'table', 'sort', 'filter', 'financier', 'inline', 'edit', 'csv', 'export', 'stale', 'nf', 'nonfunded'],
    tryItLink: '/funding',
    relatedTopics: ['funding-statuses', 'funding-triggers'],
    content: FundingPage,
  },
  {
    id: 'funding-statuses',
    title: 'Funding Statuses',
    description: 'RTS, Sub, Pnd, Rev, Fun explained',
    category: 'Financial',
    keywords: ['status', 'rts', 'submitted', 'pending', 'revision', 'funded', 'nonfunded'],
    relatedTopics: ['funding-overview', 'funding-page'],
    content: FundingStatuses,
  },
  {
    id: 'funding-triggers',
    title: 'Automatic Funding Triggers',
    description: 'Auto M2 on install, M3 on PTO',
    category: 'Financial',
    keywords: ['trigger', 'auto', 'install', 'pto', 'eligible', 'automatic'],
    relatedTopics: ['funding-overview', 'automations'],
    content: FundingTriggers,
  },
  {
    id: 'invoice-management',
    title: 'Invoices',
    description: 'Create, send, and track inter-org invoices with milestone triggers',
    category: 'Financial',
    keywords: ['invoice', 'billing', 'payment', 'paid', 'overdue', 'disputed', 'line item', 'milestone', 'inter-org', 'send', 'rule', 'template', 'apply rule', 'newco', 'supply'],
    tryItLink: '/invoices',
    relatedTopics: ['funding-overview', 'funding-triggers', 'engineering-assignments'],
    content: InvoiceManagement,
  },
  {
    id: 'commission-calculator',
    title: 'Commission Calculator',
    description: 'Per-deal commission estimates, earnings history, and rate management',
    category: 'Financial',
    keywords: ['commission', 'calculator', 'earnings', 'rate', 'per-watt', 'adder', 'referral', 'sales rep', 'closer', 'team leader', 'manager', 'paid', 'approved'],
    tryItLink: '/commissions',
    relatedTopics: ['funding-overview', 'invoice-management'],
    content: CommissionCalculator,
  },
  {
    id: 'earnings-dashboard',
    title: 'Earnings Dashboard',
    description: 'Personal earnings, monthly trends, and team leaderboard',
    category: 'Financial',
    keywords: ['earnings', 'dashboard', 'leaderboard', 'trend', 'ranking', 'commission', 'monthly', 'tier', 'geo', 'modifier', 'accelerator'],
    tryItLink: '/commissions',
    relatedTopics: ['commission-calculator', 'funding-overview'],
    content: EarningsDashboard,
  },
  {
    id: 'sales-teams',
    title: 'Sales Teams & Personnel',
    description: 'Team structure, pay scales, override distribution, and rep management',
    category: 'Financial',
    keywords: ['sales', 'team', 'personnel', 'rep', 'pay scale', 'stack', 'override', 'distribution', 'consultant', 'advisor', 'vp', 'regional', 'manager', 'per-watt'],
    tryItLink: '/sales',
    relatedTopics: ['commission-calculator', 'rep-onboarding'],
    content: SalesTeamsPersonnel,
  },
  {
    id: 'rep-onboarding',
    title: 'Rep Onboarding',
    description: 'Document checklist, status tracking, and auto-initialization for new reps',
    category: 'Financial',
    keywords: ['onboarding', 'document', 'checklist', 'offer letter', 'w9', 'background check', 'license', 'rep', 'new hire', 'sent', 'signed', 'verified'],
    tryItLink: '/sales',
    relatedTopics: ['sales-teams', 'commission-calculator'],
    content: RepOnboarding,
  },
]

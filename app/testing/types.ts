import {
  CheckCircle2, XCircle, Ban, SkipForward, Circle,
} from 'lucide-react'

export interface TestPlan {
  id: string
  name: string
  description: string | null
  role_filter: string
  sort_order: number
  created_at: string
}

export interface TestCase {
  id: string
  plan_id: string
  title: string
  instructions: string | null
  expected_result: string | null
  page_url: string | null
  priority: 'critical' | 'high' | 'medium' | 'low'
  sort_order: number
}

export interface TestResult {
  id: string
  test_case_id: string
  tester_id: string
  status: 'pending' | 'pass' | 'fail' | 'blocked' | 'skipped'
  feedback: string | null
  tested_at: string
  screenshot_path?: string | null
  needs_retest?: boolean
  retest_note?: string | null
}

export interface TestComment {
  id: string
  test_result_id: string
  author_id: string
  body: string
  created_at: string
  author_name?: string
}

export interface TestAssignment {
  test_case_id: string
  tester_id: string
}

export type Status = TestResult['status']

export const STATUS_META: Record<Status, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  pass:    { label: 'Pass',    icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  fail:    { label: 'Fail',    icon: XCircle,      color: 'text-red-500',     bg: 'bg-red-500/10' },
  blocked: { label: 'Blocked', icon: Ban,           color: 'text-amber-500',   bg: 'bg-amber-500/10' },
  skipped: { label: 'Skipped', icon: SkipForward,   color: 'text-gray-500',    bg: 'bg-gray-700' },
  pending: { label: 'Pending', icon: Circle,        color: 'text-gray-500',    bg: 'bg-gray-700' },
}

export const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  critical: { label: 'Critical', cls: 'bg-red-500/10 text-red-500 border-red-500/20' },
  high:     { label: 'High',     cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  medium:   { label: 'Medium',   cls: 'bg-gray-700 text-gray-400 border-gray-600' },
  low:      { label: 'Low',      cls: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
}

export const ADMIN_ROLES = ['admin', 'super_admin', 'manager']

// Badge definitions keyed by plan name (normalized lowercase)
export const BADGE_DEFS: Record<string, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  'queue management':       { label: 'Queue Master',     icon: CheckCircle2, color: 'text-blue-400',    bg: 'bg-blue-500/15' },
  'pipeline tracking':      { label: 'Pipeline Pro',     icon: CheckCircle2, color: 'text-purple-400',  bg: 'bg-purple-500/15' },
  'scheduling':             { label: 'Schedule Expert',  icon: CheckCircle2, color: 'text-cyan-400',    bg: 'bg-cyan-500/15' },
  'funding & finance':      { label: 'Finance Guru',     icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  'engineering':            { label: 'Engineer Elite',   icon: CheckCircle2, color: 'text-indigo-400',  bg: 'bg-indigo-500/15' },
  'permits & compliance':   { label: 'Permit Pro',       icon: CheckCircle2, color: 'text-orange-400',  bg: 'bg-orange-500/15' },
  'inventory & assets':     { label: 'Asset Master',     icon: CheckCircle2, color: 'text-rose-400',    bg: 'bg-rose-500/15' },
  'admin & system':         { label: 'Admin Guru',       icon: CheckCircle2, color: 'text-violet-400',  bg: 'bg-violet-500/15' },
  'analytics & reports':    { label: 'Data Wizard',      icon: CheckCircle2, color: 'text-amber-400',   bg: 'bg-amber-500/15' },
}

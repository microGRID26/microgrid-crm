import type { ComponentType } from 'react'

export interface HelpTopicData {
  id: string
  title: string
  description: string
  category: string
  keywords: string[]
  tryItLink?: string
  relatedTopics?: string[]
  content: ComponentType
}

export const CATEGORIES = [
  'Getting Started',
  'Daily Workflow',
  'Project Management',
  'Notes & Communication',
  'Financial',
  'Inventory & Materials',
  'Schedule & Crews',
  'Change Orders',
  'Reports & Analytics',
  'Administration',
  'System Features',
  'Design Tools',
]

export const WHATS_NEW = [
  { date: 'Mar 2026', title: 'Earnings Dashboard & Leaderboard', topicId: 'earnings-dashboard' },
  { date: 'Mar 2026', title: 'Commission Calculator', topicId: 'commission-calculator' },
  { date: 'Mar 2026', title: 'Engineering Assignments', topicId: 'engineering-assignments' },
  { date: 'Mar 2026', title: 'Invoices', topicId: 'invoice-management' },
  { date: 'Mar 2026', title: 'Organization Switching', topicId: 'org-switcher' },
  { date: 'Mar 2026', title: 'NTP Workflow', topicId: 'ntp-workflow' },
  { date: 'Mar 2026', title: 'Manager+ Access Controls', topicId: 'permission-matrix' },
  { date: 'Mar 2026', title: 'Nav Reorganization', topicId: 'navigating-app' },
  { date: 'Mar 2026', title: 'Permit Portal', topicId: 'permit-portal' },
  { date: 'Mar 2026', title: 'Feature Flags', topicId: 'feature-flags' },
  { date: 'Mar 2026', title: 'System Page', topicId: 'system-page' },
  { date: 'Mar 2026', title: 'Google Calendar Sync', topicId: 'calendar-sync' },
  { date: 'Mar 2026', title: 'Fleet Management', topicId: 'fleet-management' },
  { date: 'Mar 2026', title: 'Custom Fields', topicId: 'custom-fields' },
  { date: 'Mar 2026', title: 'Warranty Tracking', topicId: 'warranty-tracking' },
  { date: 'Mar 2026', title: 'Barcode Scanning', topicId: 'barcode-scanning' },
  { date: 'Mar 2026', title: 'Inventory Management', topicId: 'materials-tab' },
  { date: 'Mar 2026', title: 'Atlas AI Reports', topicId: 'atlas-reports' },
  { date: 'Mar 2026', title: 'Equipment Catalog', topicId: 'equipment-catalog' },
  { date: 'Mar 2026', title: 'Legacy Projects', topicId: 'legacy-projects' },
  { date: 'Mar 2026', title: 'Document Management', topicId: 'document-management' },
]

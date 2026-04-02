// Customer-facing labels — no internal jargon

export const STAGE_ORDER = ['evaluation', 'survey', 'design', 'permit', 'install', 'inspection', 'complete']

export const STAGE_LABELS: Record<string, string> = {
  evaluation: 'Getting Started',
  survey: 'Site Survey',
  design: 'System Design',
  permit: 'Permitting',
  install: 'Installation',
  inspection: 'Final Inspection',
  complete: 'System Active',
}

export const STAGE_DESCRIPTIONS: Record<string, string> = {
  evaluation: 'We\'re reviewing your home and preparing for your site survey.',
  survey: 'Our team is surveying your property to design the optimal system.',
  design: 'Engineers are designing your custom solar and storage system.',
  permit: 'Your permits are being processed with the city and utility.',
  install: 'Your solar panels and battery system are being installed.',
  inspection: 'City and utility inspectors are verifying your installation.',
  complete: 'Your system is live and generating clean energy.',
}

export const JOB_TYPE_LABELS: Record<string, string> = {
  survey: 'Site Survey',
  install: 'Installation',
  inspection: 'Inspection',
  service: 'Service Visit',
}

export const TICKET_CATEGORIES = [
  { value: 'service', label: 'Service Issue' },
  { value: 'billing', label: 'Billing Question' },
  { value: 'installation', label: 'Installation Question' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'other', label: 'Other' },
]

export const ATLAS_SUGGESTIONS = [
  'What stage is my project in?',
  'When is my installation?',
  'What equipment is being installed?',
  'How does battery backup work?',
  'What happens after installation?',
  'Tell me about the 60-day guarantee',
]

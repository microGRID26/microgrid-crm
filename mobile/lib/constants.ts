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

// Tasks that belong to each stage — mapped from task_state.task_id
export const STAGE_TASKS: Record<string, { id: string; label: string }[]> = {
  evaluation: [
    { id: 'welcome_call', label: 'Welcome Call Completed' },
    { id: 'credit_check', label: 'Credit Check Approved' },
    { id: 'contract_signed', label: 'Contract Signed' },
    { id: 'ntp_submitted', label: 'NTP Submitted' },
  ],
  survey: [
    { id: 'survey_scheduled', label: 'Survey Scheduled' },
    { id: 'survey_complete', label: 'Site Survey Complete' },
    { id: 'photos_uploaded', label: 'Photos Uploaded' },
  ],
  design: [
    { id: 'design_started', label: 'Design Started' },
    { id: 'design_review', label: 'Engineering Review' },
    { id: 'design_approved', label: 'Design Approved' },
    { id: 'planset_complete', label: 'Planset Finalized' },
  ],
  permit: [
    { id: 'city_permit_submitted', label: 'City Permit Submitted' },
    { id: 'city_permit_approved', label: 'City Permit Approved' },
    { id: 'utility_permit_submitted', label: 'Utility Permit Submitted' },
    { id: 'utility_permit_approved', label: 'Utility Permit Approved' },
    { id: 'hoa_approved', label: 'HOA Approval' },
  ],
  install: [
    { id: 'equipment_ordered', label: 'Equipment Ordered' },
    { id: 'equipment_delivered', label: 'Equipment Delivered' },
    { id: 'install_scheduled', label: 'Installation Scheduled' },
    { id: 'install_complete', label: 'Installation Complete' },
  ],
  inspection: [
    { id: 'city_inspection_scheduled', label: 'City Inspection Scheduled' },
    { id: 'city_inspection_passed', label: 'City Inspection Passed' },
    { id: 'utility_inspection_scheduled', label: 'Utility Inspection Scheduled' },
    { id: 'utility_inspection_passed', label: 'Utility Inspection Passed' },
    { id: 'pto_submitted', label: 'PTO Submitted' },
    { id: 'pto_granted', label: 'Permission to Operate' },
  ],
  complete: [
    { id: 'system_activated', label: 'System Activated' },
    { id: 'monitoring_live', label: 'Monitoring Live' },
  ],
}

// SLA thresholds per stage (estimated business days)
export const STAGE_SLA_DAYS: Record<string, number> = {
  evaluation: 5,
  survey: 7,
  design: 10,
  permit: 15,
  install: 5,
  inspection: 10,
  complete: 0,
}

export const DOCUMENT_CATEGORIES = ['Design', 'Permit', 'Contract', 'Inspection', 'Other'] as const

export const ATLAS_SUGGESTIONS = [
  'What stage is my project in?',
  'When is my installation?',
  'What equipment is being installed?',
  'How does battery backup work?',
  'What happens after installation?',
  'Tell me about the 60-day guarantee',
]

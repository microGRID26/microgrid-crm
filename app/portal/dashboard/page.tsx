'use client'

import { useCustomerAuth } from '@/lib/hooks/useCustomerAuth'
import { CUSTOMER_STAGE_LABELS, CUSTOMER_STAGE_DESCRIPTIONS, JOB_TYPE_LABELS } from '@/lib/api/customer-portal'
import { Calendar, Zap, Battery, Sun, CheckCircle, Clock, ArrowRight } from 'lucide-react'

const STAGE_ORDER = ['evaluation', 'survey', 'design', 'permit', 'install', 'inspection', 'complete']

export default function PortalDashboard() {
  const { account, project, timeline, schedule, loading } = useCustomerAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: 'var(--portal-border)', borderTopColor: 'var(--portal-accent)' }} />
      </div>
    )
  }

  if (!project || !account) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-6">
        <p className="text-center" style={{ color: 'var(--portal-text-muted)' }}>
          Unable to load your project. Please try again later.
        </p>
      </div>
    )
  }

  const firstName = account.name.split(' ')[0]
  const currentStageIdx = STAGE_ORDER.indexOf(project.stage)
  const stageProgress = ((currentStageIdx + 1) / STAGE_ORDER.length) * 100

  // SLA countdown: 60 days from sale_date
  const slaStartDate = project.sale_date ? new Date(project.sale_date + 'T00:00:00') : null
  const slaDays = slaStartDate ? Math.floor((Date.now() - slaStartDate.getTime()) / 86400000) : null
  const slaRemaining = slaDays !== null ? Math.max(0, 60 - slaDays) : null
  const slaPercent = slaDays !== null ? Math.min(100, (slaDays / 60) * 100) : 0
  const isComplete = project.stage === 'complete'

  // Upcoming schedule entries
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = schedule.filter(s => s.date >= today && s.status !== 'cancelled')

  // Timeline milestones from project dates
  const milestones = [
    { label: 'Contract Signed', date: project.sale_date, stage: 'evaluation' },
    { label: 'Survey Scheduled', date: project.survey_scheduled_date, stage: 'survey' },
    { label: 'Survey Complete', date: project.survey_date, stage: 'survey' },
    { label: 'City Permit Approved', date: project.city_permit_date, stage: 'permit' },
    { label: 'Utility Permit Approved', date: project.utility_permit_date, stage: 'permit' },
    { label: 'Installation Scheduled', date: project.install_scheduled_date, stage: 'install' },
    { label: 'Installation Complete', date: project.install_complete_date, stage: 'install' },
    { label: 'City Inspection Passed', date: project.city_inspection_date, stage: 'inspection' },
    { label: 'Utility Inspection Passed', date: project.utility_inspection_date, stage: 'inspection' },
    { label: 'Permission to Operate', date: project.pto_date, stage: 'complete' },
    { label: 'System Live', date: project.in_service_date, stage: 'complete' },
  ]

  const formatDate = (d: string | null) => {
    if (!d) return null
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5 pb-8">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--portal-text)' }}>
          Hi, {firstName}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--portal-text-secondary)' }}>
          Your Solar Project
        </p>
      </div>

      {/* Stage Progress */}
      <div className="rounded-2xl p-5 border" style={{ backgroundColor: 'var(--portal-surface)', borderColor: 'var(--portal-border-light)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--portal-text)' }}>
              {CUSTOMER_STAGE_LABELS[project.stage] ?? project.stage}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--portal-text-muted)' }}>
              {CUSTOMER_STAGE_DESCRIPTIONS[project.stage] ?? ''}
            </div>
          </div>
          {isComplete ? (
            <CheckCircle className="w-8 h-8" style={{ color: 'var(--portal-stage-complete)' }} />
          ) : (
            <div className="text-right">
              <div className="text-lg font-bold" style={{ color: 'var(--portal-accent)' }}>
                {currentStageIdx + 1}/{STAGE_ORDER.length}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--portal-text-muted)' }}>stages</div>
            </div>
          )}
        </div>

        {/* Stage dots */}
        <div className="flex gap-1.5">
          {STAGE_ORDER.map((stage, i) => {
            const isCompleted = i < currentStageIdx
            const isCurrent = i === currentStageIdx
            return (
              <div key={stage} className="flex-1 h-2 rounded-full transition-all"
                style={{
                  backgroundColor: isCompleted
                    ? 'var(--portal-stage-complete)'
                    : isCurrent
                      ? 'var(--portal-stage-active)'
                      : 'var(--portal-stage-upcoming)',
                }} />
            )
          })}
        </div>

        {/* Stage labels */}
        <div className="flex justify-between mt-2">
          <span className="text-[9px]" style={{ color: 'var(--portal-text-muted)' }}>Started</span>
          <span className="text-[9px]" style={{ color: 'var(--portal-text-muted)' }}>Complete</span>
        </div>
      </div>

      {/* SLA Countdown — only show if not complete */}
      {!isComplete && slaRemaining !== null && slaRemaining > 0 && (
        <div className="rounded-2xl p-5 border" style={{ backgroundColor: 'var(--portal-surface)', borderColor: 'var(--portal-border-light)' }}>
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="var(--portal-border)" strokeWidth="4" />
                <circle cx="32" cy="32" r="28" fill="none"
                  stroke={slaRemaining > 15 ? 'var(--portal-accent)' : slaRemaining > 5 ? 'var(--portal-warm)' : 'var(--portal-error)'}
                  strokeWidth="4"
                  strokeDasharray={`${(1 - slaPercent / 100) * 176} 176`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold" style={{ color: 'var(--portal-text)' }}>{slaRemaining}</span>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--portal-text)' }}>
                MicroGRID in 60 Days
              </div>
              <div className="text-xs" style={{ color: 'var(--portal-text-muted)' }}>
                {slaRemaining > 0
                  ? `${slaRemaining} days remaining`
                  : 'Target reached — finishing up'}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--portal-text-muted)' }}>
                Day {slaDays} of 60
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Schedule */}
      {upcoming.length > 0 && (
        <div className="rounded-2xl p-5 border" style={{ backgroundColor: 'var(--portal-surface)', borderColor: 'var(--portal-border-light)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4" style={{ color: 'var(--portal-accent)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--portal-text)' }}>Upcoming</span>
          </div>
          <div className="space-y-2">
            {upcoming.slice(0, 3).map(entry => (
              <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-0"
                style={{ borderColor: 'var(--portal-border-light)' }}>
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--portal-text)' }}>
                    {JOB_TYPE_LABELS[entry.job_type] ?? entry.job_type}
                  </div>
                  {entry.arrival_window && (
                    <div className="text-xs" style={{ color: 'var(--portal-text-muted)' }}>
                      {entry.arrival_window}
                    </div>
                  )}
                </div>
                <div className="text-sm font-medium" style={{ color: 'var(--portal-accent)' }}>
                  {formatDate(entry.date)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-2xl p-5 border" style={{ backgroundColor: 'var(--portal-surface)', borderColor: 'var(--portal-border-light)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4" style={{ color: 'var(--portal-accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--portal-text)' }}>Timeline</span>
        </div>
        <div className="space-y-0">
          {milestones.map((m, i) => {
            const completed = !!m.date
            const stageIdx = STAGE_ORDER.indexOf(m.stage)
            const isUpcoming = !completed && stageIdx >= currentStageIdx
            const isNext = !completed && stageIdx === currentStageIdx

            return (
              <div key={i} className="flex gap-3 relative">
                {/* Vertical line */}
                {i < milestones.length - 1 && (
                  <div className="absolute left-[9px] top-5 bottom-0 w-0.5"
                    style={{ backgroundColor: completed ? 'var(--portal-stage-complete)' : 'var(--portal-border)' }} />
                )}
                {/* Dot */}
                <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{
                    backgroundColor: completed
                      ? 'var(--portal-stage-complete)'
                      : isNext
                        ? 'var(--portal-stage-active)'
                        : 'var(--portal-border)',
                  }}>
                  {completed && <CheckCircle className="w-3 h-3 text-white" />}
                  {isNext && <ArrowRight className="w-3 h-3 text-white" />}
                </div>
                {/* Content */}
                <div className="pb-4 flex-1">
                  <div className="text-sm" style={{
                    color: completed ? 'var(--portal-text)' : isUpcoming ? 'var(--portal-text-muted)' : 'var(--portal-text-muted)',
                    fontWeight: completed || isNext ? 500 : 400,
                  }}>
                    {m.label}
                  </div>
                  {completed && m.date && (
                    <div className="text-xs" style={{ color: 'var(--portal-text-muted)' }}>
                      {formatDate(m.date)}
                    </div>
                  )}
                  {isNext && (
                    <div className="text-xs font-medium" style={{ color: 'var(--portal-stage-active)' }}>
                      In progress
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Equipment Summary */}
      <div className="rounded-2xl p-5 border" style={{ backgroundColor: 'var(--portal-surface)', borderColor: 'var(--portal-border-light)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4" style={{ color: 'var(--portal-accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--portal-text)' }}>Your System</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {project.systemkw && (
            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--portal-surface-alt)' }}>
              <Sun className="w-5 h-5 mb-1" style={{ color: 'var(--portal-warm)' }} />
              <div className="text-lg font-bold" style={{ color: 'var(--portal-text)' }}>
                {project.systemkw} kW
              </div>
              <div className="text-[10px]" style={{ color: 'var(--portal-text-muted)' }}>System Size</div>
            </div>
          )}
          {project.module && (
            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--portal-surface-alt)' }}>
              <Sun className="w-5 h-5 mb-1" style={{ color: 'var(--portal-accent)' }} />
              <div className="text-sm font-bold" style={{ color: 'var(--portal-text)' }}>
                {project.module_qty ?? ''} Panels
              </div>
              <div className="text-[10px] truncate" style={{ color: 'var(--portal-text-muted)' }}>
                {project.module}
              </div>
            </div>
          )}
          {project.battery && (
            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--portal-surface-alt)' }}>
              <Battery className="w-5 h-5 mb-1" style={{ color: 'var(--portal-accent)' }} />
              <div className="text-sm font-bold" style={{ color: 'var(--portal-text)' }}>
                Battery
              </div>
              <div className="text-[10px] truncate" style={{ color: 'var(--portal-text-muted)' }}>
                {project.battery}
              </div>
            </div>
          )}
          {project.inverter && (
            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--portal-surface-alt)' }}>
              <Zap className="w-5 h-5 mb-1" style={{ color: 'var(--portal-info)' }} />
              <div className="text-sm font-bold" style={{ color: 'var(--portal-text)' }}>
                Inverter
              </div>
              <div className="text-[10px] truncate" style={{ color: 'var(--portal-text-muted)' }}>
                {project.inverter}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Project Address */}
      <div className="rounded-2xl p-4 border text-center" style={{ backgroundColor: 'var(--portal-surface)', borderColor: 'var(--portal-border-light)' }}>
        <div className="text-xs" style={{ color: 'var(--portal-text-muted)' }}>Installation Address</div>
        <div className="text-sm font-medium mt-0.5" style={{ color: 'var(--portal-text)' }}>
          {project.address}{project.city ? `, ${project.city}` : ''}{project.zip ? ` ${project.zip}` : ''}
        </div>
        <div className="text-[10px] mt-1" style={{ color: 'var(--portal-text-muted)' }}>
          {project.id}
        </div>
      </div>
    </div>
  )
}

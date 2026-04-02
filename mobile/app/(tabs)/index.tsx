import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { theme } from '../../lib/theme'
import { getCustomerAccount, loadProject, loadTimeline, loadSchedule } from '../../lib/api'
import { STAGE_ORDER, STAGE_LABELS, STAGE_DESCRIPTIONS, JOB_TYPE_LABELS } from '../../lib/constants'
import type { CustomerAccount, CustomerProject, StageHistoryEntry, CustomerScheduleEntry } from '../../lib/types'

const formatDate = (d: string | null) => {
  if (!d) return null
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function DashboardScreen() {
  const [account, setAccount] = useState<CustomerAccount | null>(null)
  const [project, setProject] = useState<CustomerProject | null>(null)
  const [timeline, setTimeline] = useState<StageHistoryEntry[]>([])
  const [schedule, setSchedule] = useState<CustomerScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const acct = await getCustomerAccount()
    if (!acct) return
    setAccount(acct)
    const [proj, tl, sched] = await Promise.all([
      loadProject(acct.project_id),
      loadTimeline(acct.project_id),
      loadSchedule(acct.project_id),
    ])
    setProject(proj)
    setTimeline(tl)
    setSchedule(sched)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    )
  }

  if (!project || !account) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg, padding: 24 }}>
        <Text style={{ color: theme.colors.textMuted, textAlign: 'center', fontFamily: 'Inter_400Regular' }}>
          Unable to load your project.
        </Text>
      </View>
    )
  }

  const firstName = account.name.split(' ')[0]
  const currentStageIdx = STAGE_ORDER.indexOf(project.stage)
  const isComplete = project.stage === 'complete'

  // SLA countdown
  const slaStart = project.sale_date ? new Date(project.sale_date + 'T00:00:00') : null
  const slaDays = slaStart ? Math.floor((Date.now() - slaStart.getTime()) / 86400000) : null
  const slaRemaining = slaDays !== null ? Math.max(0, 60 - slaDays) : null

  // Upcoming schedule
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = schedule.filter(s => s.date >= today && s.status !== 'cancelled')

  // Timeline milestones
  const milestones = [
    { label: 'Contract Signed', date: project.sale_date },
    { label: 'Survey Scheduled', date: project.survey_scheduled_date },
    { label: 'Survey Complete', date: project.survey_date },
    { label: 'City Permit Approved', date: project.city_permit_date },
    { label: 'Utility Permit Approved', date: project.utility_permit_date },
    { label: 'Installation Scheduled', date: project.install_scheduled_date },
    { label: 'Installation Complete', date: project.install_complete_date },
    { label: 'City Inspection Passed', date: project.city_inspection_date },
    { label: 'Utility Inspection Passed', date: project.utility_inspection_date },
    { label: 'Permission to Operate', date: project.pto_date },
    { label: 'System Live', date: project.in_service_date },
  ]

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}
    >
      {/* Header */}
      <Text style={{ fontSize: 22, fontWeight: '700', color: theme.colors.text, fontFamily: 'Inter_700Bold', marginTop: 48 }}>
        Hi, {firstName}
      </Text>
      <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginTop: 2, fontFamily: 'Inter_400Regular' }}>
        Your Solar Project
      </Text>

      {/* Stage Progress Card */}
      <View style={{
        backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl,
        padding: 20, marginTop: 20,
        borderWidth: 1, borderColor: theme.colors.borderLight,
        ...theme.shadow.card,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }}>
              {STAGE_LABELS[project.stage] ?? project.stage}
            </Text>
            <Text style={{ fontSize: 12, color: theme.colors.textMuted, marginTop: 2, fontFamily: 'Inter_400Regular' }}>
              {STAGE_DESCRIPTIONS[project.stage] ?? ''}
            </Text>
          </View>
          {isComplete ? (
            <Feather name="check-circle" size={32} color={theme.colors.stageComplete} />
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.accent, fontFamily: 'Inter_700Bold' }}>
                {currentStageIdx + 1}/{STAGE_ORDER.length}
              </Text>
              <Text style={{ fontSize: 9, color: theme.colors.textMuted }}>stages</Text>
            </View>
          )}
        </View>

        {/* Progress bar */}
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {STAGE_ORDER.map((stage, i) => (
            <View key={stage} style={{
              flex: 1, height: 6, borderRadius: 3,
              backgroundColor: i < currentStageIdx
                ? theme.colors.stageComplete
                : i === currentStageIdx
                  ? theme.colors.stageActive
                  : theme.colors.stageUpcoming,
            }} />
          ))}
        </View>
      </View>

      {/* SLA Countdown */}
      {!isComplete && slaRemaining !== null && (
        <View style={{
          backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl,
          padding: 20, marginTop: 12,
          borderWidth: 1, borderColor: theme.colors.borderLight,
          flexDirection: 'row', alignItems: 'center', gap: 16,
          ...theme.shadow.card,
        }}>
          <View style={{
            width: 64, height: 64, borderRadius: 32,
            borderWidth: 3,
            borderColor: slaRemaining > 15 ? theme.colors.accent : slaRemaining > 5 ? theme.colors.warm : theme.colors.error,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: theme.colors.text, fontFamily: 'Inter_700Bold' }}>
              {slaRemaining}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }}>
              MicroGRID in 60 Days
            </Text>
            <Text style={{ fontSize: 12, color: theme.colors.textMuted, fontFamily: 'Inter_400Regular' }}>
              {slaRemaining > 0 ? `${slaRemaining} days remaining` : 'Target reached'}
            </Text>
            <Text style={{ fontSize: 10, color: theme.colors.textMuted, marginTop: 2 }}>
              Day {slaDays} of 60
            </Text>
          </View>
        </View>
      )}

      {/* Upcoming Schedule */}
      {upcoming.length > 0 && (
        <View style={{
          backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl,
          padding: 20, marginTop: 12,
          borderWidth: 1, borderColor: theme.colors.borderLight,
          ...theme.shadow.card,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Feather name="calendar" size={16} color={theme.colors.accent} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }}>
              Upcoming
            </Text>
          </View>
          {upcoming.slice(0, 3).map(entry => (
            <View key={entry.id} style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingVertical: 10,
              borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight,
            }}>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.text, fontFamily: 'Inter_500Medium' }}>
                  {JOB_TYPE_LABELS[entry.job_type] ?? entry.job_type}
                </Text>
                {entry.arrival_window && (
                  <Text style={{ fontSize: 12, color: theme.colors.textMuted }}>{entry.arrival_window}</Text>
                )}
              </View>
              <Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.accent, fontFamily: 'Inter_500Medium' }}>
                {formatDate(entry.date)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Timeline */}
      <View style={{
        backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl,
        padding: 20, marginTop: 12,
        borderWidth: 1, borderColor: theme.colors.borderLight,
        ...theme.shadow.card,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Feather name="clock" size={16} color={theme.colors.accent} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }}>
            Timeline
          </Text>
        </View>
        {milestones.map((m, i) => {
          const completed = !!m.date
          const isNext = !completed && i > 0 && !!milestones[i - 1]?.date
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
              {/* Line + dot */}
              <View style={{ alignItems: 'center', width: 20 }}>
                <View style={{
                  width: 16, height: 16, borderRadius: 8,
                  backgroundColor: completed ? theme.colors.stageComplete : isNext ? theme.colors.stageActive : theme.colors.border,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {completed && <Feather name="check" size={10} color="#fff" />}
                  {isNext && <Feather name="arrow-right" size={8} color="#fff" />}
                </View>
                {i < milestones.length - 1 && (
                  <View style={{
                    width: 2, flex: 1, minHeight: 24,
                    backgroundColor: completed ? theme.colors.stageComplete : theme.colors.border,
                  }} />
                )}
              </View>
              {/* Content */}
              <View style={{ flex: 1, paddingBottom: 16 }}>
                <Text style={{
                  fontSize: 14, fontFamily: completed || isNext ? 'Inter_500Medium' : 'Inter_400Regular',
                  color: completed ? theme.colors.text : theme.colors.textMuted,
                }}>
                  {m.label}
                </Text>
                {completed && m.date && (
                  <Text style={{ fontSize: 12, color: theme.colors.textMuted, fontFamily: 'Inter_400Regular' }}>
                    {formatDate(m.date)}
                  </Text>
                )}
                {isNext && (
                  <Text style={{ fontSize: 12, color: theme.colors.stageActive, fontFamily: 'Inter_500Medium' }}>
                    In progress
                  </Text>
                )}
              </View>
            </View>
          )
        })}
      </View>

      {/* Equipment */}
      <View style={{
        backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl,
        padding: 20, marginTop: 12,
        borderWidth: 1, borderColor: theme.colors.borderLight,
        ...theme.shadow.card,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Feather name="zap" size={16} color={theme.colors.accent} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }}>
            Your System
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {project.systemkw && (
            <View style={{ width: '48%', backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.lg, padding: 12 }}>
              <Feather name="sun" size={18} color={theme.colors.warm} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text, marginTop: 4, fontFamily: 'Inter_700Bold' }}>
                {project.systemkw} kW
              </Text>
              <Text style={{ fontSize: 10, color: theme.colors.textMuted }}>System Size</Text>
            </View>
          )}
          {project.module && (
            <View style={{ width: '48%', backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.lg, padding: 12 }}>
              <Feather name="sun" size={18} color={theme.colors.accent} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text, marginTop: 4, fontFamily: 'Inter_700Bold' }}>
                {project.module_qty ?? ''} Panels
              </Text>
              <Text style={{ fontSize: 10, color: theme.colors.textMuted }} numberOfLines={1}>{project.module}</Text>
            </View>
          )}
          {project.battery && (
            <View style={{ width: '48%', backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.lg, padding: 12 }}>
              <Feather name="battery-charging" size={18} color={theme.colors.accent} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text, marginTop: 4, fontFamily: 'Inter_700Bold' }}>
                Battery
              </Text>
              <Text style={{ fontSize: 10, color: theme.colors.textMuted }} numberOfLines={1}>{project.battery}</Text>
            </View>
          )}
          {project.inverter && (
            <View style={{ width: '48%', backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.lg, padding: 12 }}>
              <Feather name="zap" size={18} color={theme.colors.info} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text, marginTop: 4, fontFamily: 'Inter_700Bold' }}>
                Inverter
              </Text>
              <Text style={{ fontSize: 10, color: theme.colors.textMuted }} numberOfLines={1}>{project.inverter}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Address */}
      <View style={{
        backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl,
        padding: 16, marginTop: 12, alignItems: 'center',
        borderWidth: 1, borderColor: theme.colors.borderLight,
      }}>
        <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>Installation Address</Text>
        <Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.text, marginTop: 2, fontFamily: 'Inter_500Medium', textAlign: 'center' }}>
          {project.address}{project.city ? `, ${project.city}` : ''}{project.zip ? ` ${project.zip}` : ''}
        </Text>
        <Text style={{ fontSize: 10, color: theme.colors.textMuted, marginTop: 4 }}>{project.id}</Text>
      </View>
    </ScrollView>
  )
}

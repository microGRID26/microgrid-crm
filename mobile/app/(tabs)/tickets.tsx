import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native'
import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { theme, useThemeColors } from '../../lib/theme'
import { getCustomerAccount, loadTickets, createTicket } from '../../lib/api'
import { TICKET_CATEGORIES } from '../../lib/constants'
import type { CustomerAccount, CustomerTicket } from '../../lib/types'

function getStatusConfig(colors: any): Record<string, { label: string; color: string }> {
  return {
    open: { label: 'Open', color: colors.info },
    assigned: { label: 'Assigned', color: colors.info },
    in_progress: { label: 'In Progress', color: colors.warm },
    waiting_on_customer: { label: 'Waiting on You', color: colors.warm },
    waiting_on_vendor: { label: 'In Progress', color: colors.warm },
    escalated: { label: 'Escalated', color: colors.error },
    resolved: { label: 'Resolved', color: colors.accent },
    closed: { label: 'Closed', color: colors.textMuted },
  }
}

export default function TicketsScreen() {
  const colors = useThemeColors()
  const [account, setAccount] = useState<CustomerAccount | null>(null)
  const [tickets, setTickets] = useState<CustomerTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('service')

  const load = useCallback(async () => {
    const acct = await getCustomerAccount()
    if (!acct) return
    setAccount(acct)
    const tix = await loadTickets(acct.project_id)
    setTickets(tix)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const handleCreate = async () => {
    if (!account || !title.trim()) return
    setCreating(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const ticket = await createTicket(account.project_id, title.trim(), description.trim(), category, account.name)
    setCreating(false)
    if (ticket) {
      setTickets(prev => [ticket, ...prev])
      setShowCreate(false)
      setTitle('')
      setDescription('')
      setCategory('service')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    )
  }

  const openCount = tickets.filter(t => !['resolved', 'closed'].includes(t.status)).length

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 56, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, fontFamily: 'Inter_700Bold' }}>Support</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, fontFamily: 'Inter_400Regular' }}>
              {openCount > 0 ? `${openCount} open request${openCount > 1 ? 's' : ''}` : 'No open requests'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowCreate(true)}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: colors.accent, borderRadius: theme.radius.xl,
              paddingHorizontal: 16, paddingVertical: 10,
            }}
          >
            <Feather name="plus" size={16} color={colors.accentText} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.accentText, fontFamily: 'Inter_600SemiBold' }}>
              New Request
            </Text>
          </TouchableOpacity>
        </View>

        {/* Ticket list */}
        <View style={{ marginTop: 16, gap: 8 }}>
          {tickets.length === 0 ? (
            <View style={{
              backgroundColor: colors.surface, borderRadius: theme.radius.xl,
              padding: 32, alignItems: 'center',
              borderWidth: 1, borderColor: colors.borderLight,
            }}>
              <Feather name="message-square" size={40} color={colors.border} />
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text, marginTop: 12, fontFamily: 'Inter_500Medium' }}>
                No support requests yet
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: 'center', fontFamily: 'Inter_400Regular' }}>
                Tap &quot;New Request&quot; if you need help.
              </Text>
            </View>
          ) : tickets.map(ticket => {
            const statusMap = getStatusConfig(colors)
            const status = statusMap[ticket.status] ?? statusMap.open
            return (
              <TouchableOpacity key={ticket.id} activeOpacity={0.7}
                style={{
                  backgroundColor: colors.surface, borderRadius: theme.radius.xl,
                  padding: 16, borderWidth: 1, borderColor: colors.borderLight,
                  ...theme.shadow.card,
                }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text, fontFamily: 'Inter_500Medium' }} numberOfLines={1}>
                  {ticket.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <View style={{
                    backgroundColor: status.color + '20', paddingHorizontal: 8, paddingVertical: 2,
                    borderRadius: theme.radius.pill,
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '500', color: status.color, fontFamily: 'Inter_500Medium' }}>
                      {status.label}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 10, color: colors.textMuted }}>
                    {new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>

      {/* Create ticket modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ padding: 16, paddingTop: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, fontFamily: 'Inter_700Bold' }}>
                New Request
              </Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Feather name="x" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 6, fontFamily: 'Inter_500Medium' }}>
              What do you need help with?
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Describe your issue briefly"
              placeholderTextColor={colors.textMuted}
              autoFocus
              style={{
                backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                borderRadius: theme.radius.xl, paddingHorizontal: 16, paddingVertical: 14,
                fontSize: 16, color: colors.text, fontFamily: 'Inter_400Regular',
              }}
            />

            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginTop: 16, marginBottom: 6, fontFamily: 'Inter_500Medium' }}>
              Details (optional)
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Provide additional details..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={{
                backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                borderRadius: theme.radius.xl, paddingHorizontal: 16, paddingVertical: 14,
                fontSize: 14, color: colors.text, fontFamily: 'Inter_400Regular',
                minHeight: 100,
              }}
            />

            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginTop: 16, marginBottom: 6, fontFamily: 'Inter_500Medium' }}>
              Category
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {TICKET_CATEGORIES.map(cat => (
                <TouchableOpacity key={cat.value} onPress={() => setCategory(cat.value)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8,
                    borderRadius: theme.radius.pill,
                    backgroundColor: category === cat.value ? colors.accent : colors.surface,
                    borderWidth: 1,
                    borderColor: category === cat.value ? colors.accent : colors.border,
                  }}>
                  <Text style={{
                    fontSize: 13, fontWeight: '500',
                    color: category === cat.value ? colors.accentText : colors.textSecondary,
                    fontFamily: 'Inter_500Medium',
                  }}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleCreate}
              disabled={creating || !title.trim()}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.accent, borderRadius: theme.radius.xl,
                paddingVertical: 14, marginTop: 24, alignItems: 'center',
                opacity: creating || !title.trim() ? 0.5 : 1,
              }}
            >
              {creating ? (
                <ActivityIndicator color={colors.accentText} />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.accentText, fontFamily: 'Inter_600SemiBold' }}>
                  Submit Request
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

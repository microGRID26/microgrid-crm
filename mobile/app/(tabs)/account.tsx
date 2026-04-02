import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { theme, useThemeColors } from '../../lib/theme'
import { supabase } from '../../lib/supabase'
import { getCustomerAccount, loadProject } from '../../lib/api'
import type { CustomerAccount, CustomerProject } from '../../lib/types'

export default function AccountScreen() {
  const colors = useThemeColors()
  const [account, setAccount] = useState<CustomerAccount | null>(null)
  const [project, setProject] = useState<CustomerProject | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const acct = await getCustomerAccount()
      if (acct) {
        setAccount(acct)
        const proj = await loadProject(acct.project_id)
        setProject(proj)
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          await supabase.auth.signOut()
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    )
  }

  if (!account) return null

  const Row = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <Feather name={icon as any} size={16} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: colors.textMuted, fontFamily: 'Inter_400Regular' }}>{label}</Text>
        <Text style={{ fontSize: 14, color: colors.text, fontFamily: 'Inter_500Medium', marginTop: 1 }}>{value}</Text>
      </View>
    </View>
  )

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingTop: 56, paddingBottom: 32 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, fontFamily: 'Inter_700Bold' }}>Account</Text>

      {/* Profile */}
      <View style={{
        backgroundColor: colors.surface, borderRadius: theme.radius.xl,
        padding: 20, marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 16,
        borderWidth: 1, borderColor: colors.borderLight, ...theme.shadow.card,
      }}>
        <View style={{
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: colors.accentLight,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.accent }}>
            {account.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, fontFamily: 'Inter_600SemiBold' }}>{account.name}</Text>
          <Text style={{ fontSize: 13, color: colors.textMuted, fontFamily: 'Inter_400Regular' }}>{account.email}</Text>
        </View>
      </View>

      {/* Contact */}
      <View style={{
        backgroundColor: colors.surface, borderRadius: theme.radius.xl,
        padding: 20, marginTop: 12,
        borderWidth: 1, borderColor: colors.borderLight, ...theme.shadow.card,
      }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, fontFamily: 'Inter_600SemiBold' }}>
          Contact
        </Text>
        <Row icon="mail" label="Email" value={account.email} />
        {account.phone && <Row icon="phone" label="Phone" value={account.phone} />}
        {project?.address && <Row icon="map-pin" label="Address" value={`${project.address}${project.city ? `, ${project.city}` : ''} ${project.zip ?? ''}`} />}
      </View>

      {/* Project */}
      <View style={{
        backgroundColor: colors.surface, borderRadius: theme.radius.xl,
        padding: 20, marginTop: 12,
        borderWidth: 1, borderColor: colors.borderLight, ...theme.shadow.card,
      }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, fontFamily: 'Inter_600SemiBold' }}>
          Project
        </Text>
        <Row icon="hash" label="Project ID" value={account.project_id} />
        {project?.financier && <Row icon="credit-card" label="Financing" value={project.financier} />}
        {project?.systemkw && <Row icon="zap" label="System Size" value={`${project.systemkw} kW`} />}
      </View>

      {/* Security */}
      <View style={{
        backgroundColor: colors.surface, borderRadius: theme.radius.xl,
        padding: 20, marginTop: 12,
        borderWidth: 1, borderColor: colors.borderLight, ...theme.shadow.card,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Feather name="shield" size={16} color={colors.accent} />
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', fontFamily: 'Inter_600SemiBold' }}>Security</Text>
        </View>
        <Text style={{ fontSize: 12, color: colors.textMuted, fontFamily: 'Inter_400Regular', lineHeight: 18 }}>
          Signed in via secure email link. Your data is encrypted and protected.
        </Text>
        {account.last_login_at && (
          <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>
            Last login: {new Date(account.last_login_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </Text>
        )}
      </View>

      {/* Sign Out */}
      <TouchableOpacity onPress={handleSignOut} activeOpacity={0.7}
        style={{
          backgroundColor: colors.surface, borderRadius: theme.radius.xl,
          padding: 16, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          borderWidth: 1, borderColor: colors.borderLight,
        }}>
        <Feather name="log-out" size={16} color={colors.error} />
        <Text style={{ fontSize: 14, fontWeight: '500', color: colors.error, fontFamily: 'Inter_500Medium' }}>Sign Out</Text>
      </TouchableOpacity>

      {/* Branding */}
      <View style={{ alignItems: 'center', marginTop: 32 }}>
        <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textMuted, fontFamily: 'Inter_500Medium' }}>MicroGRID</Text>
        <Text style={{ fontSize: 10, color: colors.textMuted }}>powered by EDGE</Text>
        <Text style={{ fontSize: 9, color: colors.textMuted, marginTop: 4 }}>Dependable Power. Predictable Cost.</Text>
      </View>
    </ScrollView>
  )
}

import { useEffect } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { theme, useThemeColors } from '../../lib/theme'

export default function AuthCallback() {
  const colors = useThemeColors()
  const router = useRouter()
  const params = useLocalSearchParams()

  useEffect(() => {
    async function handleCallback() {
      const code = params.code as string | undefined
      if (!code) {
        router.replace('/(auth)/login')
        return
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.error('[auth callback]', error)
        router.replace('/(auth)/login')
        return
      }

      // Session is now set — the root layout auth guard will redirect to (tabs)
      router.replace('/(tabs)')
    }

    handleCallback()
  }, [params.code])

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={{ marginTop: 16, fontSize: 14, color: colors.textMuted, fontFamily: 'Inter_400Regular' }}>
        Signing you in...
      </Text>
    </View>
  )
}

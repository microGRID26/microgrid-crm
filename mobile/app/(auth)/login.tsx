import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { supabase } from '../../lib/supabase'
import { theme } from '../../lib/theme'
import * as Haptics from 'expo-haptics'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: 'microgrid://auth/callback',
      },
    })

    setLoading(false)
    if (authError) {
      setError('Unable to send login link. Please try again.')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } else {
      setSent(true)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
    >
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 16,
            backgroundColor: theme.colors.accent,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.accentText }}>M</Text>
          </View>
          <Text style={{ fontSize: 24, fontWeight: '700', color: theme.colors.text, fontFamily: 'Inter_700Bold' }}>
            MicroGRID
          </Text>
          <Text style={{ fontSize: 11, color: theme.colors.textMuted, marginTop: 4, fontFamily: 'Inter_400Regular' }}>
            powered by EDGE
          </Text>
        </View>

        {sent ? (
          /* Success state */
          <View style={{
            backgroundColor: theme.colors.accentLight,
            borderRadius: theme.radius.xl,
            padding: 24,
            alignItems: 'center',
          }}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>&#9993;</Text>
            <Text style={{ fontSize: 18, fontWeight: '600', color: theme.colors.accentDark, fontFamily: 'Inter_600SemiBold', marginBottom: 8 }}>
              Check your email
            </Text>
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', fontFamily: 'Inter_400Regular', lineHeight: 20 }}>
              We sent a login link to{'\n'}
              <Text style={{ fontWeight: '600' }}>{email}</Text>
            </Text>
            <TouchableOpacity onPress={() => { setSent(false); setEmail('') }} style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.accent, fontFamily: 'Inter_500Medium' }}>
                Use a different email
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Login form */
          <View>
            <Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.textSecondary, marginBottom: 8, fontFamily: 'Inter_500Medium' }}>
              Email address
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              autoFocus
              style={{
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.xl,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 16,
                color: theme.colors.text,
                fontFamily: 'Inter_400Regular',
              }}
            />

            {error ? (
              <Text style={{ color: theme.colors.error, fontSize: 13, marginTop: 8, fontFamily: 'Inter_400Regular' }}>
                {error}
              </Text>
            ) : null}

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading || !email.trim()}
              activeOpacity={0.8}
              style={{
                backgroundColor: theme.colors.accent,
                borderRadius: theme.radius.xl,
                paddingVertical: 14,
                marginTop: 16,
                alignItems: 'center',
                opacity: loading || !email.trim() ? 0.5 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.accentText} />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.accentText, fontFamily: 'Inter_600SemiBold' }}>
                  Continue with Email
                </Text>
              )}
            </TouchableOpacity>

            <Text style={{
              textAlign: 'center',
              fontSize: 12,
              color: theme.colors.textMuted,
              marginTop: 16,
              paddingHorizontal: 24,
              fontFamily: 'Inter_400Regular',
              lineHeight: 18,
            }}>
              We&apos;ll send you a secure link to sign in. No password needed.
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={{ alignItems: 'center', marginTop: 48 }}>
          <Text style={{ fontSize: 10, color: theme.colors.textMuted, fontFamily: 'Inter_400Regular' }}>
            The Future of Residential Energy
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

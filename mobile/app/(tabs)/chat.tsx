import { useState, useRef, useEffect } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { theme, useThemeColors } from '../../lib/theme'
import { getCustomerAccount, sendAtlasMessage } from '../../lib/api'
import { ATLAS_SUGGESTIONS } from '../../lib/constants'
import type { ChatMessage } from '../../lib/types'

export default function ChatScreen() {
  const colors = useThemeColors()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [customerName, setCustomerName] = useState<string | null>(null)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    getCustomerAccount().then(acct => {
      setCustomerName(acct ? acct.name.split(' ')[0] : 'there')
    })
  }, [])

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }, [messages])

  const send = async (text: string) => {
    if (!text.trim() || sending) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const userMsg: ChatMessage = { role: 'user', content: text.trim() }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setSending(true)

    try {
      const response = await sendAtlasMessage(updated)
      setMessages(prev => [...prev, { role: 'assistant', content: response }])
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    } catch (err) {
      console.error('[atlas] chat failed:', err)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I\'m having trouble connecting right now. Please try again, or use the Support tab to create a ticket.',
      }])
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setSending(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.bg }}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingTop: 56, paddingBottom: 16 }}
      >
        {messages.length === 0 && !customerName ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : messages.length === 0 && customerName ? (
          /* Welcome */
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: colors.accentLight,
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <Feather name="zap" size={28} color={colors.accent} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '600', color: colors.text, fontFamily: 'Inter_600SemiBold' }}>
              Hi {customerName}, I&apos;m Atlas
            </Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 4, fontFamily: 'Inter_400Regular' }}>
              Your energy assistant
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 24, paddingHorizontal: 16 }}>
              {ATLAS_SUGGESTIONS.map(prompt => (
                <TouchableOpacity key={prompt} onPress={() => send(prompt)} activeOpacity={0.7}
                  style={{
                    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                    borderRadius: theme.radius.xl, paddingHorizontal: 12, paddingVertical: 8,
                  }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: 'Inter_400Regular' }}>
                    {prompt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          /* Messages */
          <>
            {messages.map((msg, i) => (
              <View key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%', marginBottom: 8,
              }}>
                <View style={{
                  backgroundColor: msg.role === 'user' ? colors.accent : colors.surface,
                  borderRadius: theme.radius.xl,
                  borderBottomRightRadius: msg.role === 'user' ? 4 : theme.radius.xl,
                  borderBottomLeftRadius: msg.role === 'assistant' ? 4 : theme.radius.xl,
                  paddingHorizontal: 16, paddingVertical: 12,
                  borderWidth: msg.role === 'assistant' ? 1 : 0,
                  borderColor: colors.borderLight,
                  ...theme.shadow.card,
                }}>
                  {msg.role === 'assistant' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <Feather name="zap" size={10} color={colors.accent} />
                      <Text style={{ fontSize: 10, fontWeight: '600', color: colors.accent, fontFamily: 'Inter_600SemiBold' }}>
                        Atlas
                      </Text>
                    </View>
                  )}
                  <Text style={{
                    fontSize: 14, lineHeight: 20,
                    color: msg.role === 'user' ? colors.accentText : colors.text,
                    fontFamily: 'Inter_400Regular',
                  }}>
                    {msg.content}
                  </Text>
                </View>
              </View>
            ))}

            {sending && (
              <View style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                <View style={{
                  backgroundColor: colors.surface, borderRadius: theme.radius.xl,
                  borderBottomLeftRadius: 4, paddingHorizontal: 16, paddingVertical: 12,
                  borderWidth: 1, borderColor: colors.borderLight,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <Feather name="zap" size={10} color={colors.accent} />
                    <Text style={{ fontSize: 10, fontWeight: '600', color: colors.accent, fontFamily: 'Inter_600SemiBold' }}>Atlas</Text>
                  </View>
                  <ActivityIndicator size="small" color={colors.textMuted} />
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Input */}
      <View style={{
        flexDirection: 'row', gap: 8,
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: colors.surface,
        borderTopWidth: 1, borderTopColor: colors.borderLight,
      }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask Atlas anything..."
          placeholderTextColor={colors.textMuted}
          style={{
            flex: 1, backgroundColor: colors.bg,
            borderWidth: 1, borderColor: colors.border,
            borderRadius: theme.radius.xl, paddingHorizontal: 16, paddingVertical: 12,
            fontSize: 16, color: colors.text, fontFamily: 'Inter_400Regular',
          }}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
          editable={!sending}
        />
        <TouchableOpacity
          onPress={() => send(input)}
          disabled={sending || !input.trim()}
          activeOpacity={0.7}
          style={{
            backgroundColor: colors.accent, borderRadius: theme.radius.xl,
            width: 48, height: 48, alignItems: 'center', justifyContent: 'center',
            opacity: sending || !input.trim() ? 0.3 : 1,
          }}
        >
          <Feather name="send" size={20} color={colors.accentText} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

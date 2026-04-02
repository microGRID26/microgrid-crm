import { useState, useRef, useEffect } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { theme } from '../../lib/theme'
import { getCustomerAccount, sendAtlasMessage } from '../../lib/api'
import { ATLAS_SUGGESTIONS } from '../../lib/constants'
import type { ChatMessage } from '../../lib/types'

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [customerName, setCustomerName] = useState('there')
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    getCustomerAccount().then(acct => {
      if (acct) setCustomerName(acct.name.split(' ')[0])
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
    } catch {
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
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingTop: 56, paddingBottom: 16 }}
      >
        {messages.length === 0 ? (
          /* Welcome */
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: theme.colors.accentLight,
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <Feather name="zap" size={28} color={theme.colors.accent} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '600', color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }}>
              Hi {customerName}, I&apos;m Atlas
            </Text>
            <Text style={{ fontSize: 14, color: theme.colors.textMuted, marginTop: 4, fontFamily: 'Inter_400Regular' }}>
              Your energy assistant
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 24, paddingHorizontal: 16 }}>
              {ATLAS_SUGGESTIONS.map(prompt => (
                <TouchableOpacity key={prompt} onPress={() => send(prompt)} activeOpacity={0.7}
                  style={{
                    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
                    borderRadius: theme.radius.xl, paddingHorizontal: 12, paddingVertical: 8,
                  }}>
                  <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }}>
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
                  backgroundColor: msg.role === 'user' ? theme.colors.accent : theme.colors.surface,
                  borderRadius: theme.radius.xl,
                  borderBottomRightRadius: msg.role === 'user' ? 4 : theme.radius.xl,
                  borderBottomLeftRadius: msg.role === 'assistant' ? 4 : theme.radius.xl,
                  paddingHorizontal: 16, paddingVertical: 12,
                  borderWidth: msg.role === 'assistant' ? 1 : 0,
                  borderColor: theme.colors.borderLight,
                  ...theme.shadow.card,
                }}>
                  {msg.role === 'assistant' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <Feather name="zap" size={10} color={theme.colors.accent} />
                      <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.accent, fontFamily: 'Inter_600SemiBold' }}>
                        Atlas
                      </Text>
                    </View>
                  )}
                  <Text style={{
                    fontSize: 14, lineHeight: 20,
                    color: msg.role === 'user' ? theme.colors.accentText : theme.colors.text,
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
                  backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl,
                  borderBottomLeftRadius: 4, paddingHorizontal: 16, paddingVertical: 12,
                  borderWidth: 1, borderColor: theme.colors.borderLight,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <Feather name="zap" size={10} color={theme.colors.accent} />
                    <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.accent, fontFamily: 'Inter_600SemiBold' }}>Atlas</Text>
                  </View>
                  <ActivityIndicator size="small" color={theme.colors.textMuted} />
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
        backgroundColor: theme.colors.surface,
        borderTopWidth: 1, borderTopColor: theme.colors.borderLight,
      }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask Atlas anything..."
          placeholderTextColor={theme.colors.textMuted}
          style={{
            flex: 1, backgroundColor: theme.colors.bg,
            borderWidth: 1, borderColor: theme.colors.border,
            borderRadius: theme.radius.xl, paddingHorizontal: 16, paddingVertical: 12,
            fontSize: 16, color: theme.colors.text, fontFamily: 'Inter_400Regular',
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
            backgroundColor: theme.colors.accent, borderRadius: theme.radius.xl,
            width: 48, height: 48, alignItems: 'center', justifyContent: 'center',
            opacity: sending || !input.trim() ? 0.3 : 1,
          }}
        >
          <Feather name="send" size={20} color={theme.colors.accentText} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

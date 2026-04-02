import { useState, useEffect, useCallback, useRef } from 'react'
import { Tabs } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useThemeColors, theme } from '../../lib/theme'
import { getCustomerAccount } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import * as SecureStore from 'expo-secure-store'
import * as Haptics from 'expo-haptics'

export default function TabLayout() {
  const colors = useThemeColors()
  const [unreadCount, setUnreadCount] = useState(0)

  const checkUnread = useCallback(async () => {
    try {
      const acct = await getCustomerAccount()
      if (!acct) return
      const lastSeen = await SecureStore.getItemAsync('mg_support_seen') ?? '2000-01-01T00:00:00Z'

      // Get all tickets for this project
      const { data: tickets } = await supabase
        .from('tickets')
        .select('id')
        .eq('project_id', acct.project_id)
        .not('status', 'in', '("closed")')

      if (!tickets?.length) { setUnreadCount(0); return }

      // Check each ticket for new non-customer comments since last seen
      const ticketIds = tickets.map((t: any) => t.id)
      const { count } = await supabase
        .from('ticket_comments')
        .select('id', { count: 'exact', head: true })
        .in('ticket_id', ticketIds)
        .neq('author', acct.name)
        .eq('is_internal', false)
        .gt('created_at', lastSeen)

      setUnreadCount(count ?? 0)
    } catch (err) {
      console.log('[badge] check failed:', err)
    }
  }, [])

  const markSeen = useCallback(async () => {
    await SecureStore.setItemAsync('mg_support_seen', new Date().toISOString())
    setUnreadCount(0)
  }, [])

  useEffect(() => {
    checkUnread()
    const interval = setInterval(checkUnread, 30000)
    return () => clearInterval(interval)
  }, [checkUnread])

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          paddingTop: 4,
          height: 84,
          paddingBottom: 28,
        },
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
          fontSize: 10,
          marginTop: 2,
        },
      }}
      screenListeners={{
        tabPress: (e) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          // Clear badge when Support tab is tapped
          if (e.target?.startsWith('tickets')) {
            markSeen()
          }
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: 'Support',
          tabBarIcon: ({ color, size }) => <Feather name="message-square" size={size} color={color} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.accent,
            color: colors.accentText,
            fontSize: 10,
            fontFamily: 'Inter_600SemiBold',
            minWidth: 18,
            height: 18,
            lineHeight: 18,
            borderRadius: 9,
          },
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Atlas',
          tabBarIcon: ({ color, size }) => <Feather name="zap" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}

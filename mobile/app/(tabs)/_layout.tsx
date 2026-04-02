import { useState, useEffect, useCallback } from 'react'
import { Tabs } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useThemeColors, theme } from '../../lib/theme'
import { getCustomerAccount, loadTickets } from '../../lib/api'
import * as Haptics from 'expo-haptics'

export default function TabLayout() {
  const colors = useThemeColors()
  const [openTickets, setOpenTickets] = useState(0)

  // Load badge counts
  const loadBadges = useCallback(async () => {
    const acct = await getCustomerAccount()
    if (!acct) return
    const tickets = await loadTickets(acct.project_id)
    setOpenTickets(tickets.filter(t => !['resolved', 'closed'].includes(t.status)).length)
  }, [])

  useEffect(() => {
    loadBadges()
    // Refresh badges every 30 seconds
    const interval = setInterval(loadBadges, 30000)
    return () => clearInterval(interval)
  }, [loadBadges])

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
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          loadBadges()
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
          tabBarBadge: openTickets > 0 ? openTickets : undefined,
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

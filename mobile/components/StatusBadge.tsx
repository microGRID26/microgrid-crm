import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { theme } from '../lib/theme'

interface StatusBadgeProps {
  label: string
  color: string
  small?: boolean
}

export function StatusBadge({ label, color, small = false }: StatusBadgeProps) {
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: color + '1A', // 10% opacity hex suffix
          paddingVertical: small ? theme.spacing.xs : theme.spacing.sm,
          paddingHorizontal: small ? theme.spacing.sm : theme.spacing.md,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color,
            fontSize: small ? 11 : 13,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: theme.radius.pill,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
})

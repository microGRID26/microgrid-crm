import React, { useEffect, useRef } from 'react'
import { View, Animated, StyleSheet } from 'react-native'
import { useThemeColors, theme } from '../lib/theme'

interface SkeletonLoaderProps {
  lines?: number
  showAvatar?: boolean
  showImage?: boolean
}

export function SkeletonLoader({
  lines = 3,
  showAvatar = false,
  showImage = false,
}: SkeletonLoaderProps) {
  const colors = useThemeColors()
  const pulse = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    )
    animation.start()
    return () => animation.stop()
  }, [pulse])

  const skeletonColor = colors.surfaceAlt

  return (
    <View style={[styles.container, { padding: theme.spacing.lg }]}>
      {showAvatar && (
        <View style={styles.avatarRow}>
          <Animated.View
            style={[
              styles.avatar,
              { backgroundColor: skeletonColor, opacity: pulse },
            ]}
          />
          <View style={styles.avatarLines}>
            <Animated.View
              style={[
                styles.line,
                {
                  backgroundColor: skeletonColor,
                  opacity: pulse,
                  width: '60%',
                  height: 14,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.line,
                {
                  backgroundColor: skeletonColor,
                  opacity: pulse,
                  width: '40%',
                  height: 12,
                  marginTop: theme.spacing.sm,
                },
              ]}
            />
          </View>
        </View>
      )}

      {showImage && (
        <Animated.View
          style={[
            styles.image,
            {
              backgroundColor: skeletonColor,
              opacity: pulse,
              borderRadius: theme.radius.md,
              marginBottom: theme.spacing.lg,
            },
          ]}
        />
      )}

      {Array.from({ length: lines }).map((_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.line,
            {
              backgroundColor: skeletonColor,
              opacity: pulse,
              width: i === lines - 1 ? '60%' : '100%',
              height: 12,
              marginBottom: i < lines - 1 ? theme.spacing.sm : 0,
              borderRadius: theme.radius.sm,
            },
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {},
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarLines: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  line: {},
  image: {
    width: '100%',
    height: 160,
  },
})

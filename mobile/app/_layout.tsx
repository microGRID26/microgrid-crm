import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)
  const router = useRouter()
  const segments = useSegments()

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  })

  // Listen for auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setInitializing(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Hide splash when fonts loaded and auth checked
  useEffect(() => {
    if (fontsLoaded && !initializing) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, initializing])

  // Auth-based navigation guard
  useEffect(() => {
    if (initializing) return

    const inAuthGroup = segments[0] === '(auth)'
    const inTabsGroup = segments[0] === '(tabs)'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)')
    }
  }, [session, segments, initializing])

  if (!fontsLoaded || initializing) return null

  return (
    <>
      <StatusBar style="dark" backgroundColor="#FAFAF7" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FAFAF7' } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="ticket/[id]" options={{ presentation: 'modal', headerShown: true, headerTitle: 'Ticket Detail' }} />
      </Stack>
    </>
  )
}

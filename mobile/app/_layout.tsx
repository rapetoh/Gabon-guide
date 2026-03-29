import '../lib/i18n' // Initialize i18n before anything renders

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, useTheme } from '../contexts/ThemeContext'
import { PostHogProvider } from 'posthog-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Redirect, Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'

import { supabase } from '../lib/supabase'

export const ONBOARDING_KEY = 'onboarding_completed'

function ThemedStatusBar() {
  const { theme } = useTheme()
  return <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
}

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? ''
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Cache data for 5 minutes before refetching
      retry: 2,
    },
  },
})

export default function RootLayout() {
  const [ready, setReady] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)

  useEffect(() => {
    async function init() {
      // Check auth session and onboarding flag in parallel
      const [, completed] = await Promise.all([
        supabase.auth.getSession(),
        AsyncStorage.getItem(ONBOARDING_KEY),
      ])
      setOnboardingDone(completed === 'true')
      setReady(true)
    }
    init()

    // Listen for auth state changes (login, logout, token refresh)
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      // Invalidate all queries on auth change so data refreshes
      // with the new user's permissions (e.g., favorites, admin access)
      queryClient.invalidateQueries()
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (!ready || onboardingDone === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <PostHogProvider apiKey={POSTHOG_KEY} options={{ host: POSTHOG_HOST, customStorage: AsyncStorage }}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ThemedStatusBar />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="place/[id]" options={{ presentation: 'card' }} />
            <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
            <Stack.Screen name="admin" />
            <Stack.Screen name="restaurant-admin" />
          </Stack>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {!onboardingDone && <Redirect href={'/onboarding' as any} />}
        </QueryClientProvider>
      </ThemeProvider>
    </PostHogProvider>
  )
}

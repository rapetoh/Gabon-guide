import '../lib/i18n' // Initialize i18n before anything renders

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '../contexts/ThemeContext'
import { PostHogProvider } from 'posthog-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'

import { supabase } from '../lib/supabase'

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

  useEffect(() => {
    // Check if there is an existing session on app start
    supabase.auth.getSession().then(() => setReady(true))

    // Listen for auth state changes (login, logout, token refresh)
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      // Invalidate all queries on auth change so data refreshes
      // with the new user's permissions (e.g., favorites, admin access)
      queryClient.invalidateQueries()
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (!ready) {
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
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="place/[id]" options={{ presentation: 'card' }} />
            <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
            <Stack.Screen name="admin" />
          </Stack>
        </QueryClientProvider>
      </ThemeProvider>
    </PostHogProvider>
  )
}

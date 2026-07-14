import { Redirect, Stack } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'

import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useSession } from '../../hooks/useSession'

export default function RestaurantAdminLayout() {
  const { session, loading: sessionLoading } = useSession()
  const { role, isAdmin, loading: roleLoading } = useIsAdmin()

  if (sessionLoading || roleLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  // Owners get their dashboard; admins are also admitted (the RPC allows
  // them to apply redemption sessions for any place, e.g. via the scanner).
  const allowed = role === 'restaurant_owner' || role === 'admin' || isAdmin
  if (!session || !allowed) {
    return <Redirect href="/(tabs)" />
  }

  return (
    <Stack screenOptions={{ headerShown: false }} />
  )
}

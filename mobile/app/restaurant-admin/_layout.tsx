import { Redirect, Stack } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'

import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useSession } from '../../hooks/useSession'

export default function RestaurantAdminLayout() {
  const { session, loading: sessionLoading } = useSession()
  const { role, loading: roleLoading } = useIsAdmin()

  if (sessionLoading || roleLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (!session || role !== 'restaurant_owner') {
    return <Redirect href="/(tabs)" />
  }

  return (
    <Stack screenOptions={{ headerShown: false }} />
  )
}

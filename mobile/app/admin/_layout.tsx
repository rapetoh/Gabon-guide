import { Redirect, Stack } from 'expo-router'

import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useSession } from '../../hooks/useSession'

// This layout guards the entire /admin section.
// If the user is not logged in or not an admin, they are redirected to home.
export default function AdminLayout() {
  const { session, loading: sessionLoading } = useSession()
  const { isAdmin, loading: adminLoading } = useIsAdmin()

  // Wait until both session and admin status are known
  if (sessionLoading || adminLoading) return null

  if (!session || !isAdmin) {
    return <Redirect href="/(tabs)" />
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="place/new" />
      <Stack.Screen name="place/[id]" />
    </Stack>
  )
}

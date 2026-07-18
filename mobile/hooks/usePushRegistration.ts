import Constants from 'expo-constants'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { Platform } from 'react-native'

import i18n from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

// Registers this device for push and keeps the server-side copy of the
// user's language fresh. Mounted once in the root layout; re-runs on login.
//
// expo-notifications is loaded lazily: its native module only exists in
// binaries built after the plugin was added (build #10+), so a static import
// would crash older dev clients and the simulator. On those, push simply
// no-ops — the in-app inbox still works everywhere.
export function usePushRegistration() {
  const { session } = useSession()
  const userId = session?.user.id

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    let tapSub: { remove: () => void } | null = null

    async function register() {
      let Notifications: typeof import('expo-notifications')
      try {
        // Only binaries built with the expo-notifications plugin (build #10+)
        // have the native side; probing the registry avoids a module-scope
        // throw (and dev red-box) on older binaries.
        const { requireOptionalNativeModule } = await import('expo-modules-core')
        if (!requireOptionalNativeModule('ExpoPushTokenManager')) return

        Notifications = await import('expo-notifications')
        // Show pushes as banners even while the app is foregrounded.
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
          }),
        })
      } catch {
        return // binary without the native module
      }

      const { status: existing } = await Notifications.getPermissionsAsync()
      let status = existing
      if (existing !== 'granted') {
        const req = await Notifications.requestPermissionsAsync()
        status = req.status
      }
      if (status !== 'granted' || cancelled) return

      const projectId = Constants.expoConfig?.extra?.eas?.projectId
      if (!projectId) return
      // Throws on simulators (no APNs) — the outer catch makes that a no-op.
      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
      if (cancelled || !token) return

      await supabase.from('push_tokens').upsert(
        {
          user_id: userId!,
          token,
          platform: Platform.OS === 'android' ? 'android' : 'ios',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' },
      )

      // Tapping a push lands the user in the inbox.
      tapSub = Notifications.addNotificationResponseReceivedListener(() => {
        router.push('/notifications' as never)
      })
    }

    async function syncLanguage() {
      // Push text is rendered server-side (send_push Edge Function), so the
      // DB needs to know the user's language even though i18n lives on-device.
      const lang = i18n.language === 'en' ? 'en' : 'fr'
      await supabase.from('profiles').update({ preferred_language: lang }).eq('id', userId!)
    }

    register().catch(() => {})
    syncLanguage().catch(() => {})

    const onLanguageChanged = (lng: string) => {
      supabase
        .from('profiles')
        .update({ preferred_language: lng === 'en' ? 'en' : 'fr' })
        .eq('id', userId!)
        .then(() => {})
    }
    i18n.on('languageChanged', onLanguageChanged)

    return () => {
      cancelled = true
      i18n.off('languageChanged', onLanguageChanged)
      tapSub?.remove()
    }
  }, [userId])
}

import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { Platform } from 'react-native'

import i18n from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

// Show pushes as banners even while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

// Registers this device for push and keeps the server-side copy of the
// user's language fresh. Mounted once in the root layout; re-runs on login.
export function usePushRegistration() {
  const { session } = useSession()
  const userId = session?.user.id

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function register() {
      // Push only exists on real hardware — the simulator has no APNs.
      if (!Device.isDevice) return

      const { status: existing } = await Notifications.getPermissionsAsync()
      let status = existing
      if (existing !== 'granted') {
        const req = await Notifications.requestPermissionsAsync()
        status = req.status
      }
      if (status !== 'granted' || cancelled) return

      const projectId = Constants.expoConfig?.extra?.eas?.projectId
      if (!projectId) return
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

    // Tapping a push lands the user in the inbox.
    const tapSub = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/notifications' as never)
    })

    return () => {
      cancelled = true
      i18n.off('languageChanged', onLanguageChanged)
      tapSub.remove()
    }
  }, [userId])
}

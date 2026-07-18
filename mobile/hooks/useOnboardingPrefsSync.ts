import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect } from 'react'

import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

// Keys written by app/onboarding/{areas,preferences}.tsx
const PREF_VIBES_KEY = 'onboarding_preferred_vibes'
const PREF_ZONES_KEY = 'onboarding_preferred_zones'

// Onboarding runs BEFORE signup, so the preference screens can only stash
// choices in AsyncStorage — there is no session to write to yet (audit 6.3).
// This hook completes the loop: on the first login where the profile has no
// preferences, copy the stashed choices up, then clear the stash so a later
// in-app profile edit is never overwritten.
export function useOnboardingPrefsSync() {
  const { session } = useSession()
  const userId = session?.user.id

  useEffect(() => {
    if (!userId) return

    async function sync() {
      const [[, vibesRaw], [, zonesRaw]] = await AsyncStorage.multiGet([
        PREF_VIBES_KEY,
        PREF_ZONES_KEY,
      ])
      if (!vibesRaw && !zonesRaw) return

      const vibes = JSON.parse(vibesRaw ?? '[]') as string[]
      const zones = JSON.parse(zonesRaw ?? '[]') as string[]
      if (vibes.length === 0 && zones.length === 0) {
        await AsyncStorage.multiRemove([PREF_VIBES_KEY, PREF_ZONES_KEY])
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('preferred_vibes, preferred_zones')
        .eq('id', userId!)
        .maybeSingle()
      if (!profile) return

      if (profile.preferred_vibes.length === 0 && profile.preferred_zones.length === 0) {
        await supabase
          .from('profiles')
          .update({ preferred_vibes: vibes, preferred_zones: zones })
          .eq('id', userId!)
      }
      await AsyncStorage.multiRemove([PREF_VIBES_KEY, PREF_ZONES_KEY])
    }

    sync().catch(() => {})
  }, [userId])
}

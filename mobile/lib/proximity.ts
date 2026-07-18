// Proximity alerts ("alertes bons plans à proximité").
//
// The phone watches geofences around the ~18 nearest places that (a) have a
// live coupon and (b) whose tier includes the proximity_pings feature — the
// server decides the list via get_proximity_targets (migration 046). When
// the user physically enters a fence, iOS wakes this task and we fire a
// LOCAL notification: no server round-trip, works with the app killed.
//
// Anti-spam contract (founder agreement 2026-07-18):
//   - strict opt-in (profile toggle, requires "Always" location permission)
//   - only places with a live coupon are ever registered
//   - at most ONE ping per day globally, and per place once per 7 days
//
// Native modules (ExpoTaskManager, ExpoNotificationScheduler) only exist in
// binaries built after 2026-07-18 — everything is probed before use so older
// binaries no-op (same pattern as usePushRegistration).

import AsyncStorage from '@react-native-async-storage/async-storage'
import { requireOptionalNativeModule } from 'expo-modules-core'

import i18n from './i18n'
import { supabase } from './supabase'

export const PROXIMITY_ENABLED_KEY = 'okili.proximity.enabled'
const TARGETS_KEY = 'okili.proximity.targets'       // { [placeId]: {name, fr, en} }
const LAST_GLOBAL_PING_KEY = 'okili.proximity.lastPingDay'  // 'YYYY-MM-DD'
const LAST_PLACE_PING_KEY = 'okili.proximity.lastPlacePing' // { [placeId]: epochMs }

const GEOFENCE_TASK = 'okili-proximity-geofence'
const FENCE_RADIUS_M = 150
const PER_PLACE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

function nativeReady(): boolean {
  return !!requireOptionalNativeModule('ExpoTaskManager')
    && !!requireOptionalNativeModule('ExpoNotificationScheduler')
}

type TargetInfo = { name: string; fr: string | null; en: string | null }

async function firePing(placeId: string) {
  const [targetsRaw, lastDay, lastPlaceRaw] = await Promise.all([
    AsyncStorage.getItem(TARGETS_KEY),
    AsyncStorage.getItem(LAST_GLOBAL_PING_KEY),
    AsyncStorage.getItem(LAST_PLACE_PING_KEY),
  ])
  const targets: Record<string, TargetInfo> = JSON.parse(targetsRaw ?? '{}')
  const target = targets[placeId]
  if (!target) return

  const today = new Date().toISOString().slice(0, 10)
  if (lastDay === today) return // global cap: one ping per day

  const lastPlace: Record<string, number> = JSON.parse(lastPlaceRaw ?? '{}')
  if (lastPlace[placeId] && Date.now() - lastPlace[placeId] < PER_PLACE_COOLDOWN_MS) return

  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const coupon = lang === 'fr' ? (target.fr ?? target.en) : (target.en ?? target.fr)

  const Notifications = await import('expo-notifications')
  await Notifications.scheduleNotificationAsync({
    content: {
      title: lang === 'fr' ? `${target.name} est tout près 📍` : `${target.name} is right nearby 📍`,
      body: lang === 'fr'
        ? `Coupon en cours${coupon ? ` : « ${coupon} »` : ''} — passez en profiter !`
        : `Coupon running${coupon ? `: “${coupon}”` : ''} — stop by and enjoy it!`,
      data: { type: 'proximity', place_id: placeId },
      sound: 'default',
    },
    trigger: null, // now
  })

  lastPlace[placeId] = Date.now()
  await Promise.all([
    AsyncStorage.setItem(LAST_GLOBAL_PING_KEY, today),
    AsyncStorage.setItem(LAST_PLACE_PING_KEY, JSON.stringify(lastPlace)),
  ])
}

// The task MUST be defined at module load so iOS can wake a killed app into
// it. Guarded: on binaries without the native side this whole block is skipped.
if (nativeReady()) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const TaskManager = require('expo-task-manager') as typeof import('expo-task-manager')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Location = require('expo-location') as typeof import('expo-location')

  TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
    if (error || !data) return
    const { eventType, region } = data as {
      eventType: import('expo-location').GeofencingEventType
      region: import('expo-location').LocationRegion
    }
    if (eventType === Location.GeofencingEventType.Enter && region.identifier) {
      await firePing(region.identifier).catch(() => {})
    }
  })
}

export async function isProximityEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(PROXIMITY_ENABLED_KEY)) === 'true'
}

// Turn the feature on: ask for permissions, fetch targets, arm the fences.
// Returns false when permissions were denied (caller reverts the toggle).
export async function enableProximity(): Promise<boolean> {
  if (!nativeReady()) return false
  const Location = await import('expo-location')

  const fg = await Location.requestForegroundPermissionsAsync()
  if (fg.status !== 'granted') return false
  const bg = await Location.requestBackgroundPermissionsAsync()
  if (bg.status !== 'granted') return false

  await AsyncStorage.setItem(PROXIMITY_ENABLED_KEY, 'true')
  await refreshProximityTargets()
  return true
}

export async function disableProximity(): Promise<void> {
  await AsyncStorage.setItem(PROXIMITY_ENABLED_KEY, 'false')
  if (!nativeReady()) return
  const Location = await import('expo-location')
  const TaskManager = await import('expo-task-manager')
  if (await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK)) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK)
  }
  await AsyncStorage.removeItem(TARGETS_KEY)
}

// Re-aim the ~18 fences at the nearest coupon-running places. Called on
// enable and on every app foreground while the toggle is on, so the watched
// set follows the user around the city.
export async function refreshProximityTargets(): Promise<void> {
  if (!nativeReady() || !(await isProximityEnabled())) return
  const Location = await import('expo-location')

  const bg = await Location.getBackgroundPermissionsAsync()
  if (bg.status !== 'granted') return

  const pos = await Location.getLastKnownPositionAsync()
    ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
  if (!pos) return

  const { data, error } = await supabase.rpc('get_proximity_targets', {
    p_lat: pos.coords.latitude,
    p_lon: pos.coords.longitude,
  })
  if (error) return

  const targets: Record<string, TargetInfo> = {}
  const regions = (data ?? []).map(t => {
    targets[t.place_id] = { name: t.name, fr: t.coupon_title_fr, en: t.coupon_title_en }
    return {
      identifier: t.place_id,
      latitude: t.latitude,
      longitude: t.longitude,
      radius: FENCE_RADIUS_M,
      notifyOnEnter: true,
      notifyOnExit: false,
    }
  })

  await AsyncStorage.setItem(TARGETS_KEY, JSON.stringify(targets))
  const TaskManager = await import('expo-task-manager')
  if (regions.length === 0) {
    if (await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK)) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK)
    }
    return
  }
  await Location.startGeofencingAsync(GEOFENCE_TASK, regions)
}

import type { PlaceHours, DayHours } from '../lib/database.types'

// Libreville is always UTC+1 (WAT — West Africa Time)
// "Open now" must always reflect Libreville time, regardless of the user's device timezone.
const LIBREVILLE_UTC_OFFSET = 1

const DAY_KEYS: (keyof PlaceHours)[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/**
 * Returns current time in Libreville (UTC+1), regardless of device timezone.
 */
export function getLibrevilleNow(): Date {
  const now = new Date()
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000
  return new Date(utcMs + LIBREVILLE_UTC_OFFSET * 60 * 60 * 1000)
}

/**
 * Converts "HH:MM" time string to total minutes since midnight.
 */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Determines if a place is currently open, always using Libreville local time.
 *
 * @param hours - The place's hours object from the database
 * @param now   - Optional: override current time (used in tests). Defaults to Libreville now.
 * @returns true if the place is currently open, false otherwise
 */
export function isOpenNow(hours: PlaceHours | null, now?: Date): boolean {
  if (!hours) return false

  const libNow = now ?? getLibrevilleNow()
  const dayIndex = libNow.getDay() // 0 = Sunday
  const currentMinutes = libNow.getHours() * 60 + libNow.getMinutes()

  const todayKey = DAY_KEYS[dayIndex]
  // Guard against malformed hours objects missing a day key
  const today: DayHours | undefined = hours[todayKey]

  if (!today || today.closed) return false

  const openMinutes = toMinutes(today.open)
  const closeMinutes = toMinutes(today.close)

  if (today.overnight) {
    // Closes after midnight — two windows: from open until midnight, or from midnight until close
    // e.g. open 21:00 → close 02:00
    // Open if: currentTime >= 21:00  OR  currentTime < 02:00
    if (currentMinutes >= openMinutes) return true

    // Check if we're in the early morning window (after midnight, before close)
    // This uses yesterday's overnight flag
    const yesterdayIndex = (dayIndex + 6) % 7
    const yesterdayKey = DAY_KEYS[yesterdayIndex]
    const yesterday: DayHours | undefined = hours[yesterdayKey]

    if (yesterday && yesterday.overnight && !yesterday.closed) {
      const yesterdayCloseMinutes = toMinutes(yesterday.close)
      return currentMinutes < yesterdayCloseMinutes
    }

    return false
  }

  // Normal hours: open if between open and close times
  return currentMinutes >= openMinutes && currentMinutes < closeMinutes
}

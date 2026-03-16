/** @jest-environment node */
import { isOpenNow } from '../utils/isOpenNow'
import type { PlaceHours } from '../lib/database.types'

// Helper: create a Date set to a specific Libreville local time
// Since isOpenNow accepts an override `now` param, we pass Libreville time directly
function libTime(day: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat', hh: number, mm: number): Date {
  const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
  const d = new Date(2024, 0, 7 + dayMap[day]) // Jan 7 2024 = Sunday, so +dayMap gives correct weekday
  d.setHours(hh, mm, 0, 0)
  return d
}

const CLOSED_DAY = { open: '00:00', close: '00:00', closed: true, overnight: false }
const OPEN_NORMAL = { open: '08:00', close: '22:00', closed: false, overnight: false }
const OPEN_OVERNIGHT = { open: '21:00', close: '02:00', closed: false, overnight: true }

function makeHours(override: Partial<PlaceHours> = {}): PlaceHours {
  const defaults: PlaceHours = {
    mon: OPEN_NORMAL,
    tue: OPEN_NORMAL,
    wed: OPEN_NORMAL,
    thu: OPEN_NORMAL,
    fri: OPEN_NORMAL,
    sat: OPEN_NORMAL,
    sun: OPEN_NORMAL,
  }
  return { ...defaults, ...override }
}

describe('isOpenNow — normal hours (08:00–22:00)', () => {
  const hours = makeHours()

  test('returns true when tested at midday', () => {
    expect(isOpenNow(hours, libTime('mon', 12, 0))).toBe(true)
  })

  test('returns false when tested after closing time', () => {
    expect(isOpenNow(hours, libTime('mon', 23, 0))).toBe(false)
  })

  test('returns false when tested before opening time', () => {
    expect(isOpenNow(hours, libTime('mon', 7, 59))).toBe(false)
  })
})

describe('isOpenNow — closed day', () => {
  test('returns false when day is marked as closed', () => {
    const hours = makeHours({ mon: CLOSED_DAY })
    expect(isOpenNow(hours, libTime('mon', 12, 0))).toBe(false)
  })
})

describe('isOpenNow — overnight hours (bar open 21:00–02:00)', () => {
  const hours = makeHours({
    fri: OPEN_OVERNIGHT,
    sat: OPEN_OVERNIGHT,
  })

  test('returns true at 23:00 on Friday (within overnight window)', () => {
    expect(isOpenNow(hours, libTime('fri', 23, 0))).toBe(true)
  })

  test('returns true at 01:30 on Saturday (early morning, still open from Friday)', () => {
    expect(isOpenNow(hours, libTime('sat', 1, 30))).toBe(true)
  })

  test('returns false at 02:01 on Saturday (after Friday close)', () => {
    expect(isOpenNow(hours, libTime('sat', 2, 1))).toBe(false)
  })

  test('returns false at 15:00 on Friday (afternoon, before overnight opening)', () => {
    expect(isOpenNow(hours, libTime('fri', 15, 0))).toBe(false)
  })
})

describe('isOpenNow — null / missing hours', () => {
  test('returns false when hours is null', () => {
    expect(isOpenNow(null, libTime('mon', 12, 0))).toBe(false)
  })
})

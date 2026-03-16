/** @jest-environment node */
import { formatWhatsAppNumber, getWhatsAppUrl } from '../utils/formatWhatsApp'

describe('formatWhatsAppNumber', () => {
  test('converts local format with leading 0 to international', () => {
    expect(formatWhatsAppNumber('0712345678')).toBe('241712345678')
  })

  test('strips + from already-international format', () => {
    expect(formatWhatsAppNumber('+24107123456')).toBe('24107123456')
  })

  test('leaves already-correct format unchanged', () => {
    expect(formatWhatsAppNumber('24107123456')).toBe('24107123456')
  })

  test('removes spaces from number', () => {
    expect(formatWhatsAppNumber('07 12 34 56 78')).toBe('241712345678')
  })

  test('removes dashes from number', () => {
    expect(formatWhatsAppNumber('07-12-34-56-78')).toBe('241712345678')
  })

  test('returns null for empty string', () => {
    expect(formatWhatsAppNumber('')).toBeNull()
  })

  test('returns null for null input', () => {
    expect(formatWhatsAppNumber(null)).toBeNull()
  })

  test('returns null for invalid/non-numeric input', () => {
    expect(formatWhatsAppNumber('abc')).toBeNull()
  })
})

describe('getWhatsAppUrl', () => {
  test('returns correct wa.me URL for valid number', () => {
    expect(getWhatsAppUrl('0712345678')).toBe('https://wa.me/241712345678')
  })

  test('returns null for null input', () => {
    expect(getWhatsAppUrl(null)).toBeNull()
  })

  test('returns null for empty input', () => {
    expect(getWhatsAppUrl('')).toBeNull()
  })
})

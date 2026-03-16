/**
 * Formats a Gabonese phone number into the international format required by wa.me links.
 *
 * wa.me links require numbers without the + sign in international format.
 * Gabon country code: +241
 *
 * Examples:
 *   "07 12 34 56 78" → "24107123456 78" (spaces removed, 241 prefix added)
 *   "+24107123456"   → "24107123456"  (+ stripped)
 *   "24107123456"    → "24107123456"  (already correct)
 *   ""               → null           (empty = no WhatsApp button shown)
 *
 * @returns formatted number string for wa.me, or null if input is invalid
 */
export function formatWhatsAppNumber(input: string | null | undefined): string | null {
  if (!input) return null

  // Remove all non-digit characters (spaces, dashes, dots, +)
  const digits = input.replace(/\D/g, '')

  if (digits.length === 0) return null

  // Already in full international format (241XXXXXXXXX)
  if (digits.startsWith('241')) return digits

  // Local format starting with 0 (0XXXXXXXXX) → replace leading 0 with 241
  if (digits.startsWith('0')) return '241' + digits.slice(1)

  // 8-digit local number without leading 0 → prepend 241
  if (digits.length === 8) return '241' + digits

  // Unexpected format — return null to hide the button rather than show a broken link
  return null
}

/**
 * Returns the full wa.me URL for a given phone number.
 * Returns null if the number cannot be formatted.
 */
export function getWhatsAppUrl(number: string | null | undefined): string | null {
  const formatted = formatWhatsAppNumber(number)
  if (!formatted) return null
  return `https://wa.me/${formatted}`
}

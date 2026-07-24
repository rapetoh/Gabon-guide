import type { MyCouponEntry } from '../hooks/useCouponRedemption'
import TicketCouponCard, { formatDiscount } from './TicketCouponCard'

// Wallet ("Mes coupons") entry: maps a MyCouponEntry onto the shared
// ticket-style card (TicketCouponCard — the visual source of truth).
// Tapping anywhere opens the coupon QR.

// "X, Y, Z…" — at most 3 scope place names on a wallet card.
function scopeNamesLabel(names: string[]): string {
  return names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '')
}

export default function WalletCouponCard({ coupon, lang, onPress }: {
  coupon: MyCouponEntry
  lang: 'fr' | 'en'
  onPress: () => void
}) {
  const discount = formatDiscount(coupon.discountType, coupon.discountValue, lang)
  const title = lang === 'en' && coupon.titleEn ? coupon.titleEn : coupon.titleFr
  const placeLabel = coupon.isPlatform
    ? (lang === 'fr' ? "Promo O'Kili" : "O'Kili promo")
    : (coupon.placeName ?? '—')
  // Platform coupons: where the coupon is actually valid.
  const scopeLabel = coupon.isPlatform
    ? (coupon.scopePlaceNames.length > 0
        ? `${lang === 'fr' ? 'Valable chez : ' : 'Valid at: '}${scopeNamesLabel(coupon.scopePlaceNames)}`
        : (lang === 'fr' ? 'Valable dans tous les restaurants' : 'Valid at any restaurant'))
    : null

  return (
    <TicketCouponCard
      photoPath={coupon.photoPath}
      discount={discount}
      placeLabel={placeLabel}
      title={title}
      metaLines={scopeLabel ? [scopeLabel] : undefined}
      expiresAt={coupon.expiresAt}
      lang={lang}
      pillLabel={lang === 'fr' ? 'Utiliser' : 'Use'}
      onPress={onPress}
    />
  )
}

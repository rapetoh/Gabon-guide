import { Ionicons } from '@expo/vector-icons'
import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import QRCode from 'react-native-qrcode-svg'

import { supabase } from '../../lib/supabase'

// Inline cap on the place detail page. Anything beyond this is moved into the
// "Voir les N autres" sheet so the page doesn't become a coupon scroll-trap.
const MAX_INLINE_COUPONS = 2

import { useThemeColors } from '../../contexts/ThemeContext'
import { useSession } from '../../hooks/useSession'
import { useActiveCouponsForPlace, type Coupon } from '../../hooks/useCoupons'
import {
  encodeQrPayload,
  useCouponUsage,
  useLastUserRedemption,
  useStartRedemption,
  type CouponRedemption,
} from '../../hooks/useCouponRedemption'
import TicketCouponCard, { formatDiscount } from '../TicketCouponCard'

function formatDateTime(iso: string, lang: 'fr' | 'en') {
  return new Date(iso).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface CouponCardProps {
  coupon: Coupon
  lang: 'fr' | 'en'
  onUse: (coupon: Coupon) => void
  /** Restaurant name for the bold top line (platform coupons get "Promo O'Kili") */
  placeName?: string | null
  /** Primary place photo (storage path) for the ticket's photo panel */
  placePhotoPath?: string | null
}

// Maps a place-page Coupon (+ live usage state) onto the shared ticket card
// so a coupon looks identical at discovery and in the wallet.
function CouponCard({ coupon, lang, onUse, placeName, placePhotoPath }: CouponCardProps) {
  const title = lang === 'en' && coupon.title_en ? coupon.title_en : coupon.title_fr
  const desc = lang === 'en' && coupon.description_en ? coupon.description_en : coupon.description_fr
  const dLabel = formatDiscount(coupon.discount_type, coupon.discount_value, lang)
  const isPlatform = coupon.place_id === null

  const { data: usage } = useCouponUsage(coupon.id)
  const { data: lastRedemption } = useLastUserRedemption(coupon.id)

  const soldOut = usage?.isSoldOut ?? false
  const limitReached = usage?.userLimitReached ?? false
  const userRedeemed = usage?.userRedeemed ?? 0
  const maxPerUser = coupon.max_redemptions_per_user
  const buttonDisabled = soldOut || limitReached

  // Usage counters, preserved from the pre-ticket card.
  const metaLines: string[] = []
  if (userRedeemed > 0 || maxPerUser > 1) {
    if (maxPerUser > 1) {
      metaLines.push(lang === 'fr'
        ? `Utilisé ${userRedeemed} / ${maxPerUser}`
        : `Used ${userRedeemed} / ${maxPerUser}`)
    }
    if (lastRedemption?.redeemed_at) {
      metaLines.push(
        (lang === 'fr' ? 'Dernière fois : ' : 'Last used: ') + formatDateTime(lastRedemption.redeemed_at, lang),
      )
    }
  }

  const pillLabel = soldOut
    ? (lang === 'fr' ? 'Épuisé' : 'Sold out')
    : limitReached
      ? (lang === 'fr' ? 'Limite atteinte' : 'Limit reached')
      : userRedeemed > 0
        ? (lang === 'fr' ? 'Réutiliser' : 'Use again')
        : (lang === 'fr' ? 'Utiliser' : 'Use')

  // Sold out and limit-reached share the grey pill — the icon (X vs
  // checkmark) keeps the two semantically distinct without using green,
  // which reads as "go".
  const pillIcon = soldOut ? 'close-circle' as const
    : limitReached ? 'checkmark-circle' as const
    : 'qr-code-outline' as const

  return (
    <TicketCouponCard
      /* Platform coupons get the branded gradient panel, place coupons the
         restaurant photo (gradient fallback when the place has none). */
      photoPath={isPlatform ? null : (placePhotoPath ?? null)}
      discount={dLabel}
      placeLabel={isPlatform
        ? (lang === 'fr' ? "Promo O'Kili" : "O'Kili promo")
        : (placeName ?? (lang === 'fr' ? 'Coupon' : 'Coupon'))}
      title={title}
      description={desc}
      metaLines={metaLines.length > 0 ? metaLines : undefined}
      expiresAt={coupon.expires_at}
      lang={lang}
      pillLabel={pillLabel}
      pillIcon={pillIcon}
      disabled={buttonDisabled}
      onPress={() => onUse(coupon)}
    />
  )
}

// The minimal coupon shape the QR modal needs. Exported so other surfaces
// (the profile wallet) can reuse the modal without holding a full Coupon row.
export interface QrModalCoupon {
  id: string
  title_fr: string
  title_en: string | null
  discount_type: 'percentage' | 'amount' | null
  discount_value: number | null
}

interface QrModalProps {
  visible: boolean
  coupon: QrModalCoupon | null
  onClose: () => void
}

export function CouponQrModal({ visible, coupon, onClose }: QrModalProps) {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const colors = useThemeColors()
  const startRedemption = useStartRedemption()
  const qc = useQueryClient()
  const { session } = useSession()
  const dLabel = coupon ? formatDiscount(coupon.discount_type, coupon.discount_value, lang) : null

  const [redemption, setRedemption] = useState<CouponRedemption | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [applied, setApplied] = useState<{ discount: number | null; billAmount: number | null } | null>(null)

  // Always run startRedemption fresh when the modal opens.
  //
  // We can't rely on a cached React Query (useUserRedemption) for the QR
  // payload — the owner redeems on a different device, and React Query's
  // cache doesn't invalidate cross-device. The mutation itself does a
  // server-side check for an existing unredeemed row and returns it, or
  // creates a fresh one if quotas allow. Source of truth = the server.
  const startMutateAsync = startRedemption.mutateAsync
  useEffect(() => {
    if (!visible || !coupon) return
    setRedemption(null)
    setStartError(null)
    setApplied(null)
    let cancelled = false
    startMutateAsync(coupon.id)
      .then(r => { if (!cancelled) setRedemption(r) })
      .catch(e => { if (!cancelled) setStartError(e?.message ?? 'UNKNOWN') })
    return () => { cancelled = true }
  }, [visible, coupon?.id, startMutateAsync])

  // Realtime: when the owner applies this redemption on their device, the
  // row's redeemed_at flips from null to a timestamp. We watch for that and
  // swap the QR into a success state so the customer sees instant feedback.
  useEffect(() => {
    if (!visible || !redemption?.id || applied) return
    const channel = supabase
      .channel(`redemption:${redemption.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'coupon_redemptions', filter: `id=eq.${redemption.id}` },
        payload => {
          const row = payload.new as { redeemed_at: string | null; discount_applied: number | null; bill_amount: number | null }
          if (row.redeemed_at) {
            setApplied({ discount: row.discount_applied, billAmount: row.bill_amount })
            qc.invalidateQueries({ queryKey: ['my-coupons', session?.user.id] })
            qc.invalidateQueries({ queryKey: ['coupon-usage', coupon?.id, session?.user.id] })
            qc.invalidateQueries({ queryKey: ['redemption-last', coupon?.id, session?.user.id] })
            qc.invalidateQueries({ queryKey: ['user-activity', session?.user.id] })
            qc.invalidateQueries({ queryKey: ['credit-balance', session?.user.id] })
          }
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [visible, redemption?.id, applied, qc, coupon?.id, session?.user.id])

  function handleClose() {
    setRedemption(null)
    setStartError(null)
    setApplied(null)
    onClose()
  }

  const payload = redemption
    ? encodeQrPayload({ couponId: redemption.coupon_id, code: redemption.redemption_code })
    : null

  const errorTitle = (key: string) => {
    switch (key) {
      case 'COUPON_SOLD_OUT':
        return lang === 'fr' ? 'Coupon épuisé' : 'Coupon sold out'
      case 'PER_USER_LIMIT_REACHED':
        return lang === 'fr' ? 'Limite atteinte' : 'Limit reached'
      case 'COUPON_INACTIVE_OR_EXPIRED':
        return lang === 'fr' ? 'Coupon non disponible' : 'Coupon not available'
      default:
        return lang === 'fr' ? 'Impossible de générer le QR' : 'Could not generate QR'
    }
  }
  const errorSubtitle = (key: string) => {
    switch (key) {
      case 'COUPON_SOLD_OUT':
        return lang === 'fr' ? 'Le quota total a été atteint.' : 'The total quota has been reached.'
      case 'PER_USER_LIMIT_REACHED':
        return lang === 'fr' ? 'Vous avez déjà utilisé ce coupon le maximum de fois autorisé.' : 'You have already used this coupon the maximum number of times allowed.'
      case 'COUPON_INACTIVE_OR_EXPIRED':
        return lang === 'fr' ? 'Ce coupon n\'est plus actif.' : 'This coupon is no longer active.'
      default:
        return ''
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.modalBackdrop} onPress={handleClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: colors.bgPrimary }]}
          onPress={() => {/* swallow */}}
        >
          <Pressable onPress={handleClose} style={styles.modalCloseBtn} hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.modalHeader}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="ticket" size={20} color="#E8571A" />
            </View>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]} numberOfLines={2}>
              {coupon ? (lang === 'en' && coupon.title_en ? coupon.title_en : coupon.title_fr) : ''}
            </Text>
            {dLabel && (
              <View style={styles.discountPill}>
                <Text style={styles.discountPillText}>{dLabel}</Text>
              </View>
            )}
          </View>

          <View style={styles.qrWrap}>
            {applied ? (
              <View style={styles.qrPlaceholder}>
                <Ionicons name="checkmark-circle" size={64} color="#34C759" />
                <Text style={[styles.modalSubtitle, { color: colors.textPrimary, textAlign: 'center' }]}>
                  {lang === 'fr' ? 'Coupon utilisé !' : 'Coupon used!'}
                </Text>
                {applied.discount != null && applied.discount > 0 ? (
                  <Text style={[styles.modalMeta, { color: colors.textSecondary, textAlign: 'center', maxWidth: 240 }]}>
                    {lang === 'fr'
                      ? `Remise de ${applied.discount.toLocaleString('fr-FR')} FCFA appliquée à votre addition.`
                      : `${applied.discount.toLocaleString('en-US')} FCFA discount applied to your bill.`}
                  </Text>
                ) : (
                  <Text style={[styles.modalMeta, { color: colors.textSecondary, textAlign: 'center', maxWidth: 240 }]}>
                    {lang === 'fr' ? 'Validé par le restaurant.' : 'Confirmed by the restaurant.'}
                  </Text>
                )}
              </View>
            ) : startError ? (
              <View style={styles.qrPlaceholder}>
                <Ionicons name="alert-circle" size={48} color="#FF3B30" />
                <Text style={[styles.modalSubtitle, { color: colors.textPrimary }]}>
                  {errorTitle(startError)}
                </Text>
                {!!errorSubtitle(startError) && (
                  <Text style={[styles.modalMeta, { color: colors.textSecondary, textAlign: 'center', maxWidth: 240 }]}>
                    {errorSubtitle(startError)}
                  </Text>
                )}
              </View>
            ) : !payload ? (
              <View style={styles.qrPlaceholder}>
                <ActivityIndicator color="#E8571A" />
                <Text style={[styles.modalMeta, { color: colors.textSecondary }]}>
                  {lang === 'fr' ? 'Génération du coupon…' : 'Generating coupon…'}
                </Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center', gap: 10 }}>
                <View style={styles.qrBg}>
                  <QRCode value={payload} size={220} backgroundColor="#fff" color="#000" />
                </View>
                {/* Human-readable fallback for when the scanner can't read the QR */}
                <Text style={[styles.qrCodeText, { color: colors.textPrimary }]}>
                  {redemption?.redemption_code}
                </Text>
              </View>
            )}
          </View>

          {applied ? (
            <Pressable onPress={handleClose} style={styles.modalDoneBtn}>
              <Text style={styles.modalDoneBtnText}>
                {lang === 'fr' ? 'Terminé' : 'Done'}
              </Text>
            </Pressable>
          ) : !startError && payload ? (
            <Text style={[styles.modalInstruction, { color: colors.textSecondary }]}>
              {lang === 'fr'
                ? 'Présentez ce QR au restaurant pour utiliser le coupon.'
                : 'Show this QR at the restaurant to redeem.'}
            </Text>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

interface AllCouponsSheetProps {
  visible: boolean
  coupons: Coupon[]
  lang: 'fr' | 'en'
  onClose: () => void
  onUse: (coupon: Coupon) => void
  placeName?: string | null
  placePhotoPath?: string | null
}

function AllCouponsSheet({ visible, coupons, lang, onClose, onUse, placeName, placePhotoPath }: AllCouponsSheetProps) {
  const colors = useThemeColors()
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['top']}>
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
            {lang === 'fr' ? `Coupons disponibles · ${coupons.length}` : `Available coupons · ${coupons.length}`}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.sheetCloseBtn}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.sheetScroll}
          showsVerticalScrollIndicator={false}
        >
          {coupons.map(c => (
            <CouponCard
              key={c.id}
              coupon={c}
              lang={lang}
              placeName={placeName}
              placePhotoPath={placePhotoPath}
              onUse={(coupon) => {
                onClose()
                onUse(coupon)
              }}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

export default function CouponsBlock({ placeId, placeName, placePhotoPath }: {
  placeId: string
  /** Restaurant name — shown bold on each ticket card's top line */
  placeName?: string | null
  /** Primary place photo storage path — the ticket's left panel */
  placePhotoPath?: string | null
}) {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const { session } = useSession()
  const { data: coupons, isLoading } = useActiveCouponsForPlace(placeId)
  const [activeCoupon, setActiveCoupon] = useState<Coupon | null>(null)
  const [seeAllOpen, setSeeAllOpen] = useState(false)

  if (isLoading || !coupons || coupons.length === 0) return null

  const inlineCoupons = coupons.slice(0, MAX_INLINE_COUPONS)
  const hiddenCount = Math.max(0, coupons.length - MAX_INLINE_COUPONS)

  function handleUse(coupon: Coupon) {
    if (!session) {
      router.push({ pathname: '/auth/login', params: { redirect: `/place/${placeId}` } })
      return
    }
    setActiveCoupon(coupon)
  }

  return (
    <>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {lang === 'fr' ? 'Coupons disponibles' : 'Available coupons'}
          </Text>
          {coupons.length > 1 && (
            <View style={styles.sectionCountPill}>
              <Text style={styles.sectionCountText}>{coupons.length}</Text>
            </View>
          )}
        </View>
        <View style={{ gap: 10 }}>
          {inlineCoupons.map(c => (
            <CouponCard
              key={c.id}
              coupon={c}
              lang={lang}
              placeName={placeName}
              placePhotoPath={placePhotoPath}
              onUse={handleUse}
            />
          ))}
          {hiddenCount > 0 && (
            <Pressable onPress={() => setSeeAllOpen(true)} style={styles.seeAllBtn}>
              <Ionicons name="layers-outline" size={16} color="#E8571A" />
              <Text style={styles.seeAllText}>
                {lang === 'fr'
                  ? `Voir les ${hiddenCount} autre${hiddenCount > 1 ? 's' : ''} coupon${hiddenCount > 1 ? 's' : ''}`
                  : `See ${hiddenCount} more coupon${hiddenCount > 1 ? 's' : ''}`}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#E8571A" />
            </Pressable>
          )}
        </View>
      </View>

      <AllCouponsSheet
        visible={seeAllOpen}
        coupons={coupons}
        lang={lang}
        placeName={placeName}
        placePhotoPath={placePhotoPath}
        onClose={() => setSeeAllOpen(false)}
        onUse={handleUse}
      />

      <CouponQrModal
        visible={activeCoupon !== null}
        coupon={activeCoupon}
        onClose={() => setActiveCoupon(null)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  section: { gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  sectionCountPill: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232,87,26,0.12)',
  },
  sectionCountText: { color: '#E8571A', fontSize: 11, fontWeight: '700' },

  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(232,87,26,0.35)',
    borderStyle: 'dashed',
  },
  seeAllText: { color: '#E8571A', fontSize: 13, fontWeight: '700' },

  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  sheetCloseBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  sheetScroll: { paddingHorizontal: 18, paddingBottom: 32, gap: 10 },

  // Used by the QR modal header (the cards themselves are TicketCouponCard).
  discountPill: {
    backgroundColor: 'rgba(232,87,26,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  discountPillText: { color: '#E8571A', fontSize: 11, fontWeight: '700' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 16,
    position: 'relative',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  modalHeader: { alignItems: 'center', gap: 10, paddingTop: 6 },
  modalIconWrap: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(232,87,26,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', maxWidth: 280 },
  modalSubtitle: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  modalMeta: { fontSize: 12 },
  modalInstruction: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 18,
  },

  qrWrap: { padding: 4 },
  qrBg: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 16,
  },
  qrCodeText: { fontSize: 16, fontWeight: '800', letterSpacing: 3 },
  qrPlaceholder: {
    width: 220, height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 16,
    padding: 16,
  },

  modalDoneBtn: {
    backgroundColor: '#34C759',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
  },
  modalDoneBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})

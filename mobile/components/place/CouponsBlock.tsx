import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import QRCode from 'react-native-qrcode-svg'

import { useThemeColors } from '../../contexts/ThemeContext'
import { useSession } from '../../hooks/useSession'
import { useActiveCouponsForPlace, type Coupon } from '../../hooks/useCoupons'
import { encodeQrPayload, useStartRedemption, useUserRedemption } from '../../hooks/useCouponRedemption'

function formatExpiry(iso: string, lang: 'fr' | 'en') {
  return new Date(iso).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'short',
  })
}

interface CouponCardProps {
  coupon: Coupon
  lang: 'fr' | 'en'
  onUse: (coupon: Coupon) => void
}

function CouponCard({ coupon, lang, onUse }: CouponCardProps) {
  const colors = useThemeColors()
  const title = lang === 'en' && coupon.title_en ? coupon.title_en : coupon.title_fr
  const desc = lang === 'en' && coupon.description_en ? coupon.description_en : coupon.description_fr

  const { data: redemption } = useUserRedemption(coupon.id)
  const isRedeemed = !!redemption?.redeemed_at

  return (
    <View style={[styles.couponCard, { backgroundColor: colors.surfaceElevated }]}>
      <View style={styles.couponLeftBorder} />
      <View style={styles.couponBody}>
        <View style={styles.couponHeader}>
          <Ionicons name="ticket" size={16} color="#E8571A" />
          <Text style={styles.couponEyebrow}>
            {lang === 'fr' ? 'Coupon' : 'Coupon'}
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={[styles.couponExpiry, { color: colors.textSecondary }]}>
            {lang === 'fr' ? 'Expire le ' : 'Until '}{formatExpiry(coupon.expires_at, lang)}
          </Text>
        </View>
        <Text style={[styles.couponTitle, { color: colors.textPrimary }]} numberOfLines={2}>
          {title}
        </Text>
        {desc && (
          <Text style={[styles.couponDesc, { color: colors.textSecondary }]} numberOfLines={3}>
            {desc}
          </Text>
        )}
        <Pressable
          onPress={() => onUse(coupon)}
          style={[styles.useBtn, isRedeemed && styles.useBtnDone]}
        >
          {isRedeemed ? (
            <>
              <Ionicons name="checkmark-circle" size={14} color="#fff" />
              <Text style={styles.useBtnText}>
                {lang === 'fr' ? 'Déjà utilisé' : 'Already used'}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="qr-code-outline" size={14} color="#fff" />
              <Text style={styles.useBtnText}>
                {lang === 'fr' ? 'Utiliser ce coupon' : 'Use this coupon'}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  )
}

interface QrModalProps {
  visible: boolean
  coupon: Coupon | null
  onClose: () => void
}

function QrModal({ visible, coupon, onClose }: QrModalProps) {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const colors = useThemeColors()
  const startRedemption = useStartRedemption()
  const { data: existing } = useUserRedemption(coupon?.id)

  // The QR string is the encoded payload (couponId + redemption code).
  // Generated either from an existing redemption or via startRedemption mutation.
  const [generated, setGenerated] = useState<{ couponId: string; code: string } | null>(null)

  // Trigger generation as soon as the modal opens with a coupon
  const wantStart = visible && coupon !== null && !existing && !generated && !startRedemption.isPending
  if (wantStart) {
    startRedemption
      .mutateAsync(coupon!.id)
      .then(r => setGenerated({ couponId: r.coupon_id, code: r.redemption_code }))
      .catch(() => {/* shown via state below */})
  }

  // When modal closes, clear the local state so reopening re-fetches
  function handleClose() {
    setGenerated(null)
    onClose()
  }

  const payload = existing
    ? encodeQrPayload({ couponId: existing.coupon_id, code: existing.redemption_code })
    : generated
      ? encodeQrPayload(generated)
      : null

  const isRedeemed = !!existing?.redeemed_at

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.modalBackdrop} onPress={handleClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: colors.bgPrimary }]}
          onPress={() => {/* swallow tap */}}
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
          </View>

          <View style={styles.qrWrap}>
            {isRedeemed ? (
              <View style={styles.qrPlaceholder}>
                <Ionicons name="checkmark-circle" size={48} color="#34C759" />
                <Text style={[styles.modalSubtitle, { color: colors.textPrimary }]}>
                  {lang === 'fr' ? 'Coupon déjà utilisé' : 'Coupon already redeemed'}
                </Text>
                {existing?.redeemed_at && (
                  <Text style={[styles.modalMeta, { color: colors.textSecondary }]}>
                    {new Date(existing.redeemed_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
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
              <View style={styles.qrBg}>
                <QRCode value={payload} size={220} backgroundColor="#fff" color="#000" />
              </View>
            )}
          </View>

          {!isRedeemed && payload && (
            <Text style={[styles.modalInstruction, { color: colors.textSecondary }]}>
              {lang === 'fr'
                ? 'Présentez ce QR au restaurant pour utiliser le coupon.'
                : 'Show this QR at the restaurant to redeem.'}
            </Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

export default function CouponsBlock({ placeId }: { placeId: string }) {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const { session } = useSession()
  const { data: coupons, isLoading } = useActiveCouponsForPlace(placeId)
  const [activeCoupon, setActiveCoupon] = useState<Coupon | null>(null)

  if (isLoading || !coupons || coupons.length === 0) return null

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
        <Text style={styles.sectionTitle}>
          {lang === 'fr' ? 'Coupons disponibles' : 'Available coupons'}
        </Text>
        <View style={{ gap: 10 }}>
          {coupons.map(c => (
            <CouponCard key={c.id} coupon={c} lang={lang} onUse={handleUse} />
          ))}
        </View>
      </View>

      <QrModal
        visible={activeCoupon !== null}
        coupon={activeCoupon}
        onClose={() => setActiveCoupon(null)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  section: { gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },

  couponCard: {
    flexDirection: 'row',
    borderRadius: 14,
    overflow: 'hidden',
  },
  couponLeftBorder: { width: 4, backgroundColor: '#E8571A' },
  couponBody: { flex: 1, padding: 14, gap: 6 },
  couponHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  couponEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E8571A',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  couponExpiry: { fontSize: 11 },
  couponTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  couponDesc: { fontSize: 13, lineHeight: 18 },

  useBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8571A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 6,
  },
  useBtnDone: { backgroundColor: '#8E8E93' },
  useBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

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
  qrPlaceholder: {
    width: 220, height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 16,
  },
})

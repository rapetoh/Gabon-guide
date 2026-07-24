import { useMemo } from 'react'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useThemeColors } from '../contexts/ThemeContext'
import { ThemeColors } from '../constants/themes'
import { supabase } from '../lib/supabase'
import type { MyCouponEntry } from '../hooks/useCouponRedemption'

// Ticket-style wallet coupon card (design mock "Mes coupons"):
// place photo on the left, notched seam, discount + place + expiry on the
// right, dark "Utiliser" pill. Tapping anywhere opens the coupon QR.

const ACCENT = '#E8571A'
const PHOTO_WIDTH = 96
const NOTCH_RADIUS = 7

function photoUrl(path: string) {
  return supabase.storage.from('place-photos').getPublicUrl(path).data.publicUrl
}

// Hand-rolled month abbreviations — Hermes' Intl coverage varies by
// platform and the design specifies the exact French forms ("juil.").
const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatExpiry(iso: string, lang: 'fr' | 'en'): string {
  const d = new Date(iso)
  return lang === 'fr'
    ? `Expire le ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`
    : `Expires ${MONTHS_EN[d.getMonth()]} ${d.getDate()}`
}

function discountLabel(c: MyCouponEntry, lang: 'fr' | 'en'): string | null {
  if (c.discountType === null || c.discountValue === null) return null
  if (c.discountType === 'percentage') return `-${c.discountValue}%`
  return `-${c.discountValue.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA`
}

// "X, Y, Z…" — at most 3 scope place names on a wallet card.
function scopeNamesLabel(names: string[]): string {
  return names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '')
}

export default function WalletCouponCard({ coupon, lang, onPress }: {
  coupon: MyCouponEntry
  lang: 'fr' | 'en'
  onPress: () => void
}) {
  const colors = useThemeColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const discount = discountLabel(coupon, lang)
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
    /* Shadow lives on an un-clipped wrapper (overflow:hidden on the card
       kills iOS shadows — same trick as the credit bank card). */
    <View style={styles.shadow}>
      <Pressable style={styles.card} onPress={onPress}>
        {coupon.photoPath ? (
          <Image
            source={{ uri: photoUrl(coupon.photoPath) }}
            style={styles.photo}
            contentFit="cover"
          />
        ) : (
          /* Platform coupons have no place photo — brand panel instead. */
          <LinearGradient
            colors={['#F0692B', ACCENT, '#C9440F']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.photo, styles.brandPanel]}
          >
            <Text style={styles.brandText}>O'Kili</Text>
          </LinearGradient>
        )}

        {/* Ticket notches: two page-colored circles straddling the seam. */}
        <View style={[styles.notch, styles.notchTop]} />
        <View style={[styles.notch, styles.notchBottom]} />

        <View style={styles.content}>
          <Text numberOfLines={1} style={styles.topLine}>
            {discount ? (
              <>
                <Text style={styles.discount}>{discount}</Text>
                <Text style={styles.placeName}>{'  '}{placeLabel}</Text>
              </>
            ) : (
              /* No discount number to headline — the title takes its place. */
              <Text style={styles.placeName}>{title}</Text>
            )}
          </Text>
          <Text numberOfLines={1} style={styles.subLine}>
            {discount ? title : placeLabel}
          </Text>
          {scopeLabel && (
            <Text numberOfLines={1} style={styles.subLine}>{scopeLabel}</Text>
          )}
          <View style={styles.footer}>
            <Text style={styles.expiry}>{formatExpiry(coupon.expiresAt, lang)}</Text>
            <Pressable style={styles.useBtn} onPress={onPress} hitSlop={6}>
              <Text style={styles.useBtnText}>{lang === 'fr' ? 'Utiliser' : 'Use'}</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </View>
  )
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    shadow: {
      borderRadius: 18,
      backgroundColor: c.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 3,
    },
    card: {
      flexDirection: 'row',
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      minHeight: 96,
    },
    photo: {
      width: PHOTO_WIDTH,
      alignSelf: 'stretch',
    },
    brandPanel: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    notch: {
      position: 'absolute',
      left: PHOTO_WIDTH - NOTCH_RADIUS,
      width: NOTCH_RADIUS * 2,
      height: NOTCH_RADIUS * 2,
      borderRadius: NOTCH_RADIUS,
      backgroundColor: c.bgPrimary,
      zIndex: 2,
    },
    notchTop: { top: -NOTCH_RADIUS },
    notchBottom: { bottom: -NOTCH_RADIUS },
    content: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 3,
      justifyContent: 'center',
    },
    topLine: {
      // Container for the discount + place spans; baseline-aligns them.
      fontSize: 15,
    },
    discount: {
      fontSize: 21,
      fontWeight: '800',
      color: ACCENT,
      letterSpacing: -0.3,
    },
    placeName: {
      fontSize: 15,
      fontWeight: '700',
      color: c.textPrimary,
    },
    subLine: {
      fontSize: 12,
      color: c.textSecondary,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    expiry: {
      fontSize: 11,
      color: c.textSecondary,
    },
    useBtn: {
      backgroundColor: c.surfaceInverted,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 999,
    },
    useBtnText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
  })
}

import { useMemo } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useThemeColors } from '../contexts/ThemeContext'
import { ThemeColors } from '../constants/themes'
import { supabase } from '../lib/supabase'

// Ticket-style coupon card (design mock "Mes coupons") — the ONE source of
// truth for how a coupon looks, at discovery (place page) and in the wallet:
// photo on the left, notched seam, discount + place + expiry on the right,
// dark action pill. Consumers (WalletCouponCard, CouponsBlock) only map
// their data shapes onto these presentational props.

export const COUPON_ACCENT = '#E8571A'
const PHOTO_WIDTH = 96
const NOTCH_RADIUS = 7

export function placePhotoUrl(path: string) {
  return supabase.storage.from('place-photos').getPublicUrl(path).data.publicUrl
}

// Hand-rolled month abbreviations — Hermes' Intl coverage varies by
// platform and the design specifies the exact French forms ("juil.").
const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatExpiry(iso: string, lang: 'fr' | 'en'): string {
  const d = new Date(iso)
  return lang === 'fr'
    ? `Expire le ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`
    : `Expires ${MONTHS_EN[d.getMonth()]} ${d.getDate()}`
}

export function formatDiscount(
  type: 'percentage' | 'amount' | null,
  value: number | null,
  lang: 'fr' | 'en',
): string | null {
  if (type === null || value === null) return null
  if (type === 'percentage') return `-${value}%`
  return `-${value.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA`
}

export interface TicketCouponCardProps {
  /** place-photos storage path; null → branded O'Kili gradient panel */
  photoPath: string | null
  /** Pre-formatted discount ("-20%", "-1 000 FCFA"); null → title headlines */
  discount: string | null
  /** Bold name on the top line ("Chez Tantine", "Promo O'Kili") */
  placeLabel: string
  /** Coupon title — grey sub line (or headline when no discount) */
  title: string
  /** Optional longer description, max 2 lines */
  description?: string | null
  /** Small grey one-liners (scope, usage counters…) */
  metaLines?: string[]
  /** ISO expiry — rendered via formatExpiry */
  expiresAt: string
  lang: 'fr' | 'en'
  /** Action pill label — CTA wording is the consumer's business */
  pillLabel: string
  /** Optional pill icon (e.g. qr-code-outline, close-circle) */
  pillIcon?: keyof typeof Ionicons.glyphMap
  /** Sold-out / limit-reached: dims the card, greys the pill, kills taps */
  disabled?: boolean
  onPress: () => void
}

export default function TicketCouponCard({
  photoPath, discount, placeLabel, title, description, metaLines,
  expiresAt, lang, pillLabel, pillIcon, disabled = false, onPress,
}: TicketCouponCardProps) {
  const colors = useThemeColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  return (
    /* Shadow lives on an un-clipped wrapper (overflow:hidden on the card
       kills iOS shadows — same trick as the credit bank card). */
    <View style={styles.shadow}>
      <Pressable
        style={[styles.card, disabled && styles.cardDisabled]}
        onPress={onPress}
        disabled={disabled}
      >
        {photoPath ? (
          <Image
            source={{ uri: placePhotoUrl(photoPath) }}
            style={styles.photo}
            contentFit="cover"
          />
        ) : (
          /* No place photo (platform coupons) — brand panel instead. */
          <LinearGradient
            colors={['#F0692B', COUPON_ACCENT, '#C9440F']}
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
          {!!description && (
            <Text numberOfLines={2} style={styles.subLine}>{description}</Text>
          )}
          {metaLines?.map((line, i) => (
            <Text key={i} numberOfLines={1} style={styles.subLine}>{line}</Text>
          ))}
          <View style={styles.footer}>
            <Text style={styles.expiry}>{formatExpiry(expiresAt, lang)}</Text>
            {disabled ? (
              <View style={[styles.pill, styles.pillDisabled]}>
                {pillIcon && <Ionicons name={pillIcon} size={13} color="#fff" />}
                <Text style={styles.pillText}>{pillLabel}</Text>
              </View>
            ) : (
              <Pressable style={styles.pill} onPress={onPress} hitSlop={6}>
                {pillIcon && <Ionicons name={pillIcon} size={13} color="#fff" />}
                <Text style={styles.pillText}>{pillLabel}</Text>
              </Pressable>
            )}
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
    cardDisabled: {
      opacity: 0.55,
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
      color: COUPON_ACCENT,
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
      // The pill must never be pushed off the card by a long date/label.
      flexShrink: 1,
      marginRight: 8,
    },
    pill: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: c.surfaceInverted,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 999,
    },
    pillDisabled: {
      backgroundColor: '#8E8E93',
    },
    pillText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
  })
}

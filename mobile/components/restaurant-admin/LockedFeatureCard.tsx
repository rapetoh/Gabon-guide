import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'

import { useThemeColors } from '../../contexts/ThemeContext'
import type { SubscriptionTier } from '../../lib/database.types'

interface Props {
  /** Display name for the locked feature, in the user's language. */
  title: string
  /** Lowest tier where the feature unlocks. */
  unlocksAt: SubscriptionTier
  /** Optional one-line description. */
  description?: string
  /** Optional Ionicon name shown next to the title. */
  icon?: keyof typeof Ionicons.glyphMap
}

const TIER_LABEL: Record<SubscriptionTier, { fr: string; en: string }> = {
  free:     { fr: 'Gratuit',  en: 'Free' },
  standard: { fr: 'Standard', en: 'Standard' },
  premium:  { fr: 'Premium',  en: 'Premium' },
}

// Support WhatsApp number for upgrade requests. Only digits end up in the
// wa.me URL; the CTA renders only when the env var is set.
export function supportWhatsAppUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP
  if (!raw) return null
  const digits = String(raw).replace(/[^0-9]/g, '')
  if (!digits) return null
  return `https://wa.me/${digits}`
}

export function LockedFeatureCard({ title, unlocksAt, description, icon = 'lock-closed' }: Props) {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const c = useThemeColors()

  const upsell = lang === 'fr'
    ? `Disponible avec le Pack ${TIER_LABEL[unlocksAt].fr}`
    : `Available with the ${TIER_LABEL[unlocksAt].en} pack`

  const waUrl = supportWhatsAppUrl()

  return (
    <View style={[styles.card, { backgroundColor: c.surfaceElevated, borderColor: c.surfaceElevatedBorder }]}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={18} color={c.textSecondary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.title, { color: c.textPrimary }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>
            {description ?? upsell}
          </Text>
        </View>
        <View style={styles.upsellPill}>
          <Ionicons name="star" size={11} color="#E8571A" />
          <Text style={styles.upsellPillText}>{TIER_LABEL[unlocksAt][lang]}</Text>
        </View>
      </View>

      {waUrl && (
        <Pressable
          style={styles.contactBtn}
          onPress={() => { void Linking.openURL(waUrl) }}
          hitSlop={6}
        >
          <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
          <Text style={styles.contactBtnText}>
            {lang === 'fr' ? 'Contacter O\'Kili' : 'Contact O\'Kili'}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    opacity: 0.85,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
  },
  upsellPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(232,87,26,0.1)',
  },
  upsellPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E8571A',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(37,211,102,0.1)',
  },
  contactBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1FA855',
  },
})

import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useThemeColors } from '../../contexts/ThemeContext'
import { useUserActivity, type UserActivityItem } from '../../hooks/useActivity'
import { useCreditBalance } from '../../hooks/useCredit'

function formatFcfa(n: number, lang: 'fr' | 'en'): string {
  return `${n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA`
}

function formatDateTime(iso: string, lang: 'fr' | 'en'): string {
  return new Date(iso).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function eventCopy(item: UserActivityItem, lang: 'fr' | 'en'): { title: string; subtitle: string; amountText: string; amountColor: string; icon: any } {
  switch (item.kind) {
    case 'credit_earn_signup':
      return {
        title: lang === 'fr' ? 'Cadeau de bienvenue' : 'Welcome gift',
        subtitle: lang === 'fr' ? 'Crédit O\'Kili ajouté à votre compte' : 'O\'Kili credit added to your account',
        amountText: `+${formatFcfa(Math.abs(item.amountFcfa), lang)}`,
        amountColor: '#34C759',
        icon: 'gift',
      }
    case 'credit_earn_invite':
      return {
        title: lang === 'fr' ? 'Parrainage réussi' : 'Successful referral',
        subtitle: item.refUserName
          ? (lang === 'fr' ? `${item.refUserName} a rejoint avec votre code` : `${item.refUserName} joined with your code`)
          : (lang === 'fr' ? 'Un ami a rejoint avec votre code' : 'A friend joined with your code'),
        amountText: `+${formatFcfa(Math.abs(item.amountFcfa), lang)}`,
        amountColor: '#34C759',
        icon: 'people',
      }
    case 'credit_earn_adjust':
      return {
        title: lang === 'fr' ? 'Ajustement administrateur' : 'Admin adjustment',
        subtitle: lang === 'fr' ? 'Crédit ajusté manuellement' : 'Credit adjusted manually',
        amountText: `${item.amountFcfa >= 0 ? '+' : '−'}${formatFcfa(Math.abs(item.amountFcfa), lang)}`,
        amountColor: item.amountFcfa >= 0 ? '#34C759' : '#FF3B30',
        icon: 'construct-outline',
      }
    case 'credit_spend':
      return {
        title: lang === 'fr' ? 'Crédit utilisé' : 'Credit used',
        subtitle: item.placeName ?? (lang === 'fr' ? 'Restaurant' : 'Place'),
        amountText: `−${formatFcfa(Math.abs(item.amountFcfa), lang)}`,
        amountColor: '#FF3B30',
        icon: 'card-outline',
      }
    case 'coupon_redemption': {
      const coupon = item.couponTitleFr ?? item.couponTitleEn ?? (lang === 'fr' ? 'Coupon' : 'Coupon')
      const where  = item.placeName ?? (lang === 'fr' ? 'Restaurant' : 'Place')
      const subtitleParts = [where]
      if (item.billAmount !== null && item.discountApplied !== null) {
        subtitleParts.push(
          lang === 'fr'
            ? `Addition ${formatFcfa(item.billAmount, lang)} · Remise ${formatFcfa(item.discountApplied, lang)}`
            : `Bill ${formatFcfa(item.billAmount, lang)} · Discount ${formatFcfa(item.discountApplied, lang)}`,
        )
      }
      return {
        title: coupon,
        subtitle: subtitleParts.join(' · '),
        amountText: item.discountApplied !== null
          ? `−${formatFcfa(item.discountApplied, lang)}`
          : '',
        amountColor: '#E8571A',
        icon: 'pricetag',
      }
    }
  }
}

export default function ActivityScreen() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const colors = useThemeColors()
  const { data: items, isLoading } = useUserActivity(50)
  const { data: credit } = useCreditBalance()

  const styles = useMemo(() => createStyles(colors), [colors])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {lang === 'fr' ? 'Activité' : 'Activity'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Top stat card */}
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>
          {lang === 'fr' ? 'Crédit actuel' : 'Current credit'}
        </Text>
        <Text style={styles.statValue}>
          {formatFcfa(credit?.balance_fcfa ?? 0, lang)}
        </Text>
        {credit && credit.lifetime_earned > 0 && (
          <Text style={styles.statHint}>
            {lang === 'fr'
              ? `Gagné en tout : ${formatFcfa(credit.lifetime_earned, lang)}`
              : `Lifetime earned: ${formatFcfa(credit.lifetime_earned, lang)}`}
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loading}><ActivityIndicator color="#E8571A" /></View>
        ) : (items ?? []).length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={40} color={colors.iconMuted} />
            <Text style={styles.emptyTitle}>
              {lang === 'fr' ? 'Aucune activité' : 'No activity yet'}
            </Text>
            <Text style={styles.emptyText}>
              {lang === 'fr'
                ? 'Vos coupons utilisés et votre crédit apparaîtront ici.'
                : 'Coupons you redeem and credit movements will appear here.'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {(items ?? []).map(item => {
              const copy = eventCopy(item, lang)
              return (
                <Pressable
                  key={item.id}
                  style={styles.row}
                  onPress={() => item.placeId && router.push(`/place/${item.placeId}` as any)}
                >
                  <View style={[styles.icon, { backgroundColor: copy.amountColor + '1A' }]}>
                    <Ionicons name={copy.icon} size={16} color={copy.amountColor} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{copy.title}</Text>
                    <Text style={styles.rowSubtitle} numberOfLines={2}>{copy.subtitle}</Text>
                    <Text style={styles.rowMeta}>{formatDateTime(item.ts, lang)}</Text>
                  </View>
                  {copy.amountText ? (
                    <Text style={[styles.amount, { color: copy.amountColor }]}>{copy.amountText}</Text>
                  ) : null}
                </Pressable>
              )
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function createStyles(c: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bgPrimary },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: c.textPrimary },

    statCard: {
      marginHorizontal: 16, marginBottom: 14,
      padding: 16,
      borderRadius: 14,
      backgroundColor: 'rgba(232,87,26,0.08)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(232,87,26,0.2)',
    },
    statLabel: { fontSize: 11, fontWeight: '700', color: '#E8571A', textTransform: 'uppercase', letterSpacing: 0.4 },
    statValue: { fontSize: 26, fontWeight: '800', color: c.textPrimary, marginTop: 4 },
    statHint:  { fontSize: 11, color: c.textSecondary, marginTop: 4 },

    scroll: { paddingHorizontal: 16, paddingBottom: 32 },

    loading: { paddingVertical: 60, alignItems: 'center' },

    empty: { paddingVertical: 60, alignItems: 'center', gap: 10 },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
    emptyText:  { fontSize: 13, color: c.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 18 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 14,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.surfaceBorder,
    },
    icon: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
    },
    rowTitle:    { fontSize: 14, fontWeight: '700', color: c.textPrimary },
    rowSubtitle: { fontSize: 12, color: c.textSecondary, marginTop: 2, lineHeight: 16 },
    rowMeta:     { fontSize: 10, color: c.textSecondary, marginTop: 4 },

    amount: { fontSize: 14, fontWeight: '800', textAlign: 'right' },
  })
}

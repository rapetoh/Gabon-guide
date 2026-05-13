import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAdminActivity, type AdminActivityItem } from '../../hooks/useActivity'

const ORANGE = '#E8571A'

function fcfa(n: number, lang: 'fr' | 'en'): string {
  return `${n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA`
}

function fmtDateTime(iso: string, lang: 'fr' | 'en'): string {
  return new Date(iso).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

type FilterKey = 'all' | 'credit' | 'coupons'

export default function AdminActivityScreen() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const { data: items, isLoading } = useAdminActivity(200)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (items ?? []).filter(i => {
      if (filter === 'credit'  && i.kind === 'coupon_redemption') return false
      if (filter === 'coupons' && i.kind !== 'coupon_redemption') return false
      if (q) {
        const hay = `${i.userName ?? ''} ${i.userEmail ?? ''} ${i.placeName ?? ''} ${i.couponTitle ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [items, filter, search])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
        </Pressable>
        <Text style={styles.headerTitle}>
          {lang === 'fr' ? 'Activité' : 'Activity'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.filterRow}>
        {([
          { k: 'all',     label: lang === 'fr' ? 'Tout'    : 'All' },
          { k: 'credit',  label: lang === 'fr' ? 'Crédit'  : 'Credit' },
          { k: 'coupons', label: lang === 'fr' ? 'Coupons' : 'Coupons' },
        ] as const).map(f => {
          const active = filter === f.k
          return (
            <Pressable
              key={f.k}
              onPress={() => setFilter(f.k)}
              style={[styles.filterBtn, active && styles.filterBtnActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            </Pressable>
          )
        })}
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#8E8E93" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={lang === 'fr' ? 'Rechercher utilisateur, lieu, coupon…' : 'Search user, place, coupon…'}
          placeholderTextColor="#A3A3A8"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loading}><ActivityIndicator color={ORANGE} /></View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={40} color="#A3A3A8" />
            <Text style={styles.emptyTitle}>
              {lang === 'fr' ? 'Aucune activité' : 'No activity'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {filtered.map(item => <Row key={item.id} item={item} lang={lang} />)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Row({ item, lang }: { item: AdminActivityItem; lang: 'fr' | 'en' }) {
  const isCoupon = item.kind === 'coupon_redemption'
  const isEarn = !isCoupon && item.amountFcfa > 0
  const isSpend = item.kind === 'credit_spend'
  const userLabel = item.userName?.trim() || item.userEmail || '—'

  let title: string
  let subtitle: string
  if (isCoupon) {
    title = item.couponTitle ?? 'Coupon'
    subtitle = item.placeName ?? '—'
  } else {
    switch (item.kind) {
      case 'credit_earn_signup':
        title = lang === 'fr' ? 'Cadeau de bienvenue' : 'Welcome gift'
        subtitle = userLabel
        break
      case 'credit_earn_invite':
        title = lang === 'fr' ? 'Récompense de parrainage' : 'Invite reward'
        subtitle = userLabel
        break
      case 'credit_earn_adjust':
        title = lang === 'fr' ? 'Ajustement admin' : 'Admin adjustment'
        subtitle = userLabel
        break
      case 'credit_spend':
      default:
        title = lang === 'fr' ? 'Crédit utilisé' : 'Credit used'
        subtitle = item.placeName ?? userLabel
        break
    }
  }

  const tint = isCoupon ? ORANGE : isEarn ? '#34C759' : '#FF3B30'
  const iconName = isCoupon ? 'pricetag' : isEarn ? 'gift' : 'card-outline'
  const amountText = isCoupon
    ? (item.discountApplied != null ? `−${fcfa(item.discountApplied, lang)}` : '')
    : `${item.amountFcfa >= 0 ? '+' : '−'}${fcfa(Math.abs(item.amountFcfa), lang)}`

  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: tint + '1A' }]}>
        <Ionicons name={iconName as any} size={16} color={tint} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {isCoupon ? userLabel : subtitle}
        </Text>
        <Text style={styles.rowMeta}>{fmtDateTime(item.ts, lang)}</Text>
      </View>
      {amountText ? (
        <Text style={[styles.amount, { color: tint }]}>{amountText}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 6,
  },
  filterBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  filterBtnActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  filterText: { fontSize: 12, fontWeight: '600', color: '#3C3C43' },
  filterTextActive: { color: '#fff' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  searchInput: {
    flex: 1, fontSize: 14, color: '#1C1C1E',
    paddingVertical: 0,
  },

  scroll: { paddingHorizontal: 16, paddingBottom: 32 },

  loading: { paddingVertical: 60, alignItems: 'center' },
  empty: { paddingVertical: 60, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowTitle:    { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  rowSubtitle: { fontSize: 12, color: '#3C3C43', marginTop: 2 },
  rowMeta:     { fontSize: 10, color: '#8E8E93', marginTop: 3 },
  amount:      { fontSize: 14, fontWeight: '800', textAlign: 'right' },
})

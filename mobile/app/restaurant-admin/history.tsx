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
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useOwnedPlaceId } from '../../hooks/useCoupons'
import { useOwnerActivity, type OwnerActivityItem } from '../../hooks/useActivity'

const ORANGE = '#E8571A'

function formatFcfa(n: number, lang: 'fr' | 'en'): string {
  return `${n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA`
}

function formatDateTime(iso: string, lang: 'fr' | 'en'): string {
  return new Date(iso).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

type FilterKey = 'all' | 'today' | 'week' | 'month'

function withinFilter(iso: string, filter: FilterKey): boolean {
  if (filter === 'all') return true
  const ts = new Date(iso).getTime()
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  switch (filter) {
    case 'today': return now - ts <= dayMs
    case 'week':  return now - ts <= 7 * dayMs
    case 'month': return now - ts <= 31 * dayMs
  }
}

export default function OwnerHistoryScreen() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const { data: placeId } = useOwnedPlaceId()
  const { data: items, isLoading } = useOwnerActivity(placeId ?? undefined, 100)
  const [filter, setFilter] = useState<FilterKey>('all')

  const filtered = useMemo(() => (items ?? []).filter(i => withinFilter(i.ts, filter)), [items, filter])

  // Aggregate totals for the active filter
  const totals = useMemo(() => {
    let bills = 0, discount = 0, credit = 0, count = 0
    for (const it of filtered) {
      count += 1
      if (it.kind === 'coupon_redemption') {
        bills    += it.billAmount      ?? 0
        discount += it.discountApplied ?? 0
      } else if (it.kind === 'credit_spend') {
        credit += it.creditUsedFcfa ?? 0
      }
    }
    return { bills, discount, credit, count, net: bills - discount - credit }
  }, [filtered])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
        </Pressable>
        <Text style={styles.headerTitle}>
          {lang === 'fr' ? 'Historique' : 'History'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {([
          { k: 'today', label: lang === 'fr' ? "Aujourd'hui" : 'Today' },
          { k: 'week',  label: lang === 'fr' ? '7 jours'    : '7 days' },
          { k: 'month', label: lang === 'fr' ? '30 jours'   : '30 days' },
          { k: 'all',   label: lang === 'fr' ? 'Tout'       : 'All' },
        ] as const).map(f => {
          const active = filter === f.k
          return (
            <Pressable
              key={f.k}
              onPress={() => setFilter(f.k)}
              style={[styles.filterBtn, active && styles.filterBtnActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* Aggregate strip */}
      {!isLoading && totals.count > 0 && (
        <View style={styles.aggregateRow}>
          <AggregateBlock
            label={lang === 'fr' ? 'Transactions' : 'Transactions'}
            value={String(totals.count)}
          />
          <View style={styles.aggSep} />
          <AggregateBlock
            label={lang === 'fr' ? 'Remises' : 'Discounts'}
            value={`−${formatFcfa(totals.discount, lang)}`}
            tint={ORANGE}
          />
          <View style={styles.aggSep} />
          <AggregateBlock
            label={lang === 'fr' ? 'Crédit utilisé' : 'Credit used'}
            value={`−${formatFcfa(totals.credit, lang)}`}
            tint={ORANGE}
          />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loading}><ActivityIndicator color={ORANGE} /></View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={40} color="#A3A3A8" />
            <Text style={styles.emptyTitle}>
              {lang === 'fr' ? 'Aucune transaction' : 'No transactions'}
            </Text>
            <Text style={styles.emptyText}>
              {lang === 'fr'
                ? 'Les coupons et crédits validés apparaîtront ici en temps réel.'
                : 'Validated coupons and credits appear here in real time.'}
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

function Row({ item, lang }: { item: OwnerActivityItem; lang: 'fr' | 'en' }) {
  const isCoupon = item.kind === 'coupon_redemption'
  const customerLabel = item.customerName?.trim() || item.customerEmail || (lang === 'fr' ? 'Client' : 'Customer')

  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: isCoupon ? 'rgba(232,87,26,0.12)' : 'rgba(52,199,89,0.14)' }]}>
        <Ionicons
          name={isCoupon ? 'pricetag' : 'card-outline'}
          size={16}
          color={isCoupon ? ORANGE : '#34C759'}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {isCoupon ? (
          <>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {(lang === 'en' && item.couponTitleEn) ? item.couponTitleEn : (item.couponTitleFr ?? (lang === 'fr' ? 'Coupon' : 'Coupon'))}
            </Text>
            <Text style={styles.rowSubtitle} numberOfLines={1}>{customerLabel}</Text>
            <Text style={styles.rowMeta}>
              {item.billAmount !== null
                ? `${lang === 'fr' ? 'Addition' : 'Bill'} ${formatFcfa(item.billAmount, lang)} · ${formatDateTime(item.ts, lang)}`
                : formatDateTime(item.ts, lang)}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {lang === 'fr' ? 'Crédit utilisé' : 'Credit used'}
            </Text>
            <Text style={styles.rowSubtitle} numberOfLines={1}>{customerLabel}</Text>
            <Text style={styles.rowMeta}>{formatDateTime(item.ts, lang)}</Text>
          </>
        )}
      </View>
      <Text style={[styles.amount, { color: isCoupon ? ORANGE : '#34C759' }]}>
        {isCoupon
          ? (item.discountApplied !== null ? `−${formatFcfa(item.discountApplied, lang)}` : '')
          : (item.creditUsedFcfa !== null ? `−${formatFcfa(item.creditUsedFcfa, lang)}` : '')}
      </Text>
    </View>
  )
}

function AggregateBlock({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={styles.aggLabel}>{label}</Text>
      <Text style={[styles.aggValue, tint ? { color: tint } : null]} numberOfLines={1}>{value}</Text>
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
    paddingBottom: 10,
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

  aggregateRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  aggSep: { width: StyleSheet.hairlineWidth, backgroundColor: '#E5E5EA' },
  aggLabel: { fontSize: 10, color: '#6B6B70', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  aggValue: { fontSize: 14, fontWeight: '800', color: '#1C1C1E', marginTop: 4 },

  scroll: { paddingHorizontal: 16, paddingBottom: 32 },

  loading: { paddingVertical: 60, alignItems: 'center' },

  empty: { paddingVertical: 60, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  emptyText: { fontSize: 13, color: '#6B6B70', textAlign: 'center', maxWidth: 260, lineHeight: 18 },

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

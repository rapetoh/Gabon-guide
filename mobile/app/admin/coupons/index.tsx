import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  useAdminCoupons,
  useAdminSetCouponActive,
  useDeletePlatformCoupon,
  type AdminCouponFilter,
  type AdminCouponRow,
} from '../../../hooks/useCoupons'

const ORANGE = '#E8571A'

function fmtDate(iso: string, lang: 'fr' | 'en'): string {
  return new Date(iso).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function discountLabel(c: AdminCouponRow): string | null {
  if (c.discount_type === null || c.discount_value === null) return null
  if (c.discount_type === 'percentage') return `-${c.discount_value}%`
  return `-${c.discount_value.toLocaleString('fr-FR')} FCFA`
}

function scopeLabel(c: AdminCouponRow, lang: 'fr' | 'en'): string {
  switch (c.scopeKind) {
    case 'single':           return c.placeName ?? '—'
    case 'platform_all':     return lang === 'fr' ? 'Tous les restaurants' : 'All restaurants'
    case 'platform_subset':  return lang === 'fr' ? `${c.scopePlaceCount} restaurant${c.scopePlaceCount > 1 ? 's' : ''}` : `${c.scopePlaceCount} restaurant${c.scopePlaceCount > 1 ? 's' : ''}`
  }
}

function statusOf(c: AdminCouponRow): 'live' | 'inactive' | 'expired' | 'scheduled' {
  if (!c.is_active) return 'inactive'
  const now = Date.now()
  if (new Date(c.expires_at).getTime() < now) return 'expired'
  if (new Date(c.starts_at).getTime() > now) return 'scheduled'
  return 'live'
}

export default function AdminCouponsList() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const [filter, setFilter] = useState<AdminCouponFilter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const { data, isLoading } = useAdminCoupons({ page, perPage: 25, search, filter })
  const deleteCoupon = useDeletePlatformCoupon()
  const setActive = useAdminSetCouponActive()

  const rows = data?.rows ?? []
  const total = data?.totalCount ?? 0
  const hasMore = data?.hasMore ?? false

  async function handleToggleActive(c: AdminCouponRow) {
    try {
      await setActive.mutateAsync({ id: c.id, isActive: !c.is_active })
    } catch (e: any) {
      Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', e?.message ?? 'Could not update')
    }
  }

  function confirmDelete(c: AdminCouponRow) {
    Alert.alert(
      lang === 'fr' ? 'Supprimer le coupon ?' : 'Delete coupon?',
      lang === 'fr'
        ? 'Un coupon sans historique sera supprimé définitivement. Un coupon déjà réclamé ou utilisé ne peut pas être supprimé — il sera désactivé à la place.'
        : 'A coupon with no history is permanently removed. A coupon that was already claimed or used cannot be deleted — it will be deactivated instead.',
      [
        { text: lang === 'fr' ? 'Annuler' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'fr' ? 'Supprimer' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCoupon.mutateAsync(c.id)
            } catch (e: any) {
              // 23503 = Postgres FK RESTRICT: redemption history exists.
              // Deactivate instead so the coupon disappears from users
              // while its history stays intact.
              if (e?.code === '23503') {
                try {
                  await setActive.mutateAsync({ id: c.id, isActive: false })
                  Alert.alert(
                    lang === 'fr' ? 'Coupon désactivé' : 'Coupon deactivated',
                    lang === 'fr'
                      ? 'Ce coupon a un historique — il a été désactivé à la place.'
                      : 'This coupon has history — it was deactivated instead.'
                  )
                } catch (e2: any) {
                  Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', e2?.message ?? 'Could not deactivate')
                }
              } else {
                Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', e?.message ?? 'Could not delete')
              }
            }
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
        </Pressable>
        <Text style={styles.headerTitle}>
          {lang === 'fr' ? 'Coupons' : 'Coupons'}
        </Text>
        <Pressable
          onPress={() => router.push('/admin/coupons/new' as any)}
          style={styles.newBtn}
          hitSlop={8}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Filters — plain row, no horizontal ScrollView. With a horizontal
          ScrollView, children stretch to the cross-axis (vertical),
          turning the chips into 600pt-tall capsules. flexWrap handles
          the unlikely case of new filters pushing the count over what
          fits on a single line. */}
      <View style={styles.filterRow}>
        {([
          { k: 'all',      label: lang === 'fr' ? 'Tous'     : 'All' },
          { k: 'live',     label: lang === 'fr' ? 'Actifs'   : 'Live' },
          { k: 'platform', label: lang === 'fr' ? 'Plateforme' : 'Platform' },
          { k: 'inactive', label: lang === 'fr' ? 'Inactifs' : 'Inactive' },
          { k: 'expired',  label: lang === 'fr' ? 'Expirés'  : 'Expired' },
        ] as const).map(f => {
          const active = filter === f.k
          return (
            <Pressable
              key={f.k}
              onPress={() => { setFilter(f.k); setPage(0) }}
              style={[styles.filterBtn, active && styles.filterBtnActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            </Pressable>
          )
        })}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#8E8E93" />
        <TextInput
          value={search}
          onChangeText={(v) => { setSearch(v); setPage(0) }}
          placeholder={lang === 'fr' ? 'Titre ou restaurant…' : 'Title or restaurant…'}
          placeholderTextColor="#A3A3A8"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loading}><ActivityIndicator color={ORANGE} /></View>
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="ticket-outline" size={40} color="#A3A3A8" />
            <Text style={styles.emptyTitle}>
              {lang === 'fr' ? 'Aucun coupon' : 'No coupons'}
            </Text>
            <Text style={styles.emptyText}>
              {lang === 'fr'
                ? 'Créez un coupon plateforme en haut à droite, ou attendez qu\'un restaurateur en publie un.'
                : 'Create a platform coupon top-right, or wait for an owner to publish one.'}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.totalRow}>
              <Text style={styles.totalText}>
                {lang === 'fr'
                  ? `${total} résultat${total > 1 ? 's' : ''}`
                  : `${total} result${total > 1 ? 's' : ''}`}
              </Text>
            </View>
            <View style={{ gap: 10 }}>
              {rows.map(c => {
                const s = statusOf(c)
                const isPlatform = c.scopeKind !== 'single'
                return (
                  <View key={c.id} style={styles.row}>
                    <View style={[styles.iconWrap, isPlatform && styles.iconPlatform]}>
                      <Ionicons name={isPlatform ? 'globe-outline' : 'ticket'} size={16} color={isPlatform ? '#8B5CF6' : ORANGE} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.rowTopLine}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{c.title_fr}</Text>
                        {discountLabel(c) && (
                          <View style={styles.discountPill}>
                            <Text style={styles.discountText}>{discountLabel(c)}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.rowSubtitle} numberOfLines={1}>
                        {scopeLabel(c, lang)}
                      </Text>
                      <View style={styles.rowMetaRow}>
                        <StatusPill status={s} lang={lang} />
                        <Text style={styles.rowMeta}>
                          {lang === 'fr' ? 'Expire ' : 'Until '}{fmtDate(c.expires_at, lang)}
                        </Text>
                        <Text style={styles.rowMeta}>
                          {' · '}{c.redeemedCount} / {c.generatedCount}
                          {' '}{lang === 'fr' ? 'utilisés' : 'used'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.actionsCol}>
                      <Switch
                        value={c.is_active}
                        onValueChange={() => handleToggleActive(c)}
                        trackColor={{ true: ORANGE }}
                        style={styles.activeSwitch}
                      />
                      <Pressable onPress={() => confirmDelete(c)} hitSlop={8} style={styles.deleteBtn}>
                        <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                      </Pressable>
                    </View>
                  </View>
                )
              })}
            </View>

            {/* Pagination */}
            <View style={styles.pager}>
              <Pressable
                onPress={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                style={[styles.pagerBtn, page === 0 && styles.pagerBtnDisabled]}
              >
                <Ionicons name="chevron-back" size={16} color={page === 0 ? '#A3A3A8' : '#1C1C1E'} />
                <Text style={[styles.pagerText, page === 0 && styles.pagerTextDisabled]}>
                  {lang === 'fr' ? 'Précédent' : 'Prev'}
                </Text>
              </Pressable>
              <Text style={styles.pagerLabel}>
                {lang === 'fr' ? `Page ${page + 1}` : `Page ${page + 1}`}
              </Text>
              <Pressable
                onPress={() => hasMore && setPage(p => p + 1)}
                disabled={!hasMore}
                style={[styles.pagerBtn, !hasMore && styles.pagerBtnDisabled]}
              >
                <Text style={[styles.pagerText, !hasMore && styles.pagerTextDisabled]}>
                  {lang === 'fr' ? 'Suivant' : 'Next'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={hasMore ? '#1C1C1E' : '#A3A3A8'} />
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function StatusPill({ status, lang }: { status: 'live' | 'inactive' | 'expired' | 'scheduled'; lang: 'fr' | 'en' }) {
  const palette = {
    live:      { bg: 'rgba(52,199,89,0.12)',   fg: '#34C759', label: lang === 'fr' ? 'Actif' : 'Live' },
    scheduled: { bg: 'rgba(0,122,255,0.12)',   fg: '#007AFF', label: lang === 'fr' ? 'Planifié' : 'Scheduled' },
    inactive:  { bg: 'rgba(142,142,147,0.16)', fg: '#8E8E93', label: lang === 'fr' ? 'Inactif' : 'Off' },
    expired:   { bg: 'rgba(255,59,48,0.12)',   fg: '#FF3B30', label: lang === 'fr' ? 'Expiré' : 'Expired' },
  }[status]
  return (
    <View style={[styles.statusPill, { backgroundColor: palette.bg }]}>
      <Text style={[styles.statusText, { color: palette.fg }]}>{palette.label}</Text>
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
  newBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: ORANGE,
    alignItems: 'center', justifyContent: 'center',
  },

  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 6,
  },
  filterBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E5EA',
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
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E5EA',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1C1C1E', paddingVertical: 0 },

  scroll: { paddingHorizontal: 16, paddingBottom: 32 },

  loading: { paddingVertical: 60, alignItems: 'center' },
  empty: { paddingVertical: 60, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  emptyText: { fontSize: 13, color: '#6B6B70', textAlign: 'center', maxWidth: 280, lineHeight: 18 },

  totalRow: { paddingBottom: 10 },
  totalText: { fontSize: 11, color: '#6B6B70', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E5EA',
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(232,87,26,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconPlatform: { backgroundColor: 'rgba(139,92,246,0.12)' },
  rowTopLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  rowSubtitle: { fontSize: 12, color: '#6B6B70', marginTop: 2 },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  rowMeta: { fontSize: 10, color: '#8E8E93' },

  discountPill: {
    backgroundColor: 'rgba(232,87,26,0.12)',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 999,
  },
  discountText: { color: ORANGE, fontSize: 11, fontWeight: '700' },

  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },

  actionsCol: { alignItems: 'center', gap: 8 },
  activeSwitch: { transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,59,48,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },

  pager: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, paddingHorizontal: 4,
    marginTop: 8,
  },
  pagerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E5EA',
  },
  pagerBtnDisabled: { opacity: 0.4 },
  pagerText: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  pagerTextDisabled: { color: '#A3A3A8' },
  pagerLabel: { fontSize: 12, color: '#6B6B70', fontWeight: '600' },
})

import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
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
import { useQuery } from '@tanstack/react-query'

import { useReferralSettings, useUpdateReferralSettings } from '../../hooks/useReferrals'
import { useReferralAnalytics } from '../../hooks/useActivity'
import { supabase } from '../../lib/supabase'

function fcfa(n: number): string {
  return `${n.toLocaleString('fr-FR')} FCFA`
}

interface CouponOption {
  id: string
  title_fr: string
  title_en: string | null
  expires_at: string
  place_name: string
}

function useActiveCouponsForReward() {
  return useQuery({
    queryKey: ['admin-active-coupons-for-reward'],
    queryFn: async () => {
      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
        .from('coupons')
        .select('id, title_fr, title_en, expires_at, places(name)')
        .eq('is_active', true)
        .gt('expires_at', nowIso)
        .order('expires_at', { ascending: true })
      if (error) throw error
      return ((data ?? []) as unknown as Array<{
        id: string
        title_fr: string
        title_en: string | null
        expires_at: string
        places: { name: string } | null
      }>).map<CouponOption>(c => ({
        id: c.id,
        title_fr: c.title_fr,
        title_en: c.title_en,
        expires_at: c.expires_at,
        place_name: c.places?.name ?? '—',
      }))
    },
  })
}

function useReferralLinkCount() {
  return useQuery({
    queryKey: ['admin-referral-link-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .not('referred_by', 'is', null)
      return count ?? 0
    },
  })
}

export default function AdminReferralsScreen() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  const { data: settings, isLoading } = useReferralSettings()
  const updateSettings = useUpdateReferralSettings()
  const { data: coupons } = useActiveCouponsForReward()
  const { data: linkCount } = useReferralLinkCount()
  const { data: analytics } = useReferralAnalytics()

  // Local cache so toggles feel instant; mutation pushes to server.
  const [local, setLocal] = useState(settings)
  useEffect(() => { if (settings) setLocal(settings) }, [settings])

  const isCouponReward = local?.reward_type === 'coupon'
  const isCreditReward = local?.reward_type === 'welcome_credit'
  const selectedCoupon = useMemo(
    () => coupons?.find(c => c.id === local?.reward_coupon_id) ?? null,
    [coupons, local?.reward_coupon_id],
  )
  const [creditDraft, setCreditDraft] = useState<string>('')
  useEffect(() => {
    if (local?.reward_credit_fcfa != null) setCreditDraft(String(local.reward_credit_fcfa))
    else if (isCreditReward) setCreditDraft('1000')
  }, [local?.reward_credit_fcfa, isCreditReward])

  async function save(patch: Partial<NonNullable<typeof settings>>) {
    if (!local) return
    const prev = local
    setLocal({ ...local, ...patch } as typeof local)
    try {
      await updateSettings.mutateAsync(patch as any)
    } catch (e: any) {
      setLocal(prev)
      Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', e?.message ?? 'Could not save')
    }
  }

  function pickCoupon() {
    if (!coupons || coupons.length === 0) {
      Alert.alert(
        lang === 'fr' ? 'Aucun coupon actif' : 'No active coupons',
        lang === 'fr'
          ? 'Créez d\'abord un coupon depuis le tableau de bord d\'un restaurant.'
          : 'Create a coupon first from a restaurant\'s dashboard.',
      )
      return
    }
    Alert.alert(
      lang === 'fr' ? 'Coupon de récompense' : 'Reward coupon',
      lang === 'fr'
        ? 'Choisissez le coupon offert au parrain et au filleul.'
        : 'Choose the coupon issued to both the referrer and the new user.',
      [
        ...coupons.map(c => ({
          text: `${lang === 'en' && c.title_en ? c.title_en : c.title_fr} — ${c.place_name}`,
          onPress: () => save({ reward_coupon_id: c.id }),
        })),
        { text: lang === 'fr' ? 'Aucun' : 'None', onPress: () => save({ reward_coupon_id: null }), style: 'destructive' },
        { text: lang === 'fr' ? 'Annuler' : 'Cancel', style: 'cancel' },
      ],
    )
  }

  if (isLoading || !local) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header lang={lang} />
        <View style={styles.loading}><ActivityIndicator color="#E8571A" /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header lang={lang} />
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Hero stats — 4 cards in 2 rows of 2 */}
        <View style={styles.statsGrid}>
          <MiniStat
            label={lang === 'fr' ? 'Liens' : 'Links'}
            value={String(linkCount ?? 0)}
          />
          <MiniStat
            label={lang === 'fr' ? 'Crédit émis' : 'Credit issued'}
            value={fcfa(analytics?.totalIssued ?? 0)}
            tint="#34C759"
          />
          <MiniStat
            label={lang === 'fr' ? 'Crédit dépensé' : 'Credit spent'}
            value={fcfa(analytics?.totalSpent ?? 0)}
            tint="#E8571A"
          />
          <MiniStat
            label={lang === 'fr' ? 'Solde restant' : 'Outstanding'}
            value={fcfa(analytics?.outstanding ?? 0)}
          />
        </View>

        {/* Top referrers */}
        {analytics && analytics.topReferrers.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {lang === 'fr' ? 'Top parrains' : 'Top referrers'}
            </Text>
            <View style={{ gap: 8 }}>
              {analytics.topReferrers.map((r, idx) => (
                <View key={r.userId} style={styles.topRow}>
                  <View style={styles.topRank}>
                    <Text style={styles.topRankText}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.topName} numberOfLines={1}>
                      {r.name?.trim() || r.email || '—'}
                    </Text>
                    {r.email && r.name && r.email !== r.name && (
                      <Text style={styles.topSub} numberOfLines={1}>{r.email}</Text>
                    )}
                  </View>
                  <Text style={styles.topCount}>{r.count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Link to full activity feed */}
        <Pressable
          onPress={() => router.push('/admin/activity' as any)}
          style={styles.viewAllBtn}
        >
          <Ionicons name="receipt-outline" size={16} color="#E8571A" />
          <Text style={styles.viewAllText}>
            {lang === 'fr' ? "Voir l'activité complète" : 'View full activity'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#E8571A" />
        </Pressable>

        <Text style={styles.intro}>
          {lang === 'fr'
            ? 'Quand un nouvel utilisateur s\'inscrit avec un code de parrainage, ces paramètres déterminent ce qui est offert au parrain et au filleul.'
            : 'When a new user signs up with a referral code, these settings determine what both the referrer and the new user receive.'}
        </Text>

        {/* Active toggle */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {lang === 'fr' ? 'Programme actif' : 'Program active'}
              </Text>
              <Text style={styles.cardHint}>
                {lang === 'fr'
                  ? 'Désactivez pour enregistrer les liens sans donner de récompense.'
                  : 'Turn off to record links without issuing rewards.'}
              </Text>
            </View>
            <Switch
              value={local.is_active}
              onValueChange={(v) => save({ is_active: v })}
              trackColor={{ true: '#E8571A' }}
            />
          </View>
        </View>

        {/* Reward type */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {lang === 'fr' ? 'Type de récompense' : 'Reward type'}
          </Text>
          <View style={styles.segmentRow}>
            {(['welcome_credit', 'coupon', 'none'] as const).map(t => {
              const active = local.reward_type === t
              const label =
                t === 'welcome_credit'
                  ? (lang === 'fr' ? 'Crédit (FCFA)' : 'Credit (FCFA)')
                  : t === 'coupon'
                    ? (lang === 'fr' ? 'Coupon' : 'Coupon')
                    : (lang === 'fr' ? 'Aucune' : 'None')
              return (
                <Pressable
                  key={t}
                  onPress={() => save({
                    reward_type: t,
                    reward_coupon_id: t === 'coupon' ? local.reward_coupon_id : null,
                    reward_credit_fcfa: t === 'welcome_credit'
                      ? (local.reward_credit_fcfa ?? 1000)
                      : null,
                  })}
                  style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <Text style={styles.cardHint}>
            {lang === 'fr'
              ? 'Le crédit (recommandé) est dépensable dans tout O\'Kili. Le coupon est lié à un restaurant précis.'
              : 'Credit (recommended) is spendable across O\'Kili. Coupon is tied to one specific place.'}
          </Text>
        </View>

        {/* Credit amount */}
        {isCreditReward && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {lang === 'fr' ? 'Montant du crédit (par personne)' : 'Credit amount (per side)'}
            </Text>
            <Text style={styles.cardHint}>
              {lang === 'fr'
                ? 'Chaque parrain et chaque filleul reçoit ce montant en FCFA à l\'inscription.'
                : 'Each referrer and new user receives this FCFA amount on signup.'}
            </Text>
            <View style={styles.creditInputRow}>
              <TextInput
                value={creditDraft}
                onChangeText={(t) => setCreditDraft(t.replace(/[^0-9]/g, ''))}
                onBlur={() => {
                  const n = parseInt(creditDraft, 10)
                  if (Number.isFinite(n) && n > 0 && n !== local.reward_credit_fcfa) {
                    void save({ reward_credit_fcfa: n })
                  } else if (!Number.isFinite(n) || n <= 0) {
                    setCreditDraft(String(local.reward_credit_fcfa ?? 1000))
                  }
                }}
                keyboardType="number-pad"
                style={styles.creditInput}
                placeholder="1000"
              />
              <Text style={styles.creditInputUnit}>FCFA</Text>
            </View>
          </View>
        )}

        {/* Coupon picker */}
        {isCouponReward && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {lang === 'fr' ? 'Coupon offert' : 'Reward coupon'}
            </Text>
            <Text style={styles.cardHint}>
              {lang === 'fr'
                ? 'Ce coupon sera émis au parrain et au filleul. Chacun peut le réclamer une fois.'
                : 'Issued to both the referrer and the new user. Each can redeem it once.'}
            </Text>
            <Pressable style={styles.couponPicker} onPress={pickCoupon}>
              <Ionicons name="ticket-outline" size={18} color="#E8571A" />
              <Text style={styles.couponPickerText} numberOfLines={1}>
                {selectedCoupon
                  ? (lang === 'en' && selectedCoupon.title_en ? selectedCoupon.title_en : selectedCoupon.title_fr)
                  : (lang === 'fr' ? 'Sélectionner un coupon…' : 'Pick a coupon…')}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#A3A3A8" />
            </Pressable>
            {selectedCoupon && (
              <Text style={styles.couponMeta}>
                {selectedCoupon.place_name} · {lang === 'fr' ? 'Expire le ' : 'Until '}
                {new Date(selectedCoupon.expires_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Header({ lang }: { lang: 'fr' | 'en' }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
      </Pressable>
      <Text style={styles.headerTitle}>
        {lang === 'fr' ? 'Parrainage' : 'Referrals'}
      </Text>
      <View style={{ width: 24 }} />
    </View>
  )
}

function MiniStat({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <Text style={[styles.miniStatValue, tint ? { color: tint } : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  scroll: { padding: 16, gap: 14 },

  intro: { fontSize: 13, color: '#6B6B70', lineHeight: 18 },

  statCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(232,87,26,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(232,87,26,0.2)',
  },
  statLabel: { fontSize: 11, color: '#E8571A', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontSize: 28, fontWeight: '800', color: '#1C1C1E', marginTop: 4 },

  card: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  cardHint: { fontSize: 11, color: '#6B6B70', lineHeight: 16 },

  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  segmentBtnActive: { backgroundColor: '#E8571A', borderColor: '#E8571A' },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#3C3C43' },
  segmentTextActive: { color: '#fff' },

  couponPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  couponPickerText: { flex: 1, fontSize: 14, color: '#1C1C1E', fontWeight: '500' },
  couponMeta: { fontSize: 11, color: '#6B6B70' },

  creditInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  creditInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  creditInputUnit: { fontSize: 14, color: '#6B6B70', fontWeight: '600' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  miniStat: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  miniStatLabel: {
    fontSize: 10, fontWeight: '700',
    color: '#6B6B70',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  miniStatValue: { fontSize: 16, fontWeight: '800', color: '#1C1C1E', marginTop: 4 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topRank: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(232,87,26,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  topRankText: { color: '#E8571A', fontSize: 11, fontWeight: '800' },
  topName: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  topSub:  { fontSize: 11, color: '#6B6B70', marginTop: 1 },
  topCount:{ fontSize: 14, fontWeight: '800', color: '#1C1C1E' },

  viewAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(232,87,26,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(232,87,26,0.3)',
  },
  viewAllText: { color: '#E8571A', fontSize: 13, fontWeight: '700' },
})

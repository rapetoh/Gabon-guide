import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useSession } from '../../hooks/useSession'
import { usePlaceTier } from '../../hooks/usePlaceTier'
import { useThemeColors } from '../../contexts/ThemeContext'
import {
  Coupon,
  useCouponsForPlace,
  useCreateCoupon,
  useDeleteCoupon,
  useUpdateCoupon,
} from '../../hooks/useCoupons'
import { useCouponUsage } from '../../hooks/useCouponRedemption'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { LockedFeatureCard } from '../../components/restaurant-admin/LockedFeatureCard'

interface OwnedPlaceLite {
  id: string
  name: string
  subscription_tier: 'free' | 'standard' | 'premium'
  subscription_expires_at: string | null
}

function useOwnedPlaceForCoupons(userId: string | undefined) {
  return useQuery({
    queryKey: ['owned-place-coupons', userId],
    queryFn: async () => {
      if (!userId) return null
      const { data } = await supabase
        .from('places')
        .select('id, name, subscription_tier, subscription_expires_at')
        .eq('owner_id', userId)
        .eq('is_deleted', false)
        .single()
      return data as OwnedPlaceLite | null
    },
    enabled: !!userId,
  })
}

function formatDate(iso: string, lang: 'fr' | 'en') {
  return new Date(iso).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function isCouponLive(c: Coupon) {
  if (!c.is_active) return false
  const now = Date.now()
  return new Date(c.starts_at).getTime() <= now && new Date(c.expires_at).getTime() > now
}

function discountLabel(c: Coupon, lang: 'fr' | 'en'): string | null {
  if (c.discount_type === null || c.discount_value === null) return null
  if (c.discount_type === 'percentage') return `-${c.discount_value}%`
  return `-${c.discount_value.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA`
}

function CouponInfoRow({ coupon, lang }: { coupon: Coupon; lang: 'fr' | 'en' }) {
  const colors = useThemeColors()
  const { data: usage } = useCouponUsage(coupon.id)
  const label = discountLabel(coupon, lang)

  const totalUsed = usage?.totalRedeemed ?? 0
  const cap = coupon.max_total_redemptions
  const soldOut = cap !== null && totalUsed >= cap

  return (
    <View style={[styles.usageRow, { flexWrap: 'wrap' }]}>
      {label && (
        <View style={styles.discountPill}>
          <Ionicons name="pricetag" size={11} color="#E8571A" />
          <Text style={styles.discountPillText}>{label}</Text>
        </View>
      )}
      <Text style={[styles.usageText, { color: colors.textSecondary }]}>
        {cap !== null
          ? (lang === 'fr' ? `${totalUsed} / ${cap} utilisés` : `${totalUsed} / ${cap} used`)
          : (lang === 'fr' ? `${totalUsed} utilisé(s)` : `${totalUsed} used`)}
        {coupon.max_redemptions_per_user > 1
          ? (lang === 'fr'
              ? ` · max ${coupon.max_redemptions_per_user}/client`
              : ` · max ${coupon.max_redemptions_per_user}/customer`)
          : ''}
      </Text>
      {soldOut && (
        <View style={styles.soldOutPill}>
          <Text style={styles.soldOutText}>
            {lang === 'fr' ? 'Épuisé' : 'Sold out'}
          </Text>
        </View>
      )}
    </View>
  )
}

export default function RestaurantAdminCoupons() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const colors = useThemeColors()
  const { session } = useSession()
  const { data: place, isLoading: placeLoading } = useOwnedPlaceForCoupons(session?.user.id)
  const tier = usePlaceTier(place ?? undefined)
  const { data: coupons, isLoading: couponsLoading } = useCouponsForPlace(place?.id)
  const createCoupon = useCreateCoupon()
  const deleteCoupon = useDeleteCoupon(place?.id ?? '')
  const updateCoupon = useUpdateCoupon(place?.id ?? '')


  const [creating, setCreating] = useState(false)
  const [titleFr, setTitleFr] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [descFr, setDescFr] = useState('')
  const [expiresAt, setExpiresAt] = useState('')  // YYYY-MM-DD
  const [maxPerUser, setMaxPerUser] = useState('1')
  const [maxTotal, setMaxTotal] = useState('')  // empty = unlimited
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'amount'>('none')
  const [discountValue, setDiscountValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canCreate = tier.can('coupons_create')

  function resetForm() {
    setTitleFr('')
    setTitleEn('')
    setDescFr('')
    setExpiresAt('')
    setMaxPerUser('1')
    setMaxTotal('')
    setDiscountType('none')
    setDiscountValue('')
  }

  async function handleCreate() {
    if (!place) return
    if (!titleFr.trim()) {
      Alert.alert(lang === 'fr' ? 'Titre requis' : 'Title required')
      return
    }
    if (!expiresAt) {
      Alert.alert(lang === 'fr' ? 'Date d’expiration requise' : 'Expiration date required')
      return
    }
    const exp = new Date(expiresAt + 'T23:59:59Z')
    if (Number.isNaN(exp.getTime()) || exp.getTime() < Date.now()) {
      Alert.alert(
        lang === 'fr' ? 'Date invalide' : 'Invalid date',
        lang === 'fr' ? 'Choisissez une date d’expiration future.' : 'Pick a future expiration date.'
      )
      return
    }

    const perUser = Math.max(1, parseInt(maxPerUser, 10) || 1)
    const total = maxTotal.trim() === '' ? null : Math.max(1, parseInt(maxTotal, 10) || 1)

    let dtype: 'percentage' | 'amount' | null = null
    let dvalue: number | null = null
    if (discountType !== 'none') {
      const v = parseInt(discountValue, 10)
      if (!Number.isFinite(v) || v <= 0) {
        Alert.alert(
          lang === 'fr' ? 'Valeur de remise invalide' : 'Invalid discount value',
          lang === 'fr' ? 'Entrez un nombre positif.' : 'Enter a positive number.'
        )
        return
      }
      if (discountType === 'percentage' && v > 100) {
        Alert.alert(
          lang === 'fr' ? 'Pourcentage invalide' : 'Invalid percentage',
          lang === 'fr' ? 'Le pourcentage doit être entre 1 et 100.' : 'Percentage must be between 1 and 100.'
        )
        return
      }
      dtype = discountType
      dvalue = v
    }

    setSubmitting(true)
    try {
      await createCoupon.mutateAsync({
        place_id: place.id,
        title_fr: titleFr.trim(),
        title_en: titleEn.trim() || null,
        description_fr: descFr.trim() || null,
        expires_at: exp.toISOString(),
        is_active: true,
        max_redemptions_per_user: perUser,
        max_total_redemptions: total,
        discount_type: dtype,
        discount_value: dvalue,
      })
      resetForm()
      setCreating(false)
    } catch (e: any) {
      Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', e?.message ?? 'Could not create')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(c: Coupon) {
    try {
      await updateCoupon.mutateAsync({ id: c.id, patch: { is_active: !c.is_active } })
    } catch (e: any) {
      Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', e?.message ?? 'Could not update')
    }
  }

  function handleDelete(c: Coupon) {
    Alert.alert(
      lang === 'fr' ? 'Supprimer le coupon ?' : 'Delete coupon?',
      lang === 'fr' ? 'Cette action est irréversible.' : 'This cannot be undone.',
      [
        { text: lang === 'fr' ? 'Annuler' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'fr' ? 'Supprimer' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCoupon.mutateAsync(c.id)
            } catch (e: any) {
              Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', e?.message ?? 'Could not delete')
            }
          },
        },
      ]
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {lang === 'fr' ? 'Coupons & promos' : 'Coupons & promos'}
        </Text>
        <Pressable
          onPress={() => router.push('/restaurant-admin/scanner' as any)}
          hitSlop={12}
          style={styles.scanBtn}
        >
          <Ionicons name="scan-outline" size={20} color="#E8571A" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Locked feature for Free */}
          {!placeLoading && place && !canCreate && (
            <LockedFeatureCard
              title={lang === 'fr' ? 'Coupons & promos' : 'Coupons & promos'}
              unlocksAt="standard"
              icon="ticket-outline"
              description={lang === 'fr' ? 'Offrez des remises pour attirer plus de clients' : 'Offer discounts to attract more customers'}
            />
          )}

          {placeLoading && (
            <View style={styles.center}><ActivityIndicator color="#E8571A" /></View>
          )}

          {!placeLoading && place && canCreate && (
            <>
              {/* Create form */}
              {creating ? (
                <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                    {lang === 'fr' ? 'Nouveau coupon' : 'New coupon'}
                  </Text>

                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>
                      {lang === 'fr' ? 'Titre (français) *' : 'Title (French) *'}
                    </Text>
                    <TextInput
                      style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surface }]}
                      value={titleFr}
                      onChangeText={setTitleFr}
                      placeholder={lang === 'fr' ? '-20% sur les cocktails du jeudi' : '-20% on Thursday cocktails'}
                      placeholderTextColor={colors.textPlaceholder}
                      maxLength={120}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>
                      {lang === 'fr' ? 'Titre (anglais)' : 'Title (English)'}
                    </Text>
                    <TextInput
                      style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surface }]}
                      value={titleEn}
                      onChangeText={setTitleEn}
                      placeholder="-20% on Thursday cocktails"
                      placeholderTextColor={colors.textPlaceholder}
                      maxLength={120}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>
                      {lang === 'fr' ? 'Détails' : 'Details'}
                    </Text>
                    <TextInput
                      style={[styles.inputMulti, { color: colors.textPrimary, backgroundColor: colors.surface }]}
                      value={descFr}
                      onChangeText={setDescFr}
                      multiline
                      numberOfLines={3}
                      placeholder={lang === 'fr' ? 'Conditions, montant minimum, etc.' : 'Conditions, minimum spend, etc.'}
                      placeholderTextColor={colors.textPlaceholder}
                      maxLength={400}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>
                      {lang === 'fr' ? 'Expire le (AAAA-MM-JJ) *' : 'Expires on (YYYY-MM-DD) *'}
                    </Text>
                    <TextInput
                      style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surface }]}
                      value={expiresAt}
                      onChangeText={setExpiresAt}
                      placeholder="2026-08-01"
                      placeholderTextColor={colors.textPlaceholder}
                      autoCapitalize="none"
                    />
                    <View style={styles.quickRow}>
                      {[
                        { label: '+1 ' + (lang === 'fr' ? 'sem.' : 'wk'),  days: 7 },
                        { label: '+1 ' + (lang === 'fr' ? 'mois' : 'mo'),  days: 30 },
                        { label: '+3 ' + (lang === 'fr' ? 'mois' : 'mo'),  days: 90 },
                      ].map(o => (
                        <Pressable
                          key={o.label}
                          onPress={() => {
                            const d = new Date()
                            d.setDate(d.getDate() + o.days)
                            setExpiresAt(d.toISOString().slice(0, 10))
                          }}
                          style={[styles.quickBtn, { backgroundColor: colors.surface }]}
                        >
                          <Text style={styles.quickBtnText}>{o.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>
                      {lang === 'fr' ? 'Limite par client' : 'Per-customer limit'}
                    </Text>
                    <TextInput
                      style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surface }]}
                      value={maxPerUser}
                      onChangeText={(t) => setMaxPerUser(t.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      placeholder="1"
                      placeholderTextColor={colors.textPlaceholder}
                    />
                    <Text style={[styles.helpText, { color: colors.textSecondary }]}>
                      {lang === 'fr' ? 'Combien de fois un même client peut l\'utiliser.' : 'How many times a single customer can use it.'}
                    </Text>
                  </View>

                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>
                      {lang === 'fr' ? 'Quota total' : 'Total quota'}
                    </Text>
                    <TextInput
                      style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surface }]}
                      value={maxTotal}
                      onChangeText={(t) => setMaxTotal(t.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      placeholder={lang === 'fr' ? 'Laisser vide pour illimité' : 'Leave empty for unlimited'}
                      placeholderTextColor={colors.textPlaceholder}
                    />
                    <Text style={[styles.helpText, { color: colors.textSecondary }]}>
                      {lang === 'fr'
                        ? 'Une fois atteint, le coupon devient indisponible pour tous.'
                        : 'Once reached, the coupon becomes unavailable to everyone.'}
                    </Text>
                  </View>

                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>
                      {lang === 'fr' ? 'Type de remise' : 'Discount type'}
                    </Text>
                    <View style={styles.segmentRow}>
                      {([
                        { key: 'none' as const,        label: lang === 'fr' ? 'Aucune' : 'None' },
                        { key: 'percentage' as const,  label: '%' },
                        { key: 'amount' as const,      label: 'FCFA' },
                      ]).map(opt => {
                        const active = discountType === opt.key
                        return (
                          <Pressable
                            key={opt.key}
                            onPress={() => setDiscountType(opt.key)}
                            style={[
                              styles.segmentBtn,
                              { backgroundColor: colors.surface },
                              active && styles.segmentBtnActive,
                            ]}
                          >
                            <Text style={[styles.segmentBtnText, active && styles.segmentBtnTextActive]}>
                              {opt.label}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  </View>

                  {discountType !== 'none' && (
                    <View style={styles.field}>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>
                        {discountType === 'percentage'
                          ? (lang === 'fr' ? 'Pourcentage (1–100)' : 'Percentage (1–100)')
                          : (lang === 'fr' ? 'Montant en FCFA' : 'Amount in FCFA')}
                      </Text>
                      <TextInput
                        style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surface }]}
                        value={discountValue}
                        onChangeText={(t) => setDiscountValue(t.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                        placeholder={discountType === 'percentage' ? '20' : '5000'}
                        placeholderTextColor={colors.textPlaceholder}
                      />
                      <Text style={[styles.helpText, { color: colors.textSecondary }]}>
                        {lang === 'fr'
                          ? 'Lorsque vous scannez le QR du client, ce montant sera déduit du total qu\'il vous indique.'
                          : 'When you scan the customer\'s QR, this amount will be deducted from the bill they show you.'}
                      </Text>
                    </View>
                  )}

                  <View style={styles.formActions}>
                    <Pressable
                      onPress={() => { resetForm(); setCreating(false) }}
                      style={styles.cancelBtn}
                      disabled={submitting}
                    >
                      <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                        {lang === 'fr' ? 'Annuler' : 'Cancel'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={handleCreate}
                      disabled={submitting || !titleFr.trim() || !expiresAt}
                      style={[styles.saveBtn, (!titleFr.trim() || !expiresAt || submitting) && styles.saveBtnDisabled]}
                    >
                      {submitting
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.saveBtnText}>{lang === 'fr' ? 'Publier' : 'Publish'}</Text>}
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  style={[styles.createCta, { borderColor: colors.separator }]}
                  onPress={() => setCreating(true)}
                >
                  <Ionicons name="add-circle" size={20} color="#E8571A" />
                  <Text style={styles.createCtaText}>
                    {lang === 'fr' ? 'Créer un nouveau coupon' : 'Create a new coupon'}
                  </Text>
                </Pressable>
              )}

              {/* Existing coupons */}
              {couponsLoading ? (
                <View style={styles.center}><ActivityIndicator color="#E8571A" /></View>
              ) : (coupons?.length ?? 0) === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="ticket-outline" size={36} color={colors.iconMuted} />
                  <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                    {lang === 'fr' ? 'Aucun coupon' : 'No coupons yet'}
                  </Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    {lang === 'fr'
                      ? 'Créez un coupon ci-dessus pour attirer plus de clients.'
                      : 'Create a coupon above to attract more customers.'}
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {(coupons ?? []).map(c => {
                    const live = isCouponLive(c)
                    const expired = new Date(c.expires_at).getTime() < Date.now()
                    return (
                      <View key={c.id} style={[styles.couponCard, { backgroundColor: colors.surfaceElevated }]}>
                        <View style={styles.couponHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.couponTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                              {lang === 'en' && c.title_en ? c.title_en : c.title_fr}
                            </Text>
                            <Text style={[styles.couponMeta, { color: colors.textSecondary }]}>
                              {lang === 'fr' ? 'Expire le' : 'Expires on'} {formatDate(c.expires_at, lang)}
                            </Text>
                          </View>
                          <View style={[
                            styles.statusPill,
                            expired ? styles.statusExpired : live ? styles.statusLive : styles.statusOff,
                          ]}>
                            <Text style={[
                              styles.statusText,
                              expired ? styles.statusTextExpired : live ? styles.statusTextLive : styles.statusTextOff,
                            ]}>
                              {expired
                                ? (lang === 'fr' ? 'Expiré' : 'Expired')
                                : live
                                  ? (lang === 'fr' ? 'Actif' : 'Live')
                                  : (lang === 'fr' ? 'Inactif' : 'Off')}
                            </Text>
                          </View>
                        </View>

                        {(lang === 'en' && c.description_en
                          ? c.description_en
                          : c.description_fr) && (
                          <Text style={[styles.couponDesc, { color: colors.textSecondary }]}>
                            {lang === 'en' && c.description_en ? c.description_en : c.description_fr}
                          </Text>
                        )}

                        <CouponInfoRow coupon={c} lang={lang} />

                        <View style={styles.couponActions}>
                          <View style={styles.couponToggleRow}>
                            <Switch
                              value={c.is_active}
                              onValueChange={() => handleToggleActive(c)}
                              disabled={expired}
                              trackColor={{ true: '#E8571A' }}
                            />
                            <Text style={[styles.couponToggleLabel, { color: colors.textSecondary }]}>
                              {lang === 'fr' ? 'Visible aux clients' : 'Visible to users'}
                            </Text>
                          </View>
                          <Pressable onPress={() => handleDelete(c)} style={styles.deleteIconBtn}>
                            <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                          </Pressable>
                        </View>
                      </View>
                    )
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700' },
  scanBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  center: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },

  createCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  createCtaText: { fontSize: 14, fontWeight: '700', color: '#E8571A' },

  card: { borderRadius: 16, padding: 16, gap: 14 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  field: { gap: 6 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 14,
  },
  inputMulti: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  quickBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  quickBtnText: { fontSize: 12, fontWeight: '600', color: '#3C3C43' },

  helpText: { fontSize: 11, lineHeight: 15, marginTop: 4 },

  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentBtnActive: { backgroundColor: '#E8571A' },
  segmentBtnText: { fontSize: 13, fontWeight: '600', color: '#3C3C43' },
  segmentBtnTextActive: { color: '#fff' },

  discountPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(232,87,26,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  discountPillText: { color: '#E8571A', fontSize: 11, fontWeight: '700' },

  usageRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  usageText: { fontSize: 11, fontWeight: '600' },
  soldOutPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,59,48,0.12)',
  },
  soldOutText: { color: '#FF3B30', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },

  formActions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '500' },
  saveBtn: {
    flex: 1,
    backgroundColor: '#E8571A',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  couponCard: { borderRadius: 14, padding: 14, gap: 8 },
  couponHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  couponTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  couponMeta: { fontSize: 11, marginTop: 2 },
  couponDesc: { fontSize: 13, lineHeight: 18 },
  couponActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
  },
  couponToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  couponToggleLabel: { fontSize: 12 },
  deleteIconBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,59,48,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },

  statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  statusLive:    { backgroundColor: 'rgba(52,199,89,0.12)' },
  statusOff:     { backgroundColor: 'rgba(0,0,0,0.06)' },
  statusExpired: { backgroundColor: 'rgba(255,59,48,0.12)' },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  statusTextLive:    { color: '#34C759' },
  statusTextOff:     { color: '#8E8E93' },
  statusTextExpired: { color: '#FF3B30' },

  empty: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '700' },
  emptyText: { fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 18 },
})

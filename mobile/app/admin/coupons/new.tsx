import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
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

import { useAllPlacesLite, useCreatePlatformCoupon } from '../../../hooks/useCoupons'

const ORANGE = '#E8571A'
type Scope = 'all' | 'subset'
type Discount = 'none' | 'percentage' | 'amount'

export default function NewPlatformCoupon() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  const { data: places } = useAllPlacesLite()
  const create = useCreatePlatformCoupon()

  const [titleFr, setTitleFr] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [descFr, setDescFr] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [maxPerUser, setMaxPerUser] = useState('1')
  const [maxTotal, setMaxTotal] = useState('')
  const [discount, setDiscount] = useState<Discount>('percentage')
  const [discountValue, setDiscountValue] = useState('10')
  const [scope, setScope] = useState<Scope>('all')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [placeSearch, setPlaceSearch] = useState('')

  const filteredPlaces = useMemo(() => {
    const s = placeSearch.trim().toLowerCase()
    return (places ?? []).filter(p => !s || p.name.toLowerCase().includes(s))
  }, [places, placeSearch])

  const canSubmit = titleFr.trim()
    && expiresAt
    && (discount === 'none' || (parseInt(discountValue, 10) > 0))
    && (scope === 'all' || picked.size > 0)

  async function handleSubmit() {
    if (!canSubmit) return
    const exp = new Date(expiresAt + 'T23:59:59Z')
    if (Number.isNaN(exp.getTime()) || exp.getTime() < Date.now()) {
      Alert.alert(
        lang === 'fr' ? 'Date invalide' : 'Invalid date',
        lang === 'fr' ? 'Choisissez une date d\'expiration future.' : 'Pick a future expiration date.',
      )
      return
    }
    const perUser = Math.max(1, parseInt(maxPerUser, 10) || 1)
    const total = maxTotal.trim() === '' ? null : Math.max(1, parseInt(maxTotal, 10) || 1)

    let dtype: 'percentage' | 'amount' | null = null
    let dvalue: number | null = null
    if (discount !== 'none') {
      const v = parseInt(discountValue, 10)
      if (!Number.isFinite(v) || v <= 0) {
        Alert.alert(lang === 'fr' ? 'Valeur invalide' : 'Invalid value')
        return
      }
      if (discount === 'percentage' && v > 100) {
        Alert.alert(lang === 'fr' ? 'Pourcentage entre 1 et 100' : 'Percentage must be 1-100')
        return
      }
      dtype = discount
      dvalue = v
    }

    try {
      await create.mutateAsync({
        title_fr: titleFr.trim(),
        title_en: titleEn.trim() || null,
        description_fr: descFr.trim() || null,
        expires_at: exp.toISOString(),
        max_redemptions_per_user: perUser,
        max_total_redemptions: total,
        discount_type: dtype,
        discount_value: dvalue,
        is_active: true,
        scope_place_ids: scope === 'all' ? [] : Array.from(picked),
      })
      router.back()
    } catch (e: any) {
      Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', e?.message ?? 'Could not create')
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
        </Pressable>
        <Text style={styles.headerTitle}>
          {lang === 'fr' ? 'Nouveau coupon' : 'New coupon'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            {lang === 'fr'
              ? 'Coupon administrateur, valable dans tous les restaurants ou seulement ceux que vous choisissez. Aucun restaurateur ne peut le modifier.'
              : 'Admin-issued coupon, valid at every restaurant or only the ones you pick. Owners cannot edit it.'}
          </Text>

          {/* Titles */}
          <Field label={lang === 'fr' ? 'Titre (FR) *' : 'Title (FR) *'}>
            <TextInput
              value={titleFr}
              onChangeText={setTitleFr}
              placeholder={lang === 'fr' ? '-15% sur tous les restaurants pour les fêtes' : '-15% holiday promo at every restaurant'}
              placeholderTextColor="#A3A3A8"
              style={styles.input}
              maxLength={140}
            />
          </Field>

          <Field label={lang === 'fr' ? 'Titre (EN)' : 'Title (EN)'}>
            <TextInput
              value={titleEn}
              onChangeText={setTitleEn}
              placeholder="-15% holiday promo everywhere"
              placeholderTextColor="#A3A3A8"
              style={styles.input}
              maxLength={140}
            />
          </Field>

          <Field label={lang === 'fr' ? 'Détails' : 'Details'}>
            <TextInput
              value={descFr}
              onChangeText={setDescFr}
              placeholder={lang === 'fr' ? 'Conditions, montant minimum, etc.' : 'Conditions, minimum spend, etc.'}
              placeholderTextColor="#A3A3A8"
              style={[styles.input, styles.multiline]}
              multiline numberOfLines={3}
              maxLength={400}
            />
          </Field>

          {/* Expiry */}
          <Field label={lang === 'fr' ? 'Date d\'expiration (AAAA-MM-JJ) *' : 'Expires on (YYYY-MM-DD) *'}>
            <TextInput
              value={expiresAt}
              onChangeText={setExpiresAt}
              placeholder="2026-12-31"
              placeholderTextColor="#A3A3A8"
              style={styles.input}
              autoCapitalize="none"
            />
            <View style={styles.quickRow}>
              {[
                { label: '+1 ' + (lang === 'fr' ? 'sem.' : 'wk'), days: 7 },
                { label: '+1 ' + (lang === 'fr' ? 'mois' : 'mo'), days: 30 },
                { label: '+3 ' + (lang === 'fr' ? 'mois' : 'mo'), days: 90 },
              ].map(o => (
                <Pressable
                  key={o.label}
                  onPress={() => {
                    const d = new Date()
                    d.setDate(d.getDate() + o.days)
                    setExpiresAt(d.toISOString().slice(0, 10))
                  }}
                  style={styles.quickBtn}
                >
                  <Text style={styles.quickBtnText}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
          </Field>

          {/* Discount */}
          <Field label={lang === 'fr' ? 'Type de remise' : 'Discount type'}>
            <View style={styles.segmentRow}>
              {([
                { k: 'none' as const,        label: lang === 'fr' ? 'Aucune' : 'None' },
                { k: 'percentage' as const,  label: '%' },
                { k: 'amount' as const,      label: 'FCFA' },
              ]).map(o => {
                const active = discount === o.k
                return (
                  <Pressable
                    key={o.k}
                    onPress={() => setDiscount(o.k)}
                    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
                  </Pressable>
                )
              })}
            </View>
            {discount !== 'none' && (
              <TextInput
                value={discountValue}
                onChangeText={(t) => setDiscountValue(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder={discount === 'percentage' ? '15' : '2000'}
                placeholderTextColor="#A3A3A8"
                style={[styles.input, { marginTop: 8 }]}
              />
            )}
          </Field>

          {/* Quotas */}
          <Field label={lang === 'fr' ? 'Limite par client' : 'Per-customer limit'}>
            <TextInput
              value={maxPerUser}
              onChangeText={(t) => setMaxPerUser(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor="#A3A3A8"
              style={styles.input}
            />
          </Field>

          <Field label={lang === 'fr' ? 'Quota total' : 'Total quota'}>
            <TextInput
              value={maxTotal}
              onChangeText={(t) => setMaxTotal(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder={lang === 'fr' ? 'Laisser vide pour illimité' : 'Leave empty for unlimited'}
              placeholderTextColor="#A3A3A8"
              style={styles.input}
            />
          </Field>

          {/* Scope */}
          <Field label={lang === 'fr' ? 'Restaurants concernés' : 'Applies at'}>
            <View style={styles.segmentRow}>
              {([
                { k: 'all' as const,    label: lang === 'fr' ? 'Tous' : 'All' },
                { k: 'subset' as const, label: lang === 'fr' ? 'Sélection' : 'Selected' },
              ]).map(o => {
                const active = scope === o.k
                return (
                  <Pressable
                    key={o.k}
                    onPress={() => setScope(o.k)}
                    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
                  </Pressable>
                )
              })}
            </View>

            {scope === 'subset' && (
              <View style={{ marginTop: 10, gap: 8 }}>
                <View style={styles.searchWrap}>
                  <Ionicons name="search-outline" size={16} color="#8E8E93" />
                  <TextInput
                    value={placeSearch}
                    onChangeText={setPlaceSearch}
                    placeholder={lang === 'fr' ? 'Filtrer par nom' : 'Filter by name'}
                    placeholderTextColor="#A3A3A8"
                    style={styles.searchInput}
                  />
                </View>
                <Text style={styles.subText}>
                  {picked.size > 0
                    ? (lang === 'fr' ? `${picked.size} sélectionné${picked.size > 1 ? 's' : ''}` : `${picked.size} selected`)
                    : (lang === 'fr' ? 'Choisissez au moins un restaurant' : 'Pick at least one restaurant')}
                </Text>
                <View style={styles.placeList}>
                  {filteredPlaces.map(p => {
                    const on = picked.has(p.id)
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => setPicked(prev => {
                          const next = new Set(prev)
                          if (next.has(p.id)) next.delete(p.id); else next.add(p.id)
                          return next
                        })}
                        style={[styles.placeRow, on && styles.placeRowOn]}
                      >
                        <Text style={[styles.placeName, on && styles.placeNameOn]} numberOfLines={1}>
                          {p.name}
                        </Text>
                        {on && <Ionicons name="checkmark-circle" size={18} color={ORANGE} />}
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            )}
          </Field>

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit || create.isPending}
            style={[styles.submitBtn, (!canSubmit || create.isPending) && styles.submitBtnDisabled]}
          >
            {create.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitText}>{lang === 'fr' ? 'Publier' : 'Publish'}</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },

  scroll: { padding: 16, gap: 14, paddingBottom: 40 },
  intro: { fontSize: 13, color: '#6B6B70', lineHeight: 18 },

  label: { fontSize: 11, color: '#6B6B70', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  subText: { fontSize: 12, color: '#6B6B70' },

  input: {
    backgroundColor: '#F8F8FA',
    borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#1C1C1E',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E5EA',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },

  quickRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  quickBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F8F8FA' },
  quickBtnText: { fontSize: 12, fontWeight: '600', color: '#3C3C43' },

  segmentRow: { flexDirection: 'row', gap: 6 },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#F8F8FA',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E5EA',
  },
  segmentBtnActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#3C3C43' },
  segmentTextActive: { color: '#fff' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#F8F8FA',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E5EA',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1C1C1E', paddingVertical: 0 },

  // No maxHeight — the outer form ScrollView handles vertical scrolling.
  // A maxHeight on a plain View doesn't scroll; it just clips the layout
  // slot while the children spill into the next sibling (the Publish
  // button), producing the overlap we hit.
  placeList: { gap: 6 },
  placeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FAFAFA',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E5EA',
  },
  placeRowOn: { backgroundColor: 'rgba(232,87,26,0.06)', borderColor: 'rgba(232,87,26,0.4)' },
  placeName: { fontSize: 13, color: '#1C1C1E', fontWeight: '500' },
  placeNameOn: { color: ORANGE, fontWeight: '700' },

  submitBtn: {
    backgroundColor: ORANGE,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})

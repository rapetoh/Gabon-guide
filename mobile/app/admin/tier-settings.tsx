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
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { FEATURE_KEYS, FEATURE_LABELS, FeatureKey } from '../../lib/feature-keys'
import { useTierFeatures, useUpdateTierFeature } from '../../hooks/useTierFeatures'
import { useTierLimits, useUpdateTierLimit } from '../../hooks/useTierLimits'
import type { SubscriptionTier } from '../../lib/database.types'

const TIERS: SubscriptionTier[] = ['free', 'standard', 'premium']
const TIER_LABEL: Record<SubscriptionTier, { fr: string; en: string }> = {
  free:     { fr: 'Gratuit',  en: 'Free' },
  standard: { fr: 'Standard', en: 'Standard' },
  premium:  { fr: 'Premium',  en: 'Premium' },
}

export default function TierSettingsScreen() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  const { matrix, loading: featuresLoading } = useTierFeatures()
  const { limits, loading: limitsLoading } = useTierLimits()
  const updateFeature = useUpdateTierFeature()
  const updateLimit = useUpdateTierLimit()

  const [pending, setPending] = useState<string | null>(null)
  const [limitDrafts, setLimitDrafts] = useState<Partial<Record<SubscriptionTier, string>>>({})

  const toggleCell = async (feature: FeatureKey, tier: SubscriptionTier) => {
    const cellKey = `${feature}.${tier}`
    setPending(cellKey)
    try {
      await updateFeature.mutateAsync({ featureKey: feature, tier, enabled: !matrix[feature][tier] })
    } catch (e: any) {
      Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', e?.message ?? 'Could not update')
    } finally {
      setPending(null)
    }
  }

  const commitLimit = async (tier: SubscriptionTier) => {
    const draft = limitDrafts[tier]
    if (draft === undefined) return
    const value = Number(draft)
    if (!Number.isFinite(value) || value < 0) {
      Alert.alert(lang === 'fr' ? 'Valeur invalide' : 'Invalid value')
      setLimitDrafts(p => ({ ...p, [tier]: String(limits[tier].maxPhotos) }))
      return
    }
    if (value === limits[tier].maxPhotos) return
    try {
      await updateLimit.mutateAsync({ tier, maxPhotos: value })
    } catch (e: any) {
      Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', e?.message ?? 'Could not update')
    }
  }

  if (featuresLoading || limitsLoading) {
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
        <Text style={styles.intro}>
          {lang === 'fr'
            ? 'Activez/désactivez les fonctionnalités par palier. Les changements s’appliquent immédiatement sur l’app et le web.'
            : 'Toggle features per tier. Changes take effect immediately across mobile + web.'}
        </Text>

        {/* Feature matrix */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{lang === 'fr' ? 'Fonctionnalités' : 'Features'}</Text>
          </View>

          {/* Tier header row */}
          <View style={[styles.row, styles.rowHeader]}>
            <View style={styles.featureCol} />
            {TIERS.map(t => (
              <View key={t} style={styles.tierCol}>
                <Text style={styles.tierHeader} numberOfLines={1}>{TIER_LABEL[t][lang]}</Text>
              </View>
            ))}
          </View>

          {FEATURE_KEYS.map((feature, idx) => (
            <View key={feature} style={[styles.row, idx % 2 === 0 && styles.rowAlt]}>
              <View style={styles.featureCol}>
                <Text style={styles.featureLabel}>{FEATURE_LABELS[feature][lang]}</Text>
                <Text style={styles.featureKey}>{feature}</Text>
              </View>
              {TIERS.map(tier => {
                const cellKey = `${feature}.${tier}`
                const isOn = matrix[feature][tier]
                const isPending = pending === cellKey
                return (
                  <View key={tier} style={styles.tierCol}>
                    <Pressable
                      onPress={() => toggleCell(feature, tier)}
                      disabled={isPending}
                      style={[
                        styles.cell,
                        isOn ? styles.cellOn : styles.cellOff,
                        isPending && styles.cellPending,
                      ]}
                    >
                      {isPending ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : isOn ? (
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      ) : (
                        <View style={styles.dot} />
                      )}
                    </Pressable>
                  </View>
                )
              })}
            </View>
          ))}
        </View>

        {/* Photo limits */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{lang === 'fr' ? 'Limite de photos' : 'Photo limit'}</Text>
            <Text style={styles.cardHint}>
              {lang === 'fr' ? '9999 = illimité.' : '9999 = unlimited.'}
            </Text>
          </View>
          <View style={styles.limitsRow}>
            {TIERS.map(tier => {
              const draft = limitDrafts[tier] ?? String(limits[tier].maxPhotos)
              return (
                <View key={tier} style={styles.limitCol}>
                  <Text style={styles.limitLabel}>{TIER_LABEL[tier][lang]}</Text>
                  <TextInput
                    style={styles.limitInput}
                    keyboardType="number-pad"
                    value={draft}
                    onChangeText={v => setLimitDrafts(p => ({ ...p, [tier]: v }))}
                    onBlur={() => commitLimit(tier)}
                  />
                </View>
              )
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Header({ lang }: { lang: 'fr' | 'en' }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={22} color="#1C1C1E" />
      </Pressable>
      <Text style={styles.title}>{lang === 'fr' ? 'Paliers' : 'Tier settings'}</Text>
      <View style={{ width: 40 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },

  scroll: { padding: 16, gap: 16 },
  intro: { fontSize: 13, color: '#6B6B70', lineHeight: 18 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    backgroundColor: '#FAFAFA',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  cardHint: { fontSize: 11, color: '#8E8E93', marginTop: 2 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowHeader: { backgroundColor: '#FAFAFA' },
  rowAlt: { backgroundColor: '#FCFCFD' },

  featureCol: { flex: 1, paddingRight: 8 },
  featureLabel: { fontSize: 13, color: '#1C1C1E', fontWeight: '500' },
  featureKey: { fontSize: 10, color: '#A3A3A8', marginTop: 1 },

  tierCol: { width: 76, alignItems: 'center' },
  tierHeader: { fontSize: 10, color: '#6B6B70', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  cell: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  cellOn:  { backgroundColor: '#E8571A' },
  cellOff: { backgroundColor: '#E5E5EA' },
  cellPending: { opacity: 0.6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#A3A3A8' },

  limitsRow: { flexDirection: 'row', padding: 12, gap: 12 },
  limitCol: { flex: 1 },
  limitLabel: { fontSize: 11, color: '#6B6B70', fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  limitInput: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E5EA',
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#1C1C1E',
  },
})

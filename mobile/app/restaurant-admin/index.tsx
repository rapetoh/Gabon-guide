import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'

import { useSession } from '../../hooks/useSession'
import { usePlaceTier } from '../../hooks/usePlaceTier'
import { useThemeColors } from '../../contexts/ThemeContext'
import { supabase } from '../../lib/supabase'
import { LockedFeatureCard } from '../../components/restaurant-admin/LockedFeatureCard'
import type { SubscriptionTier } from '../../lib/database.types'

interface OwnedPlace {
  id: string
  name: string
  is_active: boolean
  subscription_tier: SubscriptionTier
  subscription_expires_at: string | null
  categories: { name_fr: string; name_en: string } | null
  zones: { name: string } | null
  photos: { id: string; storage_path: string; is_primary: boolean; is_deleted: boolean; is_menu: boolean }[]
}

function useOwnedPlace(userId: string | undefined) {
  return useQuery({
    queryKey: ['owned-place', userId],
    queryFn: async () => {
      if (!userId) return null
      const { data } = await supabase
        .from('places')
        .select(`
          id, name, is_active, subscription_tier, subscription_expires_at,
          categories ( name_fr, name_en ),
          zones ( name ),
          photos ( id, storage_path, is_primary, is_deleted, is_menu )
        `)
        .eq('owner_id', userId)
        .eq('is_deleted', false)
        .single()
      return data as unknown as OwnedPlace | null
    },
    enabled: !!userId,
  })
}

const TIER_LABEL: Record<SubscriptionTier, { fr: string; en: string }> = {
  free:     { fr: 'Gratuit',  en: 'Free' },
  standard: { fr: 'Standard', en: 'Standard' },
  premium:  { fr: 'Premium',  en: 'Premium' },
}

const TIER_GRADIENT_COLORS: Record<SubscriptionTier, { bg: string; fg: string }> = {
  free:     { bg: 'rgba(142,142,147,0.15)', fg: '#6B6B70' },
  standard: { bg: 'rgba(10,132,255,0.12)',  fg: '#0A84FF' },
  premium:  { bg: 'rgba(255,159,10,0.18)',  fg: '#E8571A' },
}

export default function RestaurantAdminDashboard() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const colors = useThemeColors()
  const { session } = useSession()
  const { data: place, isLoading } = useOwnedPlace(session?.user.id)
  const tier = usePlaceTier(place)

  const primaryPhoto = place?.photos
    ?.filter(p => !p.is_deleted && !p.is_menu)
    ?.find(p => p.is_primary)
    ?? place?.photos?.filter(p => !p.is_deleted && !p.is_menu)?.[0]

  const photoUrl = primaryPhoto
    ? supabase.storage.from('place-photos').getPublicUrl(primaryPhoto.storage_path).data.publicUrl
    : null

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (!place) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {lang === 'fr' ? 'Mon restaurant' : 'My Restaurant'}
        </Text>
        <View style={styles.center}>
          <Ionicons name="storefront-outline" size={48} color={colors.iconMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {lang === 'fr'
              ? 'Aucun restaurant associé à votre compte.'
              : 'No restaurant linked to your account.'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const tierStyle = TIER_GRADIENT_COLORS[tier.tier]

  // Expiry hint — only shown for paid tiers with an upcoming expiry
  let expiresHint: string | null = null
  if (tier.tier !== 'free' && tier.expiresAt) {
    const expDate = new Date(tier.expiresAt)
    const daysLeft = Math.round((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (tier.isExpired) {
      expiresHint = lang === 'fr' ? 'Abonnement expiré' : 'Subscription expired'
    } else if (daysLeft <= 30) {
      expiresHint = lang === 'fr' ? `Expire dans ${daysLeft}j` : `Expires in ${daysLeft}d`
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {lang === 'fr' ? 'Mon restaurant' : 'My Restaurant'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32, gap: 16 }}>
        {/* Place card */}
        <View style={[styles.placeCard, { backgroundColor: colors.surfaceElevated }]}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.placePhoto} contentFit="cover" />
          ) : (
            <View style={[styles.placePhoto, styles.placePhotoFallback]}>
              <Ionicons name="image-outline" size={32} color={colors.iconMuted} />
            </View>
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.placeName, { color: colors.textPrimary }]}>{place.name}</Text>
            <Text style={[styles.placeMeta, { color: colors.textSecondary }]}>
              {place.categories
                ? (lang === 'fr' ? place.categories.name_fr : place.categories.name_en)
                : ''}
              {place.zones ? ` · ${place.zones.name}` : ''}
            </Text>
            <View style={[styles.statusBadge, place.is_active ? styles.statusActive : styles.statusInactive]}>
              <Text style={[styles.statusText, place.is_active ? styles.statusTextActive : styles.statusTextInactive]}>
                {place.is_active
                  ? (lang === 'fr' ? 'Actif' : 'Active')
                  : (lang === 'fr' ? 'Inactif' : 'Inactive')}
              </Text>
            </View>
          </View>
        </View>

        {/* Tier card */}
        <View style={[styles.tierCard, { backgroundColor: tierStyle.bg }]}>
          <Ionicons
            name={tier.tier === 'premium' ? 'diamond' : tier.tier === 'standard' ? 'star' : 'leaf-outline'}
            size={20}
            color={tierStyle.fg}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.tierLabel, { color: tierStyle.fg }]}>
              {lang === 'fr' ? `Pack ${TIER_LABEL[tier.tier].fr}` : `${TIER_LABEL[tier.tier].en} pack`}
            </Text>
            {expiresHint && (
              <Text style={[styles.tierHint, { color: tierStyle.fg }]}>{expiresHint}</Text>
            )}
          </View>
        </View>

        {/* Real (unlocked) actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {lang === 'fr' ? 'Disponible' : 'Available'}
          </Text>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.surfaceElevated }]}
            onPress={() => router.push({ pathname: '/restaurant-admin/edit', params: { id: place.id } } as any)}
          >
            <Ionicons name="create-outline" size={22} color="#E8571A" />
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>
              {lang === 'fr' ? 'Modifier les infos' : 'Edit info'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} />
          </Pressable>

          {/* Reviews & replies — open to all tiers */}
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.surfaceElevated }]}
            onPress={() => router.push('/restaurant-admin/reviews' as any)}
          >
            <Ionicons name="chatbubbles-outline" size={22} color="#E8571A" />
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>
              {lang === 'fr' ? 'Avis & réponses' : 'Reviews & replies'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} />
          </Pressable>

          {/* Coupons & promos — Standard+ */}
          {tier.can('coupons_create') && (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.surfaceElevated }]}
              onPress={() => router.push('/restaurant-admin/coupons' as any)}
            >
              <Ionicons name="ticket-outline" size={22} color="#E8571A" />
              <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>
                {lang === 'fr' ? 'Coupons & promos' : 'Coupons & promos'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} />
            </Pressable>
          )}

          {/* History — open to all tiers, shows redemptions at this place */}
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.surfaceElevated }]}
            onPress={() => router.push('/restaurant-admin/history' as any)}
          >
            <Ionicons name="receipt-outline" size={22} color="#E8571A" />
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>
              {lang === 'fr' ? 'Historique' : 'History'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} />
          </Pressable>
        </View>

        {/* Locked features above the owner's tier */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {lang === 'fr' ? 'À débloquer' : 'Unlock more'}
          </Text>

          {!tier.can('coupons_create') && (
            <LockedFeatureCard
              title={lang === 'fr' ? 'Coupons & promos' : 'Coupons & promos'}
              description={lang === 'fr' ? 'Offrez des remises pour attirer plus de clients' : 'Offer discounts to attract more customers'}
              unlocksAt="standard"
              icon="ticket-outline"
            />
          )}

          {!tier.can('views_stat') && (
            <LockedFeatureCard
              title={lang === 'fr' ? 'Statistiques' : 'Statistics'}
              description={lang === 'fr' ? 'Combien de personnes consultent votre fiche' : 'See how many people view your listing'}
              unlocksAt="standard"
              icon="analytics-outline"
            />
          )}

          {!tier.can('competition_trends') && (
            <LockedFeatureCard
              title={lang === 'fr' ? 'Tendances du marché' : 'Market trends'}
              description={lang === 'fr' ? 'Voyez ce que cherchent les utilisateurs à Libreville' : 'Discover what users are searching for in Libreville'}
              unlocksAt="premium"
              icon="trending-up-outline"
            />
          )}

          {!tier.can('trending_eligible') && (
            <LockedFeatureCard
              title={lang === 'fr' ? 'Mise en avant' : 'Featured placement'}
              description={lang === 'fr' ? 'Apparaissez en premier dans la section "À la une"' : 'Show up first in the Trending section'}
              unlocksAt="premium"
              icon="rocket-outline"
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 260,
  },
  placeCard: {
    flexDirection: 'row',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  placePhoto: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  placePhotoFallback: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeName: {
    fontSize: 17,
    fontWeight: '700',
  },
  placeMeta: {
    fontSize: 13,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 2,
  },
  statusActive: { backgroundColor: 'rgba(52,199,89,0.12)' },
  statusInactive: { backgroundColor: 'rgba(255,59,48,0.1)' },
  statusText: { fontSize: 12, fontWeight: '600' },
  statusTextActive: { color: '#34C759' },
  statusTextInactive: { color: '#FF3B30' },

  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
  },
  tierLabel: { fontSize: 14, fontWeight: '700' },
  tierHint:  { fontSize: 11, fontWeight: '500', marginTop: 2, opacity: 0.85 },

  section: { gap: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 4,
    marginBottom: 2,
  },

  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
  },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  actionHint: {
    fontSize: 12,
    marginTop: 2,
  },
})

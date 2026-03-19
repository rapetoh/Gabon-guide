import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Dimensions,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'

import AppBackground from '../../components/AppBackground'
import { isOpenNow } from '../../utils/isOpenNow'
import { getDistanceKm, NEARBY_RADIUS_KM } from '../../utils/distance'
import { useTrendingPlaces } from '../../hooks/useTrendingPlaces'
import { usePlaces } from '../../hooks/usePlaces'
import { useCategories } from '../../hooks/useCategories'
import { useZones } from '../../hooks/useZones'
import { useSession } from '../../hooks/useSession'
import { supabase } from '../../lib/supabase'

const { width } = Dimensions.get('window')
const TRENDING_CARD_WIDTH = 240
const NEW_CARD_WIDTH = 180

function photoUrl(storagePath: string) {
  return supabase.storage.from('place-photos').getPublicUrl(storagePath).data.publicUrl
}

// matchName must equal the category's name_en in the DB
const CATEGORIES = [
  { matchName: 'Restaurant', labelFr: 'Restaurants', labelEn: 'Restaurants', icon: 'restaurant-outline' as const, bg: 'rgba(255,149,0,0.1)',   color: '#FF9500' },
  { matchName: 'Nightlife',  labelFr: 'Nightlife',   labelEn: 'Nightlife',   icon: 'wine-outline'       as const, bg: 'rgba(175,82,222,0.1)',  color: '#AF52DE' },
  { matchName: 'Activities', labelFr: 'Activités',   labelEn: 'Activities',  icon: 'ticket-outline'     as const, bg: 'rgba(52,199,89,0.1)',   color: '#34C759' },
]

export default function HomeScreen() {
  const { i18n } = useTranslation()
  const { session } = useSession()
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  const { data: trendingPlaces, isLoading: trendingLoading } = useTrendingPlaces()
  const { data: placesData, isLoading: placesLoading } = usePlaces()
  const { data: categories } = useCategories()
  const { data: zones } = useZones()

  // Nearby section — check location permission silently on mount (no popup)
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined')

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      setLocationPermission(status as any)
      if (status === 'granted') {
        Location.getCurrentPositionAsync({}).then(loc => {
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
        }).catch(() => {})
      }
    })
  }, [])

  async function requestLocationForNearby() {
    const { status } = await Location.requestForegroundPermissionsAsync()
    setLocationPermission(status as any)
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({})
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
    }
  }

  const allPlaces = placesData?.pages?.flat() ?? []

  // Places within NEARBY_RADIUS_KM of the user, sorted by distance ascending
  const nearbyPlaces = userLocation
    ? allPlaces
        .filter((p: any) => p.latitude && p.longitude)
        .map((p: any) => ({
          ...p,
          _distKm: getDistanceKm(userLocation.latitude, userLocation.longitude, p.latitude, p.longitude),
        }))
        .filter((p: any) => p._distKm <= NEARBY_RADIUS_KM)
        .sort((a: any, b: any) => a._distKm - b._distKm)
        .slice(0, 8)
    : []

  const newPlaces = allPlaces.slice(0, 6)

  return (
    <AppBackground>

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.appName}>O'KILI</Text>
              <Text style={styles.subtitle}>
                {lang === 'fr' ? 'Guide de Libreville' : 'Libreville city guide'}
              </Text>
            </View>
            <Pressable
              style={styles.avatar}
              onPress={() => session ? router.push('/(tabs)/profile') : router.push('/auth/login')}
            >
              <Ionicons name="person" size={20} color="#666" />
            </Pressable>
          </View>

          {/* Search */}
          <Pressable style={styles.searchBar} onPress={() => router.push('/(tabs)/explore')}>
            <Ionicons name="search-outline" size={20} color="#666" />
            <Text style={styles.searchPlaceholder}>
              {lang === 'fr' ? 'Restaurants, bars, activités...' : 'Restaurants, bars, activities...'}
            </Text>
          </Pressable>

          {/* Trending Now — promoted partners first, then top-rated */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>
              {lang === 'fr' ? 'Tendances' : 'Trending Now'}
            </Text>
            <Pressable onPress={() => router.push('/(tabs)/explore')}>
              <Text style={styles.seeAll}>{lang === 'fr' ? 'Voir tout' : 'See All'}</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hScroll}
          >
            {trendingLoading ? (
              <View style={[styles.trendingCard, styles.loadingCard]}>
                <ActivityIndicator color="#007AFF" />
              </View>
            ) : (trendingPlaces ?? []).length === 0 ? (
              <View style={[styles.trendingCard, styles.emptyCard]}>
                <Ionicons name="trending-up-outline" size={32} color="rgba(0,0,0,0.2)" />
                <Text style={styles.emptyText}>
                  {lang === 'fr' ? 'Bientôt disponible' : 'Coming soon'}
                </Text>
              </View>
            ) : (
              (trendingPlaces ?? []).map((place: any) => {
                const photo = place.photos?.find((p: any) => p.is_primary) ?? place.photos?.[0]
                const catName = lang === 'fr' ? place.categories?.name_fr : place.categories?.name_en
                const promotedLabel = place.is_promoted
                  ? (lang === 'fr'
                      ? (place.promoted_label_fr || 'Promu')
                      : (place.promoted_label_en || 'Promoted'))
                  : null
                return (
                  <Pressable
                    key={place.id}
                    style={styles.trendingCard}
                    onPress={() => router.push(`/place/${place.id}`)}
                  >
                    {photo
                      ? <Image source={{ uri: photoUrl(photo.storage_path) }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      : <View style={[StyleSheet.absoluteFill, styles.photoFallback]} />
                    }
                    {/* Promoted badge — top-right corner on the photo */}
                    {promotedLabel && (
                      <View style={styles.promotedBadgePhoto}>
                        <Text style={styles.promotedBadgePhotoText}>{promotedLabel}</Text>
                      </View>
                    )}
                    <View style={styles.trendingOverlay}>
                      <View style={styles.trendingNameRow}>
                        <Text style={[styles.trendingName, { flex: 1 }]} numberOfLines={1}>{place.name}</Text>
                        {place.hours && (() => {
                          const open = isOpenNow(place.hours)
                          return (
                            <View style={[styles.openBadge, open ? styles.openBadgeOpen : styles.openBadgeClosed]}>
                              <Text style={[styles.openBadgeText, open ? styles.openBadgeTextOpen : styles.openBadgeTextClosed]}>
                                {open ? (lang === 'fr' ? 'Ouvert' : 'Open') : (lang === 'fr' ? 'Fermé' : 'Closed')}
                              </Text>
                            </View>
                          )
                        })()}
                      </View>
                      <View style={styles.trendingMeta}>
                        {!place.is_promoted && place._avgRating ? (
                          <View style={styles.ratingBadge}>
                            <Text style={styles.ratingText}>{place._avgRating.toFixed(1)}</Text>
                            <Ionicons name="star" size={8} color="#fff" />
                          </View>
                        ) : null}
                        <Text style={styles.trendingMetaText} numberOfLines={1}>
                          {place.zones?.name ?? ''}{catName ? ` · ${catName}` : ''}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                )
              })
            )}
          </ScrollView>

          {/* Nearby section */}
          {locationPermission !== 'denied' && (
            <>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>
                  {lang === 'fr' ? 'Près de vous' : 'Near You'}
                </Text>
                {nearbyPlaces.length > 0 && (
                  <Pressable onPress={() => router.push({ pathname: '/(tabs)/explore', params: { nearMe: '1' } })}>
                    <Text style={styles.seeAll}>{lang === 'fr' ? 'Voir tout' : 'See All'}</Text>
                  </Pressable>
                )}
              </View>

              {locationPermission === 'undetermined' || (locationPermission === 'granted' && !userLocation) ? (
                // Permission not yet asked or location loading
                <Pressable style={styles.nearbyPrompt} onPress={requestLocationForNearby}>
                  <View style={styles.nearbyPromptIcon}>
                    <Ionicons name="location-outline" size={22} color="#E8571A" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.nearbyPromptTitle}>
                      {lang === 'fr' ? 'Activer la localisation' : 'Enable location'}
                    </Text>
                    <Text style={styles.nearbyPromptSub}>
                      {lang === 'fr'
                        ? 'Découvrez les lieux à moins de 3 km de vous'
                        : 'Discover places within 3 km of you'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
                </Pressable>
              ) : nearbyPlaces.length === 0 ? (
                // Location granted but nothing within 3km
                <View style={styles.nearbyEmpty}>
                  <Ionicons name="location-outline" size={20} color="rgba(0,0,0,0.2)" />
                  <Text style={styles.nearbyEmptyText}>
                    {lang === 'fr'
                      ? 'Aucun lieu dans un rayon de 3 km'
                      : 'No places within 3 km'}
                  </Text>
                </View>
              ) : (
                // Show nearby cards
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hScroll}
                >
                  {nearbyPlaces.map((place: any) => {
                    const photo = place.photos?.find((p: any) => p.is_primary) ?? place.photos?.[0]
                    const catName = lang === 'fr' ? place.categories?.name_fr : place.categories?.name_en
                    const dist = place._distKm < 1
                      ? `${Math.round(place._distKm * 1000)} m`
                      : `${place._distKm.toFixed(1)} km`
                    return (
                      <Pressable
                        key={place.id}
                        style={styles.nearbyCard}
                        onPress={() => router.push(`/place/${place.id}`)}
                      >
                        {photo
                          ? <Image source={{ uri: photoUrl(photo.storage_path) }} style={StyleSheet.absoluteFill} contentFit="cover" />
                          : <View style={[StyleSheet.absoluteFill, styles.photoFallback]} />
                        }
                        <View style={styles.nearbyOverlay}>
                          <View style={styles.distBadge}>
                            <Ionicons name="navigate" size={9} color="#007AFF" />
                            <Text style={styles.distBadgeText}>{dist}</Text>
                          </View>
                          <Text style={styles.nearbyName} numberOfLines={1}>{place.name}</Text>
                          <Text style={styles.nearbyMeta} numberOfLines={1}>
                            {place.zones?.name ?? ''}{catName ? ` · ${catName}` : ''}
                          </Text>
                        </View>
                      </Pressable>
                    )
                  })}
                </ScrollView>
              )}
            </>
          )}

          {/* Categories */}
          <Text style={styles.sectionTitle}>
            {lang === 'fr' ? 'Catégories' : 'Categories'}
          </Text>
          <View style={styles.categoriesGrid}>
            {CATEGORIES.map((cat) => {
              const dbCat = categories?.find(c => c.name_en === cat.matchName)
              return (
              <Pressable
                key={cat.matchName}
                style={styles.categoryCard}
                onPress={() => router.push({ pathname: '/(tabs)/explore', params: dbCat ? { categoryId: dbCat.id } : {} })}
              >
                <View style={[styles.categoryIconBg, { backgroundColor: cat.bg }]}>
                  <Ionicons name={cat.icon} size={24} color={cat.color} />
                </View>
                <Text style={styles.categoryLabel}>
                  {lang === 'fr' ? cat.labelFr : cat.labelEn}
                </Text>
              </Pressable>
            )})}
          </View>

          {/* Explore by Area */}
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
            {lang === 'fr' ? 'Explorer par zone' : 'Explore by Area'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hScroll}
          >
            {(zones ?? []).map((zone: any) => (
              <Pressable
                key={zone.id}
                style={styles.areaChip}
                onPress={() => router.push({ pathname: '/(tabs)/explore', params: { zoneId: zone.id } })}
              >
                <Text style={styles.areaChipText}>{zone.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* New in Town */}
          <View style={[styles.sectionRow, { marginTop: 24 }]}>
            <Text style={styles.sectionTitle}>
              {lang === 'fr' ? 'Nouveautés' : 'New in Town'}
            </Text>
            <Pressable onPress={() => router.push('/(tabs)/explore')}>
              <Text style={styles.seeAll}>{lang === 'fr' ? 'Voir tout' : 'See All'}</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hScroll}
          >
            {placesLoading ? (
              <View style={[styles.newCard, styles.loadingCard]}>
                <ActivityIndicator color="#007AFF" />
              </View>
            ) : newPlaces.length === 0 ? (
              <View style={[styles.newCard, styles.emptyCard]}>
                <Text style={styles.emptyText}>
                  {lang === 'fr' ? 'Aucun lieu pour l\'instant' : 'No places yet'}
                </Text>
              </View>
            ) : (
              newPlaces.map((place: any) => {
                const photo = place.photos?.find((p: any) => p.is_primary) ?? place.photos?.[0]
                const catName = lang === 'fr' ? place.categories?.name_fr : place.categories?.name_en
                return (
                  <Pressable
                    key={place.id}
                    style={styles.newCard}
                    onPress={() => router.push(`/place/${place.id}`)}
                  >
                    {photo
                      ? <Image source={{ uri: photoUrl(photo.storage_path) }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      : <View style={[StyleSheet.absoluteFill, styles.photoFallback]} />
                    }
                    <View style={styles.newOverlay}>
                      <Text style={styles.newName} numberOfLines={1}>{place.name}</Text>
                      <Text style={styles.newMeta} numberOfLines={1}>
                        {place.zones?.name ?? ''}{catName ? ` · ${catName}` : ''}
                      </Text>
                    </View>
                  </Pressable>
                )
              })
            )}
          </ScrollView>

          <View style={{ height: 110 }} />
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { paddingTop: 10 },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginTop: 2,
  },
  avatar: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 32,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 16,
    shadowColor: 'rgba(31,38,135,0.07)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 32,
  },
  searchPlaceholder: {
    fontSize: 16,
    color: 'rgba(60,60,67,0.6)',
  },
  // Section
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: 20,
  },
  seeAll: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginBottom: 16,
  },
  // Categories
  categoriesGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 32,
  },
  categoryCard: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    gap: 10,
    shadowColor: 'rgba(31,38,135,0.07)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 32,
  },
  categoryIconBg: {
    width: 48, height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  // Horizontal scroll
  hScroll: {
    paddingHorizontal: 20,
    gap: 16,
    paddingBottom: 20,
  },
  // Trending cards
  trendingCard: {
    width: TRENDING_CARD_WIDTH,
    height: 300,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
  },
  photoFallback: {
    backgroundColor: 'rgba(200,200,210,0.5)',
  },
  trendingOverlay: {
    position: 'absolute',
    bottom: 12, left: 12, right: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    padding: 14,
  },
  trendingName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  trendingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  promotedBadgePhoto: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  promotedBadgePhotoText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF9500',
  },
  trendingMetaText: {
    fontSize: 13,
    color: '#555',
    flex: 1,
  },
  // Nearby section
  nearbyPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 28,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  nearbyPromptIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(232,87,26,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  nearbyPromptTitle: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  nearbyPromptSub: { fontSize: 12, color: '#8E8E93' },
  nearbyEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 28,
  },
  nearbyEmptyText: { fontSize: 13, color: 'rgba(0,0,0,0.3)' },
  nearbyCard: {
    width: 160,
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#E5E5EA',
  },
  nearbyOverlay: {
    position: 'absolute',
    bottom: 8, left: 8, right: 8,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 12,
    padding: 9,
    gap: 2,
  },
  distBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,122,255,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  distBadgeText: { fontSize: 10, fontWeight: '700', color: '#007AFF' },
  nearbyName: { fontSize: 13, fontWeight: '700', color: '#000' },
  nearbyMeta: { fontSize: 11, color: '#555' },
  // Area chips
  areaChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
  },
  areaChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  // New in Town cards
  newCard: {
    width: NEW_CARD_WIDTH,
    height: 220,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
  },
  newOverlay: {
    position: 'absolute',
    bottom: 8, left: 8, right: 8,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    padding: 10,
  },
  newName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  newMeta: {
    fontSize: 11,
    color: '#555',
    marginTop: 2,
  },
  // Loading / empty
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(0,0,0,0.3)',
  },
  trendingNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  openBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  openBadgeOpen:        { backgroundColor: 'rgba(52,199,89,0.15)' },
  openBadgeClosed:      { backgroundColor: 'rgba(255,59,48,0.12)' },
  openBadgeText:        { fontSize: 10, fontWeight: '700' },
  openBadgeTextOpen:    { color: '#34C759' },
  openBadgeTextClosed:  { color: '#FF3B30' },
})

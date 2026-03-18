import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
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
import { useWeeklyFeed } from '../../hooks/useWeeklyFeed'
import { usePlaces } from '../../hooks/usePlaces'
import { useZones } from '../../hooks/useZones'
import { useSession } from '../../hooks/useSession'
import { supabase } from '../../lib/supabase'

const { width } = Dimensions.get('window')
const TRENDING_CARD_WIDTH = 240
const NEW_CARD_WIDTH = 180

function photoUrl(storagePath: string) {
  return supabase.storage.from('place-photos').getPublicUrl(storagePath).data.publicUrl
}

const CATEGORIES = [
  { key: 'dining',     labelFr: 'Dining',     labelEn: 'Dining',      icon: 'restaurant-outline' as const, bg: 'rgba(255,149,0,0.1)',   color: '#FF9500' },
  { key: 'nightlife',  labelFr: 'Nightlife',  labelEn: 'Nightlife',   icon: 'wine-outline'       as const, bg: 'rgba(175,82,222,0.1)',  color: '#AF52DE' },
  { key: 'activities', labelFr: 'Activités',  labelEn: 'Activities',  icon: 'ticket-outline'     as const, bg: 'rgba(52,199,89,0.1)',   color: '#34C759' },
] as const

export default function HomeScreen() {
  const { i18n } = useTranslation()
  const { session } = useSession()
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  const { data: feed, isLoading: feedLoading } = useWeeklyFeed()
  const { data: placesData, isLoading: placesLoading } = usePlaces()
  const { data: zones } = useZones()

  const trendingItems = feed?.entries?.slice(0, 6) ?? []
  const newPlaces = placesData?.pages?.[0]?.slice(0, 6) ?? []

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

          {/* Categories */}
          <Text style={styles.sectionTitle}>
            {lang === 'fr' ? 'Catégories' : 'Categories'}
          </Text>
          <View style={styles.categoriesGrid}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.key}
                style={styles.categoryCard}
                onPress={() => router.push('/(tabs)/explore')}
              >
                <View style={[styles.categoryIconBg, { backgroundColor: cat.bg }]}>
                  <Ionicons name={cat.icon} size={24} color={cat.color} />
                </View>
                <Text style={styles.categoryLabel}>
                  {lang === 'fr' ? cat.labelFr : cat.labelEn}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Trending Now */}
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
            {feedLoading ? (
              <View style={[styles.trendingCard, styles.loadingCard]}>
                <ActivityIndicator color="#007AFF" />
              </View>
            ) : trendingItems.length === 0 ? (
              <View style={[styles.trendingCard, styles.emptyCard]}>
                <Ionicons name="compass-outline" size={32} color="rgba(0,0,0,0.2)" />
                <Text style={styles.emptyText}>
                  {lang === 'fr' ? 'Bientôt disponible' : 'Coming soon'}
                </Text>
              </View>
            ) : (
              trendingItems.map((item: any) => {
                const place = item.places ?? item
                const photo = place.photos?.find((p: any) => p.is_primary) ?? place.photos?.[0]
                const catName = lang === 'fr' ? place.categories?.name_fr : place.categories?.name_en
                return (
                  <Pressable
                    key={item.id}
                    style={styles.trendingCard}
                    onPress={() => router.push(`/place/${place.id}`)}
                  >
                    {photo
                      ? <Image source={{ uri: photoUrl(photo.storage_path) }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      : <View style={[StyleSheet.absoluteFill, styles.photoFallback]} />
                    }
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
                        {place.rating && (
                          <View style={styles.ratingBadge}>
                            <Text style={styles.ratingText}>{place.rating}</Text>
                            <Ionicons name="star" size={8} color="#fff" />
                          </View>
                        )}
                        <Text style={styles.trendingMetaText} numberOfLines={1}>
                          {place.zones?.name ?? ''}
                          {catName ? ` · ${catName}` : ''}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                )
              })
            )}
          </ScrollView>

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
                onPress={() => router.push('/(tabs)/explore')}
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
  trendingMetaText: {
    fontSize: 13,
    color: '#555',
    flex: 1,
  },
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

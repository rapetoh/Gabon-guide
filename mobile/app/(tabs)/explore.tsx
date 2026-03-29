import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { router, useLocalSearchParams } from 'expo-router'
import AppBackground from '../../components/AppBackground'
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'

import { useCategories } from '../../hooks/useCategories'
import { usePlaces, PlaceFilters } from '../../hooks/usePlaces'
import { useZones } from '../../hooks/useZones'
import { useAnalytics } from '../../hooks/useAnalytics'
import { supabase } from '../../lib/supabase'
import { isOpenNow } from '../../utils/isOpenNow'
import { getDistanceKm } from '../../utils/distance'
import { useThemeColors } from '../../contexts/ThemeContext'
import { ThemeColors } from '../../constants/themes'

function photoUrl(path: string) {
  return supabase.storage.from('place-photos').getPublicUrl(path).data.publicUrl
}

const PRICE_LABELS: Record<string, { fr: string; en: string }> = {
  '1': { fr: 'Éco',    en: 'Budget' },
  '2': { fr: 'Moyen',  en: 'Mid'    },
  '3': { fr: 'Haut',   en: 'Upscale'},
}

export default function ExploreScreen() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const colors = useThemeColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  // Params passed from Home screen when tapping a category or zone shortcut
  const { categoryId: paramCategoryId, zoneId: paramZoneId } = useLocalSearchParams<{
    categoryId?: string
    zoneId?: string
  }>()

  const analytics = useAnalytics()

  const [search, setSearch]           = useState('')
  const [filters, setFilters]         = useState<PlaceFilters>({})
  const [activePrice, setActivePrice] = useState<1|2|3|null>(null)
  const [openNow, setOpenNow]         = useState(false)
  const [nearMe, setNearMe]           = useState(false)
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)

  const { data: categories } = useCategories()
  const { data: zones }      = useZones()

  // Apply filters passed from Home screen shortcuts
  useEffect(() => {
    if (paramCategoryId) setFilters(f => ({ ...f, categoryId: paramCategoryId }))
    if (paramZoneId)     setFilters(f => ({ ...f, zoneId: paramZoneId }))
  }, [paramCategoryId, paramZoneId])
  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = usePlaces(filters)

  const places = data?.pages.flat() ?? []

  const filtered = places
    .filter(p => !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()))
    .filter(p => !openNow || isOpenNow((p as any).hours))
    .map(p => {
      if (!nearMe || !userLocation || !(p as any).latitude || !(p as any).longitude) return { place: p, dist: null }
      const dist = getDistanceKm(userLocation.latitude, userLocation.longitude, (p as any).latitude, (p as any).longitude)
      return { place: p, dist }
    })
    .sort((a, b) => {
      if (!nearMe || a.dist === null || b.dist === null) return 0
      return a.dist - b.dist
    })
    .map(({ place, dist }) => ({ ...place, _distKm: dist }))

  function toggleCategory(id: string) {
    const next = filters.categoryId === id ? undefined : id
    setFilters(f => ({ ...f, categoryId: next }))
    analytics.filterUsed({ category: next, zone: filters.zoneId, price: activePrice ?? undefined, openNow, nearMe })
  }

  function toggleZone(id: string) {
    const next = filters.zoneId === id ? undefined : id
    setFilters(f => ({ ...f, zoneId: next }))
    analytics.filterUsed({ category: filters.categoryId, zone: next, price: activePrice ?? undefined, openNow, nearMe })
  }

  function togglePrice(p: 1|2|3) {
    const next = activePrice === p ? null : p
    setActivePrice(next)
    setFilters(f => ({ ...f, priceRange: next ?? undefined }))
    analytics.filterUsed({ category: filters.categoryId, zone: filters.zoneId, price: next ?? undefined, openNow, nearMe })
  }

  async function toggleNearMe() {
    if (nearMe) {
      setNearMe(false)
      setUserLocation(null)
      analytics.filterUsed({ category: filters.categoryId, zone: filters.zoneId, price: activePrice ?? undefined, openNow, nearMe: false })
      return
    }
    setLocationLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') { setLocationLoading(false); return }
      const loc = await Location.getCurrentPositionAsync({})
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
      setNearMe(true)
      analytics.filterUsed({ category: filters.categoryId, zone: filters.zoneId, price: activePrice ?? undefined, openNow, nearMe: true })
    } finally {
      setLocationLoading(false)
    }
  }

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Fixed header */}
        <View style={styles.header}>
          <Text style={styles.title}>{lang === 'fr' ? 'Explorer' : 'Explore'}</Text>

          {/* Search */}
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('explore.searchPlaceholder')}
              placeholderTextColor={colors.textPlaceholder}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>

          {/* Filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsContent}>
            <Pressable
              style={[styles.chip, openNow && styles.chipActive]}
              onPress={() => setOpenNow(o => !o)}
            >
              <Ionicons name="time-outline" size={12} color={openNow ? '#fff' : colors.textSecondary} />
              <Text style={[styles.chipText, openNow && styles.chipTextActive]}>
                {lang === 'fr' ? 'Ouvert maintenant' : 'Open now'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.chip, nearMe && styles.chipActive]}
              onPress={toggleNearMe}
              disabled={locationLoading}
            >
              {locationLoading
                ? <ActivityIndicator size={12} color={colors.textSecondary} />
                : <Ionicons name="navigate-outline" size={12} color={nearMe ? '#fff' : colors.textSecondary} />
              }
              <Text style={[styles.chipText, nearMe && styles.chipTextActive]}>
                {lang === 'fr' ? 'Près de moi' : 'Near me'}
              </Text>
            </Pressable>
            {categories?.map(cat => {
              const active = filters.categoryId === cat.id
              return (
                <Pressable
                  key={cat.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleCategory(cat.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {lang === 'fr' ? cat.name_fr : cat.name_en}
                  </Text>
                </Pressable>
              )
            })}
            {([1,2,3] as const).map(p => {
              const active = activePrice === p
              return (
                <Pressable
                  key={p}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => togglePrice(p)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {PRICE_LABELS[p][lang]}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>

          {/* Zone chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
            {zones?.map(zone => {
              const active = filters.zoneId === zone.id
              return (
                <Pressable
                  key={zone.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleZone(zone.id)}
                >
                  <Ionicons name="location-outline" size={12} color={active ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{zone.name}</Text>
                </Pressable>
              )
            })}
          </ScrollView>
        </View>

        {/* Results */}
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#E8571A" size="large" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="search-outline" size={48} color={colors.iconMuted} />
            <Text style={styles.emptyText}>{t('explore.noResults')}</Text>
            <Text style={styles.emptyHint}>{t('explore.noResultsHint')}</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onEndReached={() => hasNextPage && fetchNextPage()}
            onEndReachedThreshold={0.4}
            ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color="#E8571A" style={{ padding: 16 }} /> : null}
            renderItem={({ item }) => {
              const photo = (item as any).photos?.find((p: any) => p.is_primary) ?? (item as any).photos?.[0]
              const cat = (item as any).categories
              const zone = (item as any).zones
              const distKm = (item as any)._distKm as number | null
              return (
                <Pressable style={styles.card} onPress={() => router.push(`/place/${item.id}`)}>
                  <View style={styles.cardThumb}>
                    {photo ? (
                      <Image source={{ uri: photoUrl(photo.storage_path) }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, styles.photoFallback]} />
                    )}
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {lang === 'fr' ? cat?.name_fr : cat?.name_en}
                      {zone ? ` · ${zone.name}` : ''}
                    </Text>
                    {(item as any).hours && (() => {
                      const open = isOpenNow((item as any).hours)
                      return (
                        <View style={[styles.openBadge, open ? styles.openBadgeOpen : styles.openBadgeClosed]}>
                          <Text style={[styles.openBadgeText, open ? styles.openBadgeTextOpen : styles.openBadgeTextClosed]}>
                            {open ? (lang === 'fr' ? 'Ouvert' : 'Open') : (lang === 'fr' ? 'Fermé' : 'Closed')}
                          </Text>
                        </View>
                      )
                    })()}
                    {item.price_range && (
                      <View style={styles.priceTag}>
                        <Text style={styles.priceTagText}>
                          {lang === 'fr'
                            ? ['Économique','Intermédiaire','Haut de gamme'][item.price_range - 1]
                            : ['Budget','Mid-range','Upscale'][item.price_range - 1]}
                        </Text>
                      </View>
                    )}
                    {nearMe && distKm !== null && (
                      <View style={styles.distTag}>
                        <Ionicons name="navigate-outline" size={10} color="#007AFF" />
                        <Text style={styles.distTagText}>
                          {distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.iconMuted} />
                </Pressable>
              )
            }}
          />
        )}
      </SafeAreaView>
    </AppBackground>
  )
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: {
      paddingTop: 8,
      paddingBottom: 8,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: c.textPrimary,
      paddingHorizontal: 24,
      marginBottom: 14,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 24,
      marginBottom: 12,
      height: 46,
      borderRadius: 23,
      backgroundColor: c.inputBg,
      borderWidth: 1,
      borderColor: c.inputBorder,
      paddingHorizontal: 14,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: c.inputText,
    },
    chipsScroll: {
      marginBottom: 6,
    },
    chipsContent: {
      paddingHorizontal: 24,
      gap: 8,
      paddingBottom: 2,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    chipActive: {
      backgroundColor: '#E8571A',
      borderColor: '#E8571A',
    },
    chipText: {
      fontSize: 13,
      fontWeight: '500',
      color: c.textSecondary,
    },
    chipTextActive: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    emptyText: {
      fontSize: 17,
      fontWeight: '600',
      color: c.textTertiary,
    },
    emptyHint: {
      fontSize: 14,
      color: c.textSecondary,
    },
    list: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 100,
      gap: 10,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
    },
    cardThumb: {
      width: 72,
      height: 72,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: c.thumbFallback,
    },
    photoFallback: {
      backgroundColor: c.thumbFallback,
    },
    cardBody: {
      flex: 1,
      gap: 3,
    },
    cardName: {
      fontSize: 16,
      fontWeight: '600',
      color: c.textPrimary,
    },
    cardSub: {
      fontSize: 13,
      color: c.textSecondary,
    },
    priceTag: {
      alignSelf: 'flex-start',
      marginTop: 2,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: 'rgba(232,87,26,0.1)',
    },
    priceTagText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#E8571A',
    },
    openBadge: {
      alignSelf: 'flex-start',
      marginTop: 2,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    openBadgeOpen:   { backgroundColor: 'rgba(52,199,89,0.12)' },
    openBadgeClosed: { backgroundColor: 'rgba(255,59,48,0.1)' },
    openBadgeText:       { fontSize: 11, fontWeight: '600' },
    openBadgeTextOpen:   { color: '#34C759' },
    openBadgeTextClosed: { color: '#FF3B30' },
    distTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      alignSelf: 'flex-start',
      marginTop: 2,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: 'rgba(0,122,255,0.08)',
    },
    distTagText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#007AFF',
    },
  })
}

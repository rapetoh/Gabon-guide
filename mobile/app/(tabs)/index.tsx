/**
 * Home screen — TikTok-style full-screen vertical video feed
 * with a floating filter header (categories + quick-filter chips).
 */
import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewToken,
  RefreshControl,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import VideoFeedCard, { CARD_HEIGHT } from '../../components/VideoFeedCard'
import { useVideoFeed, FeedFilters } from '../../hooks/useVideoFeed'
import { useCategories } from '../../hooks/useCategories'
import { useUnreadNotificationCount } from '../../hooks/useNotifications'
import { useZones } from '../../hooks/useZones'
import { usePullRefresh } from '../../hooks/usePullRefresh'

// Price range labels
const PRICE_LABELS: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$' }

export default function HomeScreen() {
  const { t, i18n } = useTranslation()
  const { refreshing, onRefresh } = usePullRefresh()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const insets = useSafeAreaInsets()
  const { data: unread } = useUnreadNotificationCount()
  const unreadCount = unread ?? 0

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [openNow, setOpenNow] = useState(false)
  const [priceRange, setPriceRange] = useState<1 | 2 | 3 | null>(null)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [showZonePicker, setShowZonePicker] = useState(false)

  const { data: categories } = useCategories()
  const { data: zones } = useZones()

  const filters: FeedFilters = {
    categoryId: selectedCategoryId,
    zoneId: selectedZoneId,
    priceRange,
    openNow,
  }

  // ── Feed ─────────────────────────────────────────────────────────────────────
  const [activeIndex, setActiveIndex] = useState(0)
  const [muted, setMuted] = useState(false)
  const feedRef = useRef<FlatList>(null)

  // Pause all videos when navigating away from this tab/screen
  const [isScreenFocused, setIsScreenFocused] = useState(true)
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true)
      return () => setIsScreenFocused(false)
    }, [])
  )

  function applyFilter(fn: () => void) {
    fn()
    setActiveIndex(0)
    // Scroll to top immediately when filter changes
    feedRef.current?.scrollToOffset({ offset: 0, animated: false })
  }

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useVideoFeed(filters)
  const feedItems = data?.pages.flatMap(page => page.items) ?? []

  // With "Open now" active, a fetched page can filter down to zero items
  // while more rows exist server-side. Keep fetching until we either have
  // something to show or pagination genuinely ends.
  useEffect(() => {
    if (!openNow) return
    if (isLoading || isFetchingNextPage || isError) return
    if (feedItems.length === 0 && hasNextPage) fetchNextPage()
  }, [openNow, isLoading, isFetchingNextPage, isError, feedItems.length, hasNextPage, fetchNextPage])

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index)
      }
    }
  ).current

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: CARD_HEIGHT,
      offset: CARD_HEIGHT * index,
      index,
    }),
    []
  )

  // ── Header height for card list top padding ───────────────────────────────
  // SafeArea top + category row (44) + chips row (40) + vertical padding (24)
  const HEADER_HEIGHT = insets.top + 44 + 40 + 24

  // ── Zone display label ───────────────────────────────────────────────────
  const selectedZone = zones?.find((z: any) => z.id === selectedZoneId)
  const zoneLabel = selectedZone
    ? selectedZone.name
    : lang === 'fr' ? 'Toutes les zones' : 'All areas'

  return (
    <View style={styles.container}>

      {/* ── Feed list ── */}
      {isLoading || (feedItems.length === 0 && (isFetchingNextPage || (hasNextPage && !isError))) ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#E8571A" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>{t('errors.offline')}</Text>
          <Text style={styles.emptyHint}>{t('errors.offlineHint')}</Text>
          <Pressable style={styles.resetBtn} onPress={() => refetch()}>
            <Text style={styles.resetBtnText}>
              {lang === 'fr' ? 'Réessayer' : 'Retry'}
            </Text>
          </Pressable>
        </View>
      ) : feedItems.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={40} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>
            {lang === 'fr' ? 'Aucun lieu trouvé' : 'No places found'}
          </Text>
          <Pressable
            style={styles.resetBtn}
            onPress={() => applyFilter(() => {
              setSelectedCategoryId(null)
              setOpenNow(false)
              setPriceRange(null)
              setSelectedZoneId(null)
            })}
          >
            <Text style={styles.resetBtnText}>
              {lang === 'fr' ? 'Réinitialiser les filtres' : 'Reset filters'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
          ref={feedRef}
          data={feedItems}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <VideoFeedCard
              item={item}
              isActive={index === activeIndex && isScreenFocused}
              isMuted={muted}
              onToggleMute={() => setMuted(m => !m)}
              lang={lang as 'fr' | 'en'}
              headerHeight={HEADER_HEIGHT}
            />
          )}
          pagingEnabled
          snapToInterval={CARD_HEIGHT}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={getItemLayout}
          windowSize={3}
          maxToRenderPerBatch={2}
          initialNumToRender={2}
          removeClippedSubviews
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage()
          }}
          onEndReachedThreshold={1}
        />
      )}

      {/* ── Floating filter header (overlaid on top of feed) ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">

        {/* Row 1: Category tabs + search icon */}
        <View style={styles.categoryRowWrap} pointerEvents="auto">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {/* "All" tab */}
            <Pressable
              style={[styles.categoryTab, !selectedCategoryId && styles.categoryTabActive]}
              onPress={() => applyFilter(() => setSelectedCategoryId(null))}
            >
              <Text style={[styles.categoryTabText, !selectedCategoryId && styles.categoryTabTextActive]}>
                {lang === 'fr' ? 'Tout' : 'All'}
              </Text>
            </Pressable>

            {(categories ?? []).map((cat: any) => {
              const label = lang === 'fr' ? cat.name_fr : cat.name_en
              const isActive = selectedCategoryId === cat.id
              return (
                <Pressable
                  key={cat.id}
                  style={[styles.categoryTab, isActive && styles.categoryTabActive]}
                  onPress={() => applyFilter(() => setSelectedCategoryId(isActive ? null : cat.id))}
                >
                  <Text style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>

          {/* Search icon — navigates to Explore tab and focuses search bar */}
          <Pressable
            style={styles.searchIconBtn}
            onPress={() => router.push({ pathname: '/(tabs)/explore', params: { focus: '1' } })}
            hitSlop={10}
          >
            <Ionicons name="search" size={22} color="#fff" style={styles.searchIconShadow} />
          </Pressable>

          {/* Notifications bell + unread badge */}
          <Pressable
            style={styles.bellIconBtn}
            onPress={() => router.push('/notifications' as any)}
            hitSlop={10}
          >
            <Ionicons name="notifications-outline" size={22} color="#fff" style={styles.searchIconShadow} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Row 2: Quick-filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          pointerEvents="auto"
        >
          {/* Open now */}
          <Pressable
            style={[styles.chip, openNow && styles.chipActive]}
            onPress={() => applyFilter(() => setOpenNow(v => !v))}
          >
            {openNow && <View style={styles.chipDot} />}
            <Text style={[styles.chipText, openNow && styles.chipTextActive]}>
              {lang === 'fr' ? 'Ouvert' : 'Open now'}
            </Text>
          </Pressable>

          {/* Price range chips */}
          {([1, 2, 3] as const).map(p => (
            <Pressable
              key={p}
              style={[styles.chip, priceRange === p && styles.chipActive]}
              onPress={() => applyFilter(() => setPriceRange(priceRange === p ? null : p))}
            >
              <Text style={[styles.chipText, priceRange === p && styles.chipTextActive]}>
                {PRICE_LABELS[p]}
              </Text>
            </Pressable>
          ))}

          {/* Zone picker chip */}
          <Pressable
            style={[styles.chip, selectedZoneId && styles.chipActive]}
            onPress={() => setShowZonePicker(v => !v)}
          >
            <Ionicons
              name="location-outline"
              size={12}
              color={selectedZoneId ? '#fff' : 'rgba(255,255,255,0.8)'}
              style={{ marginRight: 3 }}
            />
            <Text
              style={[styles.chipText, !!selectedZoneId && styles.chipTextActive]}
              numberOfLines={1}
            >
              {zoneLabel}
            </Text>
            <Ionicons
              name="chevron-down"
              size={11}
              color={selectedZoneId ? '#fff' : 'rgba(255,255,255,0.8)'}
              style={{ marginLeft: 2 }}
            />
          </Pressable>
        </ScrollView>

        {/* Zone dropdown */}
        {showZonePicker && (
          <View style={styles.zonePicker} pointerEvents="auto">
            <Pressable
              style={[styles.zoneOption, !selectedZoneId && styles.zoneOptionActive]}
              onPress={() => { setShowZonePicker(false); applyFilter(() => setSelectedZoneId(null)) }}
            >
              <Text style={[styles.zoneOptionText, !selectedZoneId && styles.zoneOptionTextActive]}>
                {lang === 'fr' ? 'Toutes les zones' : 'All areas'}
              </Text>
            </Pressable>
            {(zones ?? []).map((zone: any) => (
              <Pressable
                key={zone.id}
                style={[styles.zoneOption, selectedZoneId === zone.id && styles.zoneOptionActive]}
                onPress={() => { setShowZonePicker(false); applyFilter(() => setSelectedZoneId(zone.id)) }}
              >
                <Text style={[styles.zoneOptionText, selectedZoneId === zone.id && styles.zoneOptionTextActive]}>
                  {zone.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
  },
  emptyHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
  },
  resetBtn: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  resetBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Floating header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    gap: 8,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0)',
  },
  // Category tabs
  categoryRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryRow: {
    paddingHorizontal: 16,
    gap: 6,
    alignItems: 'center',
  },
  searchIconBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bellIconBtn: {
    paddingRight: 14,
    paddingVertical: 8,
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: '#E8571A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  searchIconShadow: {
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  categoryTabActive: {
    borderBottomColor: '#fff',
  },
  categoryTabText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  categoryTabTextActive: {
    color: '#fff',
  },
  // Filter chips
  chipsRow: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chipActive: {
    backgroundColor: '#E8571A',
    borderColor: '#E8571A',
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
    marginRight: 5,
  },
  chipText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  chipTextActive: {
    color: '#fff',
  },
  // Zone dropdown
  zonePicker: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(20,20,20,0.96)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  zoneOption: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  zoneOptionActive: {
    backgroundColor: 'rgba(232,87,26,0.15)',
  },
  zoneOptionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  zoneOptionTextActive: {
    color: '#E8571A',
    fontWeight: '700',
  },
})

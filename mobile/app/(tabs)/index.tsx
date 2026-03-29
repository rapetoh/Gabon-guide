/**
 * Home screen — TikTok-style full-screen vertical video feed.
 *
 * Each card fills the entire screen:
 *   • Place with video  → plays the video (expo-video), auto-play/pause on scroll
 *   • Place without video → cycles through gallery photos (crossfade every 3.5 s)
 *
 * Controls:
 *   • Swipe up/down to move between cards (pagingEnabled FlatList)
 *   • Tap card → opens place detail
 *   • Right panel: Save, Share, Menu (if menu photos exist)
 *   • Top-right: mute / unmute (video cards only)
 */
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native'

import VideoFeedCard, { CARD_HEIGHT } from '../../components/VideoFeedCard'
import { useVideoFeed } from '../../hooks/useVideoFeed'

export default function HomeScreen() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  const [activeIndex, setActiveIndex] = useState(0)
  const [muted, setMuted] = useState(false)

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useVideoFeed()
  const feedItems = data?.pages.flat() ?? []

  // Must be in a ref so FlatList doesn't recreate it on every render
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index)
      }
    }
  ).current

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: CARD_HEIGHT,
      offset: CARD_HEIGHT * index,
      index,
    }),
    []
  )

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#E8571A" />
      </View>
    )
  }

  if (feedItems.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>
          {lang === 'fr' ? 'Aucun lieu disponible' : 'No places available'}
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={feedItems}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <VideoFeedCard
            item={item}
            isActive={index === activeIndex}
            isMuted={muted}
            onToggleMute={() => setMuted(m => !m)}
            lang={lang as 'fr' | 'en'}
          />
        )}
        // Paging — one card per "page" (full screen)
        pagingEnabled
        snapToInterval={CARD_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        // Viewability — tracks which card is on screen for auto-play
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        // Performance
        getItemLayout={getItemLayout}
        windowSize={3}
        maxToRenderPerBatch={2}
        initialNumToRender={2}
        removeClippedSubviews
        // Infinite scroll
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage()
        }}
        onEndReachedThreshold={1}
      />
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
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
  },
})

/**
 * VideoFeedCard — full-screen TikTok-style card.
 *
 * - If the place has a video: plays it with expo-video (auto-play when active,
 *   pauses + rewinds when scrolled away).
 * - If no video: auto-slides through gallery photos with a crossfade every 3.5s.
 * - Right-side action panel: Save (heart), Share, Menu (if menu photos exist).
 * - Bottom overlay: place name, category · zone, description excerpt, "View place" CTA.
 * - Mute / unmute button top-right (video only).
 * - Photo dots indicator bottom-centre (slideshow only, multiple photos).
 */
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useVideoPlayer, VideoView } from 'expo-video'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useFavorites } from '../hooks/useFavorites'
import { useSession } from '../hooks/useSession'
import { supabase } from '../lib/supabase'
import type { FeedItem } from '../hooks/useVideoFeed'
import ReviewsBottomSheet from './ReviewsBottomSheet'
import MenuBottomSheet from './MenuBottomSheet'

// Match FloatingTabBar: bottom = Math.max(insets.bottom, 16) + 8, pill height = 64
function useTabBarClearance() {
  const insets = useSafeAreaInsets()
  return Math.max(insets.bottom, 16) + 8 + 64 + 12 // extra 12px breathing room
}

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window')
export const CARD_HEIGHT = SCREEN_HEIGHT

const SLIDE_INTERVAL_MS = 3500
const FADE_DURATION_MS = 400

function getPhotoUrl(path: string) {
  return supabase.storage.from('place-photos').getPublicUrl(path).data.publicUrl
}

function getVideoUrl(path: string) {
  return supabase.storage.from('place-videos').getPublicUrl(path).data.publicUrl
}

interface Props {
  item: FeedItem
  isActive: boolean
  isMuted: boolean
  onToggleMute: () => void
  lang: 'fr' | 'en'
  /** Height of the floating filter header so badges/buttons clear it */
  headerHeight: number
}

export default function VideoFeedCard({ item, isActive, isMuted, onToggleMute, lang, headerHeight }: Props) {
  const tabBarClearance = useTabBarClearance()
  const { session } = useSession()
  const { isFavorite, toggleFavorite } = useFavorites()
  const saved = isFavorite(item.id)

  // ── Video player ────────────────────────────────────────────────────────────
  const videoSource = item.video ? getVideoUrl(item.video.storage_path) : null
  const player = useVideoPlayer(videoSource, p => {
    if (p) {
      p.loop = true
      p.muted = isMuted
    }
  })

  // ── Tap-to-pause ─────────────────────────────────────────────────────────────
  const [userPaused, setUserPaused] = useState(false)
  const [flashIcon, setFlashIcon] = useState<'play' | 'pause'>('pause')
  const playIconAnim = useRef(new Animated.Value(0)).current

  function handleTapCenter() {
    if (!videoSource) return
    const next = !userPaused
    setUserPaused(next)
    setFlashIcon(next ? 'pause' : 'play')
    playIconAnim.setValue(1)
    Animated.timing(playIconAnim, {
      toValue: 0,
      duration: 700,
      useNativeDriver: true,
    }).start()
  }

  // Sync mute
  useEffect(() => {
    if (videoSource && player) player.muted = isMuted
  }, [isMuted, player, videoSource])

  // Play / pause on active change or user-initiated pause
  useEffect(() => {
    if (!videoSource || !player) return
    if (isActive && !userPaused) {
      player.play()
    } else {
      player.pause()
      if (!isActive) player.currentTime = 0
    }
  }, [isActive, userPaused, player, videoSource])

  // Reset user-pause state when the card scrolls out of view
  useEffect(() => {
    if (!isActive) setUserPaused(false)
  }, [isActive])

  const [reviewsOpen, setReviewsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // ── Photo slideshow ──────────────────────────────────────────────────────────
  const [photoIndex, setPhotoIndex] = useState(0)
  const fadeAnim = useRef(new Animated.Value(1)).current

  // Reset slideshow when the card's item changes (new item scrolled into view)
  useEffect(() => {
    setPhotoIndex(0)
    fadeAnim.setValue(1)
  }, [item.id, fadeAnim])

  useEffect(() => {
    if (videoSource || !isActive || item.photos.length <= 1) return
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: FADE_DURATION_MS,
        useNativeDriver: true,
      }).start(() => {
        setPhotoIndex(prev => (prev + 1) % item.photos.length)
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: FADE_DURATION_MS,
          useNativeDriver: true,
        }).start()
      })
    }, SLIDE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isActive, videoSource, item.photos.length, fadeAnim])

  // ── Actions ──────────────────────────────────────────────────────────────────
  function handleToggleSave() {
    if (!session) {
      router.push({ pathname: '/auth/login', params: { redirect: `/place/${item.id}` } })
      return
    }
    toggleFavorite.mutate(item.id)
  }

  function handleShare() {
    const name = item.name
    const desc =
      lang === 'fr'
        ? item.description_fr?.slice(0, 100)
        : item.description_en?.slice(0, 100)
    Share.share({
      title: name,
      message: desc ? `${name} — ${desc}\nokili://place/${item.id}` : `${name}\nokili://place/${item.id}`,
    })
  }

  // ── Render helpers ────────────────────────────────────────────────────────────
  const currentPhoto = item.photos[photoIndex]
  const categoryName = item.categories
    ? lang === 'fr'
      ? item.categories.name_fr
      : item.categories.name_en
    : null
  const zoneName = item.zones?.name ?? null
  const metaLine = [categoryName, zoneName].filter(Boolean).join(' · ')
  const description =
    lang === 'fr' ? item.description_fr : item.description_en

  return (
    <View style={styles.card}>

      {/* ── Background media ── */}
      {videoSource ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      ) : currentPhoto ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
          <Image
            source={{ uri: getPhotoUrl(currentPhoto.storage_path) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        </Animated.View>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noMediaFallback]} />
      )}

      {/* ── Scrim — dark gradient at bottom so text is readable ── */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.78)']}
        style={styles.scrim}
        pointerEvents="none"
      />

      {/* ── Tap-to-pause (video only) — sits above scrim, below all UI controls ── */}
      {videoSource && (
        <Pressable style={StyleSheet.absoluteFill} onPress={handleTapCenter}>
          <Animated.View style={[styles.playPauseFlash, { opacity: playIconAnim }]}>
            <Ionicons name={flashIcon === 'pause' ? 'pause' : 'play'} size={64} color="rgba(255,255,255,0.85)" />
          </Animated.View>
        </Pressable>
      )}

      {/* ── Mute button (top-right, video only) ── */}
      {videoSource && (
        <Pressable style={[styles.muteBtn, { top: headerHeight + 8 }]} onPress={onToggleMute} hitSlop={12}>
          <Ionicons
            name={isMuted ? 'volume-mute' : 'volume-high'}
            size={20}
            color="#fff"
          />
        </Pressable>
      )}

      {/* ── Promoted badge (top-left) ── */}
      {item.is_promoted && (
        <View style={[styles.promotedBadge, { top: headerHeight + 8 }]}>
          <Text style={styles.promotedText}>
            {lang === 'fr' ? 'Promu' : 'Promoted'}
          </Text>
        </View>
      )}

      {/* ── Photo dots (slideshow, multiple photos) ── */}
      {!videoSource && item.photos.length > 1 && (
        <View style={[styles.dotsRow, { top: headerHeight + 8 }]} pointerEvents="none">
          {item.photos.map((_, i) => (
            <View key={i} style={[styles.dot, i === photoIndex && styles.dotActive]} />
          ))}
        </View>
      )}

      {/* ── Right-side action panel ── */}
      <View style={[styles.actionPanel, { bottom: tabBarClearance + 16 }]}>
        {/* Save */}
        <Pressable style={styles.actionBtn} onPress={handleToggleSave}>
          <Ionicons
            name={saved ? 'heart' : 'heart-outline'}
            size={30}
            color={saved ? '#FF3B30' : '#fff'}
          />
          <Text style={styles.actionLabel}>
            {lang === 'fr' ? 'Sauver' : 'Save'}
          </Text>
        </Pressable>

        {/* Comments */}
        <Pressable style={styles.actionBtn} onPress={() => setReviewsOpen(true)}>
          <Ionicons name="chatbubble-outline" size={27} color="#fff" />
          <Text style={styles.actionLabel}>
            {lang === 'fr' ? 'Avis' : 'Reviews'}
          </Text>
        </Pressable>

        {/* Share */}
        <Pressable style={styles.actionBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={28} color="#fff" />
          <Text style={styles.actionLabel}>
            {lang === 'fr' ? 'Partager' : 'Share'}
          </Text>
        </Pressable>

        {/* Menu — only if place has menu photos */}
        {item.hasMenuPhotos && (
          <Pressable
            style={styles.actionBtn}
            onPress={() => setMenuOpen(true)}
          >
            <Ionicons name="receipt-outline" size={26} color="#fff" />
            <Text style={styles.actionLabel}>Menu</Text>
          </Pressable>
        )}
      </View>

      {/* ── Bottom info overlay ── */}
      <Pressable
        style={[styles.infoOverlay, { bottom: tabBarClearance }]}
        onPress={() => router.push(`/place/${item.id}`)}
      >
        <Text style={styles.placeName} numberOfLines={1}>
          {item.name}
        </Text>

        {metaLine ? (
          <Text style={styles.placeMeta} numberOfLines={1}>
            {metaLine}
          </Text>
        ) : null}

        {description ? (
          <Text style={styles.placeDesc} numberOfLines={2}>
            {description}
          </Text>
        ) : null}

        <View style={styles.viewBtn}>
          <Text style={styles.viewBtnText}>
            {lang === 'fr' ? 'Voir le lieu  →' : 'View place  →'}
          </Text>
        </View>
      </Pressable>
      {/* ── Reviews bottom sheet ── */}
      <ReviewsBottomSheet
        placeId={item.id}
        placeName={item.name}
        visible={reviewsOpen}
        onClose={() => setReviewsOpen(false)}
        lang={lang}
      />

      {/* ── Menu bottom sheet ── */}
      <MenuBottomSheet
        placeId={item.id}
        placeName={item.name}
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        lang={lang}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width,
    height: CARD_HEIGHT,
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  noMediaFallback: {
    backgroundColor: '#1a1a1a',
  },
  playPauseFlash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Bottom-heavy scrim so text is readable over the media
  scrim: {
    position: 'absolute',
    top: '30%',
    bottom: 0,
    left: 0,
    right: 0,
  },
  // Mute button
  muteBtn: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Promoted badge — top set via inline style using headerHeight
  promotedBadge: {
    position: 'absolute',
    left: 16,
    backgroundColor: '#E8571A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  promotedText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  // Photo progress dots — top set via inline style using headerHeight
  dotsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 18,
  },
  // Right action panel — bottom is set via inline style using tabBarClearance
  actionPanel: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    gap: 24,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  // Bottom info — bottom is set via inline style using tabBarClearance
  infoOverlay: {
    position: 'absolute',
    left: 16,
    right: 80, // leave room for action panel
    gap: 4,
  },
  placeName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  placeMeta: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  placeDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 18,
    marginTop: 2,
  },
  viewBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  viewBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
})

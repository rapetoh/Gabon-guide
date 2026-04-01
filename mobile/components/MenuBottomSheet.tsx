/**
 * MenuBottomSheet — slides up from the bottom of the video feed card.
 *
 * - Drag the handle (or header) downward to dismiss
 * - Tap a photo to open full-screen viewer
 * - Pinch to zoom inside the viewer
 * - Single-Modal design — no fragment, no nested modal
 */
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window')
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.82
const DISMISS_THRESHOLD = 100   // px dragged down before auto-dismiss
const PHOTO_SIZE = (SCREEN_WIDTH - 20 * 2 - 8) / 2

interface Props {
  placeId: string
  placeName: string
  visible: boolean
  onClose: () => void
  lang: 'fr' | 'en'
}

interface MenuPhoto {
  id: string
  storage_path: string
}

function useMenuPhotos(placeId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['menu-photos', placeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('photos')
        .select('id, storage_path')
        .eq('place_id', placeId)
        .eq('is_menu', true)
        .eq('is_deleted', false)
        .order('position', { ascending: true })
      if (error) throw error
      return (data ?? []) as MenuPhoto[]
    },
    enabled,
  })
}

function getPhotoUrl(path: string) {
  return supabase.storage.from('place-photos').getPublicUrl(path).data.publicUrl
}

export default function MenuBottomSheet({ placeId, placeName, visible, onClose, lang }: Props) {
  const insets = useSafeAreaInsets()
  const { data: photos, isLoading } = useMenuPhotos(placeId, visible)

  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  // Reset viewer when sheet closes
  useEffect(() => {
    if (!visible) setViewerIndex(null)
  }, [visible])

  // ── Slide open/close animation ────────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start()
    } else {
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }).start()
    }
  }, [visible, slideAnim])

  // ── Drag-to-dismiss ───────────────────────────────────────────────────────
  const dragY = useRef(new Animated.Value(0)).current

  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture if the user is dragging downward
      onMoveShouldSetPanResponder: (_, { dy, dx }) => dy > 8 && Math.abs(dy) > Math.abs(dx),
      onPanResponderMove: (_, { dy }) => {
        // Only allow downward drag
        if (dy > 0) dragY.setValue(dy)
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > DISMISS_THRESHOLD || vy > 0.8) {
          // Flick/drag far enough — animate the rest of the way down then close
          Animated.timing(dragY, {
            toValue: SHEET_HEIGHT,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            dragY.setValue(0)
            onClose()
          })
        } else {
          // Not far enough — snap back
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start()
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start()
      },
    })
  ).current

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop — tap outside the sheet to close */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Sheet — rendered after backdrop so it sits on top */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 8 },
          { transform: [{ translateY: Animated.add(slideAnim, dragY) }] },
        ]}
      >
        {/* ── Draggable handle + header ── */}
        <View {...panResponder.panHandlers}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle} numberOfLines={1}>{placeName}</Text>
              <Text style={styles.sheetSubtitle}>Menu</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#8E8E93" />
            </Pressable>
          </View>
        </View>

        {/* ── Content ── */}
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#E8571A" />
          </View>
        ) : !photos || photos.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="receipt-outline" size={40} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyText}>
              {lang === 'fr' ? 'Aucune photo de menu disponible.' : 'No menu photos available.'}
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {photos.map((photo, index) => (
              <Pressable
                key={photo.id}
                style={styles.photoCell}
                onPress={() => setViewerIndex(index)}
              >
                <Image
                  source={{ uri: getPhotoUrl(photo.storage_path) }}
                  style={styles.photo}
                  contentFit="cover"
                  transition={200}
                />
                <View style={styles.zoomHint}>
                  <Ionicons name="expand-outline" size={14} color="rgba(255,255,255,0.7)" />
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Animated.View>

      {/* ── Full-screen viewer (inside same Modal) ── */}
      {viewerIndex !== null && photos && photos[viewerIndex] && (
        <View style={styles.viewer}>
          {/* Close viewer on tap outside image */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setViewerIndex(null)} />

          {/* Zoomable image via ScrollView */}
          <ScrollView
            style={styles.viewerScroll}
            contentContainerStyle={styles.viewerScrollContent}
            maximumZoomScale={4}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            centerContent
            bouncesZoom
          >
            <Image
              source={{ uri: getPhotoUrl(photos[viewerIndex].storage_path) }}
              style={styles.viewerImage}
              contentFit="contain"
            />
          </ScrollView>

          {/* Prev */}
          {viewerIndex > 0 && (
            <Pressable
              style={[styles.viewerArrow, styles.viewerArrowLeft]}
              onPress={() => setViewerIndex(viewerIndex - 1)}
              hitSlop={20}
            >
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </Pressable>
          )}

          {/* Next */}
          {viewerIndex < photos.length - 1 && (
            <Pressable
              style={[styles.viewerArrow, styles.viewerArrowRight]}
              onPress={() => setViewerIndex(viewerIndex + 1)}
              hitSlop={20}
            >
              <Ionicons name="chevron-forward" size={28} color="#fff" />
            </Pressable>
          )}

          {/* Counter */}
          <View style={[styles.viewerCounter, { top: insets.top + 16 }]}>
            <Text style={styles.viewerCounterText}>
              {viewerIndex + 1} / {photos.length}
            </Text>
          </View>

          {/* Close */}
          <Pressable
            style={[styles.viewerClose, { top: insets.top + 12 }]}
            onPress={() => setViewerIndex(null)}
            hitSlop={16}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>

          {/* Zoom hint (first open only) */}
          <View style={[styles.zoomHintBar, { bottom: insets.bottom + 16 }]}>
            <Ionicons name="search-outline" size={13} color="rgba(255,255,255,0.5)" />
            <Text style={styles.zoomHintText}>
              {lang === 'fr' ? 'Pincez pour zoomer' : 'Pinch to zoom'}
            </Text>
          </View>
        </View>
      )}
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleWrap: {
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    maxWidth: 260,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 220,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    gap: 8,
  },
  photoCell: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.3,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  zoomHint: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 6,
    padding: 3,
  },
  // Viewer
  viewer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerScroll: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.78,
  },
  viewerScrollContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.78,
  },
  viewerArrow: {
    position: 'absolute',
    top: '50%',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    padding: 8,
  },
  viewerArrowLeft: { left: 16 },
  viewerArrowRight: { right: 16 },
  viewerCounter: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  viewerCounterText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  viewerClose: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    padding: 6,
  },
  zoomHintBar: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  zoomHintText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
})

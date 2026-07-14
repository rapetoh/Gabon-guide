import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import MapView, { Marker, Region } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'

import { supabase } from '../../lib/supabase'
import { useThemeColors } from '../../contexts/ThemeContext'
import { ThemeColors } from '../../constants/themes'

// Libreville, Gabon — city center
const LIBREVILLE: Region = {
  latitude: 0.4162,
  longitude: 9.4673,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
}

function photoUrl(path: string) {
  return supabase.storage.from('place-photos').getPublicUrl(path).data.publicUrl
}

// Lightweight, unpaginated query dedicated to the map. usePlaces() pages by
// 20 newest places, which silently truncated the pins; the map needs every
// active place, but only the columns the pin + callout card render.
interface MapPlace {
  id: string
  name: string
  latitude: number
  longitude: number
  categories: { name_fr: string; name_en: string } | null
  zones: { name: string } | null
  photos: { storage_path: string; is_primary: boolean; is_deleted: boolean }[]
}

function useMapPlaces() {
  return useQuery({
    queryKey: ['map-places'],
    queryFn: async (): Promise<MapPlace[]> => {
      const { data, error } = await supabase
        .from('places')
        .select(`
          id, name, latitude, longitude,
          categories ( name_fr, name_en ),
          zones ( name ),
          photos ( storage_path, is_primary, is_deleted )
        `)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .limit(500)
      if (error) throw error
      // Cast needed: Supabase's type inference returns `never` for nested
      // selects with hand-written types (same caveat as usePlaces).
      return (data ?? []) as unknown as MapPlace[]
    },
    staleTime: 60_000,
  })
}

export default function MapScreen() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView>(null)
  const colors = useThemeColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const [selected, setSelected] = useState<MapPlace | null>(null)
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null)

  const { data, isError, refetch } = useMapPlaces()
  const places = data ?? []
  const mappable = places.filter(p => p.latitude && p.longitude)

  // Request location permission once
  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        Location.getCurrentPositionAsync({}).then(loc => {
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
        })
      }
    })
  }, [])

  function centerOnUser() {
    if (!userLocation) return
    mapRef.current?.animateToRegion({
      ...userLocation,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }, 600)
  }

  function centerOnLibreville() {
    mapRef.current?.animateToRegion(LIBREVILLE, 600)
  }

  const selectedGallery = (selected?.photos ?? []).filter(p => !p.is_deleted)
  const selectedPhoto = selectedGallery.find(p => p.is_primary) ?? selectedGallery[0]

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={LIBREVILLE}
        showsUserLocation
        showsCompass={false}
        showsMyLocationButton={false}
      >
        {mappable.map(place => {
          const isSelected = selected?.id === place.id
          return (
            <Marker
              key={place.id}
              coordinate={{ latitude: place.latitude, longitude: place.longitude }}
              onPress={() => setSelected(place)}
              tracksViewChanges={false}
            >
              {isSelected ? (
                // Selected: brand pill + green dot
                <View style={styles.pinWrap}>
                  <View style={styles.pinSelected}>
                    <Text style={styles.pinSelectedText} numberOfLines={1}>
                      {place.name.length > 14 ? place.name.slice(0, 14) + '…' : place.name}
                    </Text>
                  </View>
                  <View style={styles.pinSelectedDot} />
                </View>
              ) : (
                // Unselected: white pill with name + dark dot
                <View style={styles.pinWrap}>
                  <View style={styles.pinUnselected}>
                    <Text style={styles.pinUnselectedText} numberOfLines={1}>
                      {place.name.length > 12 ? place.name.slice(0, 12) + '…' : place.name}
                    </Text>
                  </View>
                  <View style={styles.pinDot} />
                </View>
              )}
            </Marker>
          )
        })}
      </MapView>

      {/* Top bar */}
      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        <View style={styles.topTitle}>
          <Text style={styles.topTitleText}>{t('map.title')}</Text>
          <Text style={styles.topCount}>{t('map.placesCount', { count: mappable.length })}</Text>
        </View>
      </View>

      {/* Map controls */}
      <View style={[styles.controls, { top: insets.top + 60 }]}>
        <Pressable style={styles.controlBtn} onPress={centerOnLibreville}>
          <Ionicons name="locate-outline" size={20} color={colors.textPrimary} />
        </Pressable>
        {userLocation && (
          <Pressable style={styles.controlBtn} onPress={centerOnUser}>
            <Ionicons name="navigate-outline" size={20} color="#E8571A" />
          </Pressable>
        )}
      </View>

      {/* Offline state — the map itself may still render from tile cache,
          but without places there is nothing to pin. */}
      {isError && mappable.length === 0 && (
        <View style={styles.offlineCard}>
          <Ionicons name="cloud-offline-outline" size={28} color={colors.iconMuted} />
          <Text style={styles.offlineTitle}>{t('errors.offline')}</Text>
          <Text style={styles.offlineHint}>{t('errors.offlineHint')}</Text>
          <Pressable style={styles.offlineRetryBtn} onPress={() => refetch()}>
            <Text style={styles.offlineRetryText}>
              {lang === 'fr' ? 'Réessayer' : 'Retry'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Selected place card */}
      {selected && (
        <Pressable
          style={[styles.placeCard, { bottom: insets.bottom + 90 }]}
          onPress={() => router.push(`/place/${selected.id}`)}
        >
          <View style={styles.placeCardThumb}>
            {selectedPhoto ? (
              <Image
                source={{ uri: photoUrl(selectedPhoto.storage_path) }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.thumbFallback }]} />
            )}
          </View>
          <View style={styles.placeCardBody}>
            <Text style={styles.placeCardName} numberOfLines={1}>{selected.name}</Text>
            <Text style={styles.placeCardSub} numberOfLines={1}>
              {lang === 'fr'
                ? (selected as any).categories?.name_fr
                : (selected as any).categories?.name_en}
              {(selected as any).zones ? ` · ${(selected as any).zones.name}` : ''}
            </Text>
          </View>
          <View style={styles.placeCardArrow}>
            <Ionicons name="chevron-forward" size={18} color={colors.iconMuted} />
          </View>
          <Pressable
            style={styles.placeCardClose}
            onPress={(e) => { e.stopPropagation(); setSelected(null) }}
            hitSlop={8}
          >
            <Ionicons name="close" size={16} color={colors.iconMuted} />
          </Pressable>
        </Pressable>
      )}
    </View>
  )
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    // Top bar
    topBar: {
      position: 'absolute',
      left: 16,
      right: 16,
    },
    topTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.surfaceElevated,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.surfaceElevatedBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    topTitleText: {
      fontSize: 16,
      fontWeight: '700',
      color: c.textPrimary,
    },
    topCount: {
      fontSize: 13,
      color: c.textSecondary,
    },

    // Controls
    controls: {
      position: 'absolute',
      right: 16,
      gap: 10,
    },
    controlBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surfaceElevated,
      borderWidth: 1,
      borderColor: c.surfaceElevatedBorder,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },

    // Pins — always light since they sit on the map
    pinWrap: {
      alignItems: 'center',
      gap: 3,
    },
    pinUnselected: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 16,
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.1)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
    },
    pinUnselectedText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#1C1C1E',
    },
    pinDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#1C1C1E',
      borderWidth: 2,
      borderColor: '#fff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    },
    pinSelected: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: '#E8571A',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
    },
    pinSelectedText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
    },
    pinSelectedDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#4ADE80',
      borderWidth: 1.5,
      borderColor: '#fff',
    },

    // Offline state
    offlineCard: {
      position: 'absolute',
      left: 32,
      right: 32,
      top: '38%',
      alignItems: 'center',
      gap: 6,
      padding: 20,
      borderRadius: 20,
      backgroundColor: c.surfaceElevated,
      borderWidth: 1,
      borderColor: c.surfaceElevatedBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
    },
    offlineTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: c.textPrimary,
    },
    offlineHint: {
      fontSize: 13,
      color: c.textSecondary,
      textAlign: 'center',
    },
    offlineRetryBtn: {
      marginTop: 6,
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: '#E8571A',
    },
    offlineRetryText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },

    // Place card
    placeCard: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 20,
      backgroundColor: c.surfaceElevated,
      borderWidth: 1,
      borderColor: c.surfaceElevatedBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      gap: 12,
    },
    placeCardThumb: {
      width: 64,
      height: 64,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: c.thumbFallback,
    },
    placeCardBody: {
      flex: 1,
      gap: 4,
    },
    placeCardName: {
      fontSize: 15,
      fontWeight: '700',
      color: c.textPrimary,
    },
    placeCardSub: {
      fontSize: 13,
      color: c.textSecondary,
    },
    placeCardArrow: {
      paddingRight: 4,
    },
    placeCardClose: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.closeButtonBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
}

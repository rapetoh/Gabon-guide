import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
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

import { usePlaces, Place } from '../../hooks/usePlaces'
import { supabase } from '../../lib/supabase'

// Libreville, Gabon — city center
const LIBREVILLE: Region = {
  latitude: -0.7193,
  longitude: 8.7815,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
}

function photoUrl(path: string) {
  return supabase.storage.from('place-photos').getPublicUrl(path).data.publicUrl
}

export default function MapScreen() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView>(null)

  const [selected, setSelected] = useState<Place | null>(null)
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null)

  const { data } = usePlaces()
  const places = (data?.pages.flat() ?? []) as any[]
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

  const selectedPhoto = (selected as any)?.photos?.find((p: any) => p.is_primary)
    ?? (selected as any)?.photos?.[0]

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
                // Selected: dark pill + green dot
                <View style={styles.pinWrap}>
                  <View style={styles.pinSelected}>
                    <Text style={styles.pinSelectedText} numberOfLines={1}>
                      {place.name.length > 14 ? place.name.slice(0, 14) + '…' : place.name}
                    </Text>
                  </View>
                  <View style={styles.pinSelectedDot} />
                </View>
              ) : (
                // Unselected: white pill with name + dark dot — large enough to tap
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
          <Text style={styles.topTitleText}>{lang === 'fr' ? 'Carte' : 'Map'}</Text>
          <Text style={styles.topCount}>{mappable.length} lieux</Text>
        </View>
      </View>

      {/* Map controls */}
      <View style={[styles.controls, { top: insets.top + 60 }]}>
        <Pressable style={styles.controlBtn} onPress={centerOnLibreville}>
          <Ionicons name="locate-outline" size={20} color="#1C1C1E" />
        </Pressable>
        {userLocation && (
          <Pressable style={styles.controlBtn} onPress={centerOnUser}>
            <Ionicons name="navigate-outline" size={20} color="#E8571A" />
          </Pressable>
        )}
      </View>

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
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(200,200,210,0.4)' }]} />
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
            <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
          </View>
          <Pressable
            style={styles.placeCardClose}
            onPress={(e) => { e.stopPropagation(); setSelected(null) }}
            hitSlop={8}
          >
            <Ionicons name="close" size={16} color="#8E8E93" />
          </Pressable>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  topTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  topCount: {
    fontSize: 13,
    color: '#8E8E93',
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
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },

  // Pins
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
    backgroundColor: '#1C1C1E',
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

  // Place card
  placeCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.97)',
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
    backgroundColor: 'rgba(200,200,210,0.3)',
  },
  placeCardBody: {
    flex: 1,
    gap: 4,
  },
  placeCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  placeCardSub: {
    fontSize: 13,
    color: '#8E8E93',
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
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})

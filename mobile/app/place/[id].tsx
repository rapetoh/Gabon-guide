import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActionSheetIOS,
  ActivityIndicator,
  Dimensions,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import * as Location from 'expo-location'
import MapView, { Marker, Polyline } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { usePlace } from '../../hooks/usePlace'
import { useFavorites } from '../../hooks/useFavorites'
import { useReviews, useUserReview, useSubmitReview, useDeleteReview } from '../../hooks/useReviews'
import { useSession } from '../../hooks/useSession'
import { useAnalytics } from '../../hooks/useAnalytics'
import { supabase } from '../../lib/supabase'
import { getWhatsAppUrl } from '../../utils/formatWhatsApp'
import { isOpenNow } from '../../utils/isOpenNow'
import { useThemeColors } from '../../contexts/ThemeContext'
import { ThemeColors } from '../../constants/themes'

const { width } = Dimensions.get('window')
const HERO_HEIGHT = 320

function photoUrl(path: string) {
  return supabase.storage.from('place-photos').getPublicUrl(path).data.publicUrl
}

function formatPhone(phone: string | null) {
  if (!phone) return null
  return phone.replace(/\s|-/g, '')
}

const PRICE_LABEL: Record<number, { fr: string; en: string }> = {
  1: { fr: 'Éco',          en: 'Budget'   },
  2: { fr: 'Intermédiaire', en: 'Mid'      },
  3: { fr: 'Haut de gamme', en: 'Upscale'  },
}


const DAY_KEYS = ['mon','tue','wed','thu','fri','sat','sun'] as const
const DAY_LABELS: Record<string, { fr: string; en: string }> = {
  mon: { fr: 'Lundi',    en: 'Monday'    },
  tue: { fr: 'Mardi',    en: 'Tuesday'   },
  wed: { fr: 'Mercredi', en: 'Wednesday' },
  thu: { fr: 'Jeudi',    en: 'Thursday'  },
  fri: { fr: 'Vendredi', en: 'Friday'    },
  sat: { fr: 'Samedi',   en: 'Saturday'  },
  sun: { fr: 'Dimanche', en: 'Sunday'    },
}

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const insets = useSafeAreaInsets()
  const colors = useThemeColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const { session } = useSession()
  const analytics = useAnalytics()
  const { data: place, isLoading } = usePlace(id)
  const { isFavorite, toggleFavorite } = useFavorites()
  const { data: reviewsData } = useReviews(id)
  const { data: userReview } = useUserReview(id)
  const submitReview = useSubmitReview(id)
  const deleteReview = useDeleteReview(id)
  const [reviewFormOpen, setReviewFormOpen] = useState(false)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [hoursOpen, setHoursOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [mapsSheetOpen, setMapsSheetOpen] = useState(false)
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([])
  const [routeSteps, setRouteSteps] = useState<{ instruction: string; distance: string }[]>([])
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [distanceRemaining, setDistanceRemaining] = useState<string | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null)
  const mapRef = useRef<MapView>(null)

  // Track place_viewed once the place data is loaded
  useEffect(() => {
    if (place) {
      analytics.placeViewed(place.id, place.name, (place as any).categories?.name_en)
    }
  }, [place?.id])

  // Clean up location watcher when map closes
  useEffect(() => {
    if (!mapOpen) {
      locationWatchRef.current?.remove()
      locationWatchRef.current = null
      setIsNavigating(false)
      setCurrentStepIdx(0)
      setDistanceRemaining(null)
    }
  }, [mapOpen])

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#E8571A" size="large" />
      </View>
    )
  }

  if (!place) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={{ color: colors.textSecondary }}>{t('place.notFound')}</Text>
      </View>
    )
  }

  const allPhotos = (place as any).photos
    ?.filter((ph: any) => !ph.is_deleted)
    ?.sort((a: any, b: any) => {
      if (a.is_primary) return -1
      if (b.is_primary) return 1
      return a.position - b.position
    }) ?? []

  const photos = allPhotos.filter((ph: any) => !ph.is_menu)
  const menuPhotos = allPhotos.filter((ph: any) => ph.is_menu)

  const p = place!
  const primaryPhoto = photos[0]
  const saved = isFavorite(p.id)
  const description = lang === 'fr' ? p.description_fr : p.description_en
  const category = p.categories
  const zone = p.zones
  const openStatus = p.hours ? isOpenNow(p.hours) : null

  function handleWhatsApp() {
    const url = getWhatsAppUrl(p.whatsapp)
    if (url) {
      analytics.ctaWhatsappTapped(p.id, p.name)
      Linking.openURL(url)
    }
  }

  function handleCall() {
    if (!p.phone) return
    analytics.ctaCallTapped(p.id, p.name)
    Linking.openURL(`tel:${formatPhone(p.phone)}`)
  }

  function handleWebsite() {
    if (!p.website) return
    Linking.openURL(p.website)
  }

  function handleMap() {
    setRouteCoords([])
    setMapOpen(true)
  }

  // Decode Google's encoded polyline format into lat/lng array
  function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
    const points: { latitude: number; longitude: number }[] = []
    let index = 0, lat = 0, lng = 0
    while (index < encoded.length) {
      let shift = 0, result = 0, b: number
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
      lat += result & 1 ? ~(result >> 1) : result >> 1
      shift = 0; result = 0
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
      lng += result & 1 ? ~(result >> 1) : result >> 1
      points.push({ latitude: lat / 1e5, longitude: lng / 1e5 })
    }
    return points
  }

  function getDistance(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
    const R = 6371000
    const dLat = (b.latitude - a.latitude) * Math.PI / 180
    const dLng = (b.longitude - a.longitude) * Math.PI / 180
    const sin1 = Math.sin(dLat / 2)
    const sin2 = Math.sin(dLng / 2)
    const c = sin1 * sin1 + Math.cos(a.latitude * Math.PI / 180) * Math.cos(b.latitude * Math.PI / 180) * sin2 * sin2
    return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c))
  }

  function formatDistance(meters: number) {
    if (meters < 1000) return `${Math.round(meters)} m`
    return `${(meters / 1000).toFixed(1)} km`
  }

  function stripHtml(html: string) {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&#160;/g, ' ')
  }

  async function fetchDirections(origin: { latitude: number; longitude: number }) {
    if (!p.latitude || !p.longitude) return
    const dest = { latitude: p.latitude, longitude: p.longitude }
    setRouteLoading(true)

    const showStraightLine = () => {
      setRouteCoords([origin, dest])
      setRouteSteps([])
      const d = getDistance(origin, dest)
      setDistanceRemaining(formatDistance(d))
      mapRef.current?.fitToCoordinates([origin, dest], {
        edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
        animated: true,
      })
    }

    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${dest.latitude},${dest.longitude}&mode=driving&key=${apiKey}`
      const res = await fetch(url)
      const json = await res.json()
      const route = json.routes?.[0]
      if (json.status === 'OK' && route?.overview_polyline?.points) {
        const coords = decodePolyline(route.overview_polyline.points)
        setRouteCoords(coords)
        const steps = (route.legs?.[0]?.steps ?? []).map((s: any) => ({
          instruction: stripHtml(s.html_instructions ?? ''),
          distance: s.distance?.text ?? '',
        }))
        setRouteSteps(steps)
        const totalDist = route.legs?.[0]?.distance?.text ?? formatDistance(getDistance(origin, dest))
        setDistanceRemaining(totalDist)
        setCurrentStepIdx(0)
        mapRef.current?.fitToCoordinates([origin, dest, ...coords], {
          edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
          animated: true,
        })
      } else {
        showStraightLine()
      }
    } catch (_) {
      showStraightLine()
    } finally {
      setRouteLoading(false)
    }
  }

  async function handleDirections() {
    if (!p.latitude || !p.longitude) return
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return
    const loc = await Location.getCurrentPositionAsync({})
    const origin = { latitude: loc.coords.latitude, longitude: loc.coords.longitude }
    setUserCoords(origin)
    fetchDirections(origin)
  }

  async function handleNavigate() {
    if (!p.latitude || !p.longitude) return
    // Fetch route first if we don't have one
    if (routeCoords.length < 2) {
      await handleDirections()
    }
    setIsNavigating(true)
    setCurrentStepIdx(0)
    // Watch position and follow user on map
    locationWatchRef.current?.remove()
    locationWatchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 10 },
      (loc) => {
        const pos = { latitude: loc.coords.latitude, longitude: loc.coords.longitude }
        setUserCoords(pos)
        // Update distance remaining to destination
        if (p.latitude && p.longitude) {
          const d = getDistance(pos, { latitude: p.latitude, longitude: p.longitude })
          setDistanceRemaining(formatDistance(d))
          // Advance step if close enough to next step start
          setCurrentStepIdx(prev => {
            if (routeCoords.length > prev + 1) {
              const nextPt = routeCoords[prev + 1]
              if (getDistance(pos, nextPt) < 30) return Math.min(prev + 1, routeCoords.length - 1)
            }
            return prev
          })
        }
        // Follow user on map
        mapRef.current?.animateToRegion({
          ...pos,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }, 500)
      }
    )
  }

  function handleStopNavigation() {
    locationWatchRef.current?.remove()
    locationWatchRef.current = null
    setIsNavigating(false)
    setCurrentStepIdx(0)
    // Re-fit to show full route
    if (routeCoords.length > 1 && userCoords && p.latitude && p.longitude) {
      mapRef.current?.fitToCoordinates([userCoords, { latitude: p.latitude, longitude: p.longitude }], {
        edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
        animated: true,
      })
    }
  }

  function handleSave() {
    if (!session) {
      router.push('/auth/login')
      return
    }
    analytics.ctaSaveTapped(p.id, p.name, !saved)
    toggleFavorite.mutate(p.id)
  }

  async function handleShare() {
    analytics.ctaShareTapped(p.id, p.name)
    const description = lang === 'fr' ? p.description_fr : p.description_en
    const subtitle = description ? description.slice(0, 100) + (description.length > 100 ? '…' : '') : ''
    await Share.share({
      title: p.name,
      message: subtitle ? `${p.name} — ${subtitle}\nokili://place/${p.id}` : `${p.name}\nokili://place/${p.id}`,
    })
  }

  function handleOpenMapsChoice() {
    if (Platform.OS === 'ios') {
      const options = [
        lang === 'fr' ? 'Annuler' : 'Cancel',
        lang === 'fr' ? 'Navigation intégrée' : 'In-App Navigation',
        'Apple Maps',
        'Google Maps',
      ]
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0, title: lang === 'fr' ? 'Ouvrir dans…' : 'Open in…' },
        (idx) => {
          if (idx === 1) { setRouteCoords([]); setMapOpen(true) }
          else if (idx === 2) openAppleMaps()
          else if (idx === 3) openGoogleMaps()
        }
      )
    } else {
      setMapsSheetOpen(true)
    }
  }

  function openAppleMaps() {
    if (!p.latitude || !p.longitude) return
    const name = encodeURIComponent(p.name)
    Linking.openURL(`maps://?q=${name}&ll=${p.latitude},${p.longitude}`)
  }

  async function openGoogleMaps() {
    if (!p.latitude || !p.longitude) return
    const url = `comgooglemaps://?q=${p.latitude},${p.longitude}&center=${p.latitude},${p.longitude}`
    const canOpen = await Linking.canOpenURL(url)
    if (canOpen) {
      Linking.openURL(url)
    } else {
      // Fallback: open in browser
      Linking.openURL(`https://maps.google.com/?q=${p.latitude},${p.longitude}`)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          {primaryPhoto ? (
            <Image
              source={{ uri: photoUrl(primaryPhoto.storage_path) }}
              style={[StyleSheet.absoluteFill, styles.heroImg]}
              contentFit="cover"
            />
          ) : (
            <LinearGradient
              colors={['#ffdee9', '#b5fffc']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, styles.heroImg]}
            />
          )}

          {/* Dark gradient at bottom */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.35)']}
            style={styles.heroFade}
          />

          {/* Nav buttons row */}
          <View style={[styles.navRow, { top: insets.top + 12 }]}>
            <Pressable onPress={() => router.back()} style={styles.navBtn}>
              <BlurView intensity={60} tint="light" style={styles.navBtnBlur}>
                <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
              </BlurView>
            </Pressable>

            <View style={styles.navRight}>
              <Pressable style={styles.navBtn} onPress={handleShare}>
                <BlurView intensity={60} tint="light" style={styles.navBtnBlur}>
                  <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
                </BlurView>
              </Pressable>
              <Pressable onPress={handleSave} style={styles.navBtn}>
                <BlurView intensity={60} tint="light" style={styles.navBtnBlur}>
                  <Ionicons
                    name={saved ? 'heart' : 'heart-outline'}
                    size={20}
                    color={saved ? '#E8571A' : colors.textPrimary}
                  />
                </BlurView>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Overlapping content ── */}
        <View style={styles.overlapWrapper}>

          {/* Title card */}
          <View style={styles.titleCard}>
            {/* Badge row */}
            <View style={styles.badgeRow}>
              {openStatus !== null && (
                <View style={[styles.badge, openStatus ? styles.badgeOpen : styles.badgeClosed]}>
                  <View style={[styles.badgeDot, openStatus ? styles.badgeDotOpen : styles.badgeDotClosed]} />
                  <Text style={[styles.badgeText, openStatus ? styles.badgeTextOpen : styles.badgeTextClosed]}>
                    {openStatus ? (lang === 'fr' ? 'Ouvert' : 'Open') : (lang === 'fr' ? 'Fermé' : 'Closed')}
                  </Text>
                </View>
              )}
              {category && (
                <View style={styles.badge}>
                  <Text style={styles.badgeTextGray}>
                    {lang === 'fr' ? category.name_fr : category.name_en}
                  </Text>
                </View>
              )}
              {p.price_range && (
                <View style={styles.badge}>
                  <Text style={styles.badgeTextGray}>
                    {PRICE_LABEL[p.price_range][lang]}
                  </Text>
                </View>
              )}
            </View>

            {/* Place name */}
            <Text style={styles.placeName}>{p.name}</Text>

            {/* Rating row */}
            <View style={styles.ratingRow}>
              {reviewsData && reviewsData.count > 0 ? (
                <>
                  <Ionicons name="star" size={14} color="#FF9500" />
                  <Text style={styles.ratingValue}>{reviewsData.average!.toFixed(1)}</Text>
                  <Text style={styles.ratingCount}>
                    ({reviewsData.count} {lang === 'fr' ? 'avis' : 'reviews'})
                  </Text>
                </>
              ) : (
                <Text style={styles.ratingCount}>
                  {lang === 'fr' ? 'Aucun avis' : 'No reviews yet'}
                </Text>
              )}
              {zone && (
                <>
                  <View style={styles.ratingDivider} />
                  <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.ratingZone}>{zone.name}</Text>
                </>
              )}
            </View>
          </View>

          {/* ── Action buttons ── */}
          <View style={styles.actionGrid}>
            {p.phone && (
              <Pressable style={styles.actionItem} onPress={handleCall}>
                <View style={styles.actionCircle}>
                  <Ionicons name="call-outline" size={22} color={colors.textPrimary} />
                </View>
                <Text style={styles.actionLabel}>{lang === 'fr' ? 'Appeler' : 'Call'}</Text>
              </Pressable>
            )}
            {(p.address || (p.latitude && p.longitude)) && (
              <Pressable style={styles.actionItem} onPress={handleOpenMapsChoice}>
                <View style={styles.actionCircle}>
                  <Ionicons name="map-outline" size={22} color={colors.textPrimary} />
                </View>
                <Text style={styles.actionLabel}>{lang === 'fr' ? 'Carte' : 'Map'}</Text>
              </Pressable>
            )}
            {p.website && (
              <Pressable style={styles.actionItem} onPress={handleWebsite}>
                <View style={styles.actionCircle}>
                  <Ionicons name="globe-outline" size={22} color={colors.textPrimary} />
                </View>
                <Text style={styles.actionLabel}>Web</Text>
              </Pressable>
            )}
            {p.whatsapp && (
              <Pressable style={styles.actionItem} onPress={handleWhatsApp}>
                <View style={[styles.actionCircle, styles.actionCircleWA]}>
                  <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                </View>
                <Text style={styles.actionLabel}>Chat</Text>
              </Pressable>
            )}
          </View>

          {/* ── About ── */}
          {description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{lang === 'fr' ? 'À propos' : 'About'}</Text>
              <Text style={styles.description}>{description}</Text>
            </View>
          )}

          {/* ── Details ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{lang === 'fr' ? 'Détails' : 'Details'}</Text>

            {/* Hours card */}
            {p.hours && (
              <View style={styles.detailCard}>
                <Pressable
                  style={styles.detailCardRow}
                  onPress={() => setHoursOpen(o => !o)}
                >
                  <View style={styles.detailIconWrap}>
                    <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                  </View>
                  <Text style={styles.detailLabel}>
                    {lang === 'fr' ? 'Horaires' : 'Hours'}
                  </Text>
                  <Ionicons
                    name={hoursOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textSecondary}
                  />
                </Pressable>

                {hoursOpen && (
                  <View style={styles.hoursTable}>
                    {DAY_KEYS.map(day => {
                      const h = (p.hours as any)?.[day]
                      return (
                        <View key={day} style={styles.hoursTableRow}>
                          <Text style={styles.dayLabel}>{DAY_LABELS[day][lang]}</Text>
                          <Text style={styles.dayHours}>
                            {h?.closed
                              ? (lang === 'fr' ? 'Fermé' : 'Closed')
                              : h
                              ? `${h.open} – ${h.close}${h.overnight ? (lang === 'fr' ? ' (nuit)' : ' (late)') : ''}`
                              : '–'}
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Address card */}
            {p.address && (
              <View style={[styles.detailCard, { marginTop: 10 }]}>
                <Pressable style={styles.detailCardRow} onPress={handleOpenMapsChoice}>
                  <View style={styles.detailIconWrap}>
                    <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
                  </View>
                  <Text style={[styles.detailLabel, { flex: 1 }]} numberOfLines={2}>{p.address}</Text>
                  <Ionicons name="open-outline" size={15} color="#E8571A" />
                </Pressable>
              </View>
            )}
          </View>

          {/* ── Photos ── */}
          {photos.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>{lang === 'fr' ? 'Photos' : 'Photos'}</Text>
                {photos.length > 3 && (
                  <Pressable>
                    <Text style={styles.seeAll}>{lang === 'fr' ? 'Voir tout' : 'See all'}</Text>
                  </Pressable>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {photos.map((ph: any, idx: number) => (
                  <View key={ph.id ?? idx} style={styles.photoThumb}>
                    <Image
                      source={{ uri: photoUrl(ph.storage_path) }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Menu ── */}
          {menuPhotos.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{lang === 'fr' ? 'Menu' : 'Menu'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {menuPhotos.map((ph: any, idx: number) => (
                  <View key={ph.id ?? idx} style={styles.menuThumb}>
                    <Image
                      source={{ uri: photoUrl(ph.storage_path) }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Reviews ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                {lang === 'fr' ? 'Avis' : 'Reviews'}
                {reviewsData && reviewsData.count > 0 && (
                  <Text style={styles.reviewCount}> ({reviewsData.count})</Text>
                )}
              </Text>
              {session && !userReview && !reviewFormOpen && (
                <Pressable onPress={() => { setReviewRating(0); setReviewComment(''); setReviewFormOpen(true) }}>
                  <Text style={styles.seeAll}>{lang === 'fr' ? '+ Avis' : '+ Review'}</Text>
                </Pressable>
              )}
            </View>

            {/* Login prompt */}
            {!session && (
              <Pressable style={styles.reviewLoginPrompt} onPress={() => router.push('/auth/login')}>
                <Ionicons name="star-outline" size={18} color="#E8571A" />
                <Text style={styles.reviewLoginText}>
                  {lang === 'fr' ? 'Connectez-vous pour laisser un avis' : 'Log in to leave a review'}
                </Text>
              </Pressable>
            )}

            {/* Review form */}
            {session && (reviewFormOpen || userReview) && (
              <View style={styles.reviewForm}>
                <Text style={styles.reviewFormLabel}>
                  {userReview
                    ? (lang === 'fr' ? 'Votre avis' : 'Your review')
                    : (lang === 'fr' ? 'Laisser un avis' : 'Leave a review')}
                </Text>
                {/* Star picker */}
                <View style={styles.starRow}>
                  {[1,2,3,4,5].map(star => (
                    <Pressable key={star} onPress={() => setReviewRating(star)} hitSlop={6}>
                      <Ionicons
                        name={star <= (reviewFormOpen ? reviewRating : (userReview?.rating ?? 0)) ? 'star' : 'star-outline'}
                        size={28}
                        color="#FF9500"
                      />
                    </Pressable>
                  ))}
                </View>
                {reviewFormOpen && (
                  <>
                    <TextInput
                      style={styles.reviewInput}
                      placeholder={lang === 'fr' ? 'Commentaire (optionnel)' : 'Comment (optional)'}
                      placeholderTextColor={colors.textPlaceholder}
                      value={reviewComment}
                      onChangeText={setReviewComment}
                      multiline
                      numberOfLines={3}
                    />
                    <View style={styles.reviewFormButtons}>
                      <Pressable style={styles.reviewCancelBtn} onPress={() => setReviewFormOpen(false)}>
                        <Text style={styles.reviewCancelText}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.reviewSubmitBtn, reviewRating === 0 && { opacity: 0.4 }]}
                        disabled={reviewRating === 0 || submitReview.isPending}
                        onPress={() => {
                          submitReview.mutate(
                            { rating: reviewRating, comment: reviewComment || undefined },
                            { onSuccess: () => setReviewFormOpen(false) }
                          )
                        }}
                      >
                        {submitReview.isPending
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={styles.reviewSubmitText}>{lang === 'fr' ? 'Publier' : 'Submit'}</Text>
                        }
                      </Pressable>
                    </View>
                  </>
                )}
                {/* Edit / Delete buttons when not in edit mode */}
                {!reviewFormOpen && userReview && (
                  <View style={styles.reviewFormButtons}>
                    <Pressable style={styles.reviewCancelBtn} onPress={() => {
                      setReviewRating(userReview.rating)
                      setReviewComment(userReview.comment ?? '')
                      setReviewFormOpen(true)
                    }}>
                      <Text style={styles.reviewCancelText}>{lang === 'fr' ? 'Modifier' : 'Edit'}</Text>
                    </Pressable>
                    <Pressable style={[styles.reviewCancelBtn, { borderColor: '#FF3B30' }]} onPress={() => deleteReview.mutate()}>
                      <Text style={[styles.reviewCancelText, { color: '#FF3B30' }]}>{lang === 'fr' ? 'Supprimer' : 'Delete'}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            {/* Reviews list */}
            {(reviewsData?.reviews ?? []).map(review => {
              const isOwn = review.profiles?.id === session?.user.id
              const name = review.profiles?.full_name ?? (lang === 'fr' ? 'Utilisateur' : 'User')
              const initial = name.charAt(0).toUpperCase()
              const date = new Date(review.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', year: 'numeric' })
              return (
                <View key={review.id} style={[styles.reviewCard, isOwn && styles.reviewCardOwn]}>
                  <View style={styles.reviewCardHeader}>
                    <View style={styles.reviewAvatar}>
                      <Text style={styles.reviewAvatarText}>{initial}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewName}>{isOwn ? (lang === 'fr' ? 'Vous' : 'You') : name}</Text>
                      <Text style={styles.reviewDate}>{date}</Text>
                    </View>
                    <View style={styles.reviewStars}>
                      {[1,2,3,4,5].map(s => (
                        <Ionicons key={s} name={s <= review.rating ? 'star' : 'star-outline'} size={12} color="#FF9500" />
                      ))}
                    </View>
                  </View>
                  {review.comment && (
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                  )}
                </View>
              )
            })}

            {reviewsData?.count === 0 && !reviewFormOpen && (
              <Text style={styles.noReviewsText}>
                {lang === 'fr' ? 'Soyez le premier à laisser un avis.' : 'Be the first to leave a review.'}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Map bottom sheet ── */}
      <Modal
        visible={mapOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMapOpen(false)}
      >
        <View style={styles.mapSheet}>
          {/* Handle + header */}
          <View style={styles.mapSheetHeader}>
            <View style={styles.mapSheetHandle} />
            <Text style={styles.mapSheetTitle}>{p.name}</Text>
            {p.address && (
              <Text style={styles.mapSheetAddress} numberOfLines={2}>{p.address}</Text>
            )}
          </View>

          {/* Map */}
          {(p.latitude && p.longitude) ? (
            <View style={styles.mapSheetMap}>
              <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                initialRegion={{
                  latitude: p.latitude,
                  longitude: p.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={!isNavigating}
                zoomEnabled
                showsCompass={false}
                showsUserLocation
              >
                {/* Destination pin */}
                <Marker coordinate={{ latitude: p.latitude, longitude: p.longitude }}>
                  <View style={styles.mapPin}>
                    <Ionicons name="location" size={32} color="#E8571A" />
                  </View>
                </Marker>

                {/* Route polyline */}
                {routeCoords.length > 1 && (
                  <Polyline
                    coordinates={routeCoords}
                    strokeColor="#E8571A"
                    strokeWidth={4}
                    lineDashPattern={routeCoords.length === 2 ? [8, 6] : undefined}
                  />
                )}
              </MapView>

              {/* Navigation banner */}
              {isNavigating && (
                <View style={styles.navBanner}>
                  <View style={styles.navBannerLeft}>
                    <Ionicons name="navigate" size={18} color="#fff" />
                    <View>
                      <Text style={styles.navBannerStep} numberOfLines={2}>
                        {routeSteps[currentStepIdx]?.instruction || p.name}
                      </Text>
                      {distanceRemaining && (
                        <Text style={styles.navBannerDist}>{distanceRemaining} {lang === 'fr' ? 'restants' : 'remaining'}</Text>
                      )}
                    </View>
                  </View>
                  <Pressable onPress={handleStopNavigation} style={styles.navBannerStop}>
                    <Ionicons name="close" size={16} color="#fff" />
                  </Pressable>
                </View>
              )}

              {/* Distance pill (when route drawn but not navigating) */}
              {!isNavigating && distanceRemaining && routeCoords.length > 1 && (
                <View style={styles.mapDistancePill}>
                  <Ionicons name="navigate-outline" size={13} color="#E8571A" />
                  <Text style={styles.mapDistancePillText}>{distanceRemaining}</Text>
                </View>
              )}

              {/* Route loading spinner overlay */}
              {routeLoading && (
                <View style={styles.mapLoadingOverlay}>
                  <ActivityIndicator color="#E8571A" />
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.mapSheetMap, styles.mapNoCoords]}>
              <Ionicons name="map-outline" size={40} color={colors.iconMuted} />
              <Text style={styles.mapNoCoordsText}>
                {lang === 'fr' ? 'Coordonnées non disponibles' : 'Coordinates not available'}
              </Text>
            </View>
          )}

          {/* Footer actions */}
          <View style={[styles.mapSheetFooter, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <Pressable style={styles.mapSheetClose} onPress={() => setMapOpen(false)}>
              <Text style={styles.mapSheetCloseText}>
                {lang === 'fr' ? 'Fermer' : 'Close'}
              </Text>
            </Pressable>
            {p.latitude && p.longitude && !isNavigating && (
              <Pressable
                style={[styles.mapSheetDirections, routeLoading && { opacity: 0.6 }]}
                onPress={handleDirections}
                disabled={routeLoading}
              >
                {routeLoading ? (
                  <ActivityIndicator size="small" color="#E8571A" />
                ) : (
                  <Ionicons name="navigate-outline" size={16} color="#E8571A" />
                )}
                <Text style={styles.mapSheetDirectionsText}>
                  {routeCoords.length > 1
                    ? (lang === 'fr' ? 'Recalculer' : 'Recalculate')
                    : (lang === 'fr' ? 'Itinéraire' : 'Directions')}
                </Text>
              </Pressable>
            )}
            {p.latitude && p.longitude && !isNavigating && (
              <Pressable
                style={[styles.mapSheetNavigate, routeLoading && { opacity: 0.6 }]}
                onPress={handleNavigate}
                disabled={routeLoading}
              >
                <Ionicons name="car-outline" size={16} color="#fff" />
                <Text style={styles.mapSheetNavigateText}>
                  {lang === 'fr' ? 'Démarrer' : 'Navigate'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Maps Choice Sheet (Android) ── */}
      <Modal
        visible={mapsSheetOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setMapsSheetOpen(false)}
      >
        <Pressable style={styles.mapsOverlay} onPress={() => setMapsSheetOpen(false)}>
          <View style={[styles.mapsSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <Text style={styles.mapsSheetTitle}>{lang === 'fr' ? 'Ouvrir dans…' : 'Open in…'}</Text>
            <Pressable style={styles.mapsOption} onPress={() => { setMapsSheetOpen(false); setRouteCoords([]); setMapOpen(true) }}>
              <Ionicons name="navigate-outline" size={22} color={colors.textPrimary} />
              <Text style={styles.mapsOptionText}>{lang === 'fr' ? 'Navigation intégrée' : 'In-App Navigation'}</Text>
            </Pressable>
            <Pressable style={styles.mapsOption} onPress={() => { setMapsSheetOpen(false); openAppleMaps() }}>
              <Ionicons name="map-outline" size={22} color={colors.textPrimary} />
              <Text style={styles.mapsOptionText}>Apple Maps</Text>
            </Pressable>
            <Pressable style={styles.mapsOption} onPress={() => { setMapsSheetOpen(false); openGoogleMaps() }}>
              <Ionicons name="map" size={22} color="#4285F4" />
              <Text style={styles.mapsOptionText}>Google Maps</Text>
            </Pressable>
            <Pressable style={[styles.mapsOption, { marginTop: 8 }]} onPress={() => setMapsSheetOpen(false)}>
              <Text style={[styles.mapsOptionText, { color: colors.textSecondary }]}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── Bottom CTA ── */}
      <View style={[styles.ctaWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {p.whatsapp ? (
          <Pressable style={styles.ctaBtn} onPress={handleWhatsApp}>
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={styles.ctaBtnText}>
              {lang === 'fr' ? 'Contacter sur WhatsApp' : 'Contact on WhatsApp'}
            </Text>
          </Pressable>
        ) : p.phone ? (
          <Pressable style={styles.ctaBtn} onPress={handleCall}>
            <Ionicons name="call-outline" size={20} color="#fff" />
            <Text style={styles.ctaBtnText}>
              {lang === 'fr' ? 'Appeler' : 'Call'}
            </Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.ctaBtn, saved ? styles.ctaBtnSaved : null]} onPress={handleSave}>
            <Ionicons name={saved ? 'heart' : 'heart-outline'} size={20} color="#fff" />
            <Text style={styles.ctaBtnText}>
              {saved
                ? (lang === 'fr' ? 'Enregistré' : 'Saved')
                : (lang === 'fr' ? 'Enregistrer' : 'Save')}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: c.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero
  hero: {
    width,
    height: HERO_HEIGHT,
    backgroundColor: c.shimmer,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  heroImg: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  navRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navRight: {
    flexDirection: 'row',
    gap: 10,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  navBtnBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Overlapping content
  overlapWrapper: {
    marginTop: -40,
    paddingHorizontal: 20,
    gap: 16,
  },

  // Title card
  titleCard: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    gap: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: c.surfaceBorder,
  },
  badgeOpen:   { backgroundColor: 'rgba(52,199,89,0.12)' },
  badgeClosed: { backgroundColor: 'rgba(255,59,48,0.1)' },
  badgeDot:      { width: 6, height: 6, borderRadius: 3 },
  badgeDotOpen:  { backgroundColor: '#34C759' },
  badgeDotClosed:{ backgroundColor: '#FF3B30' },
  badgeText:     { fontSize: 13, fontWeight: '600' },
  badgeTextOpen: { color: '#34C759' },
  badgeTextClosed:{ color: '#FF3B30' },
  badgeTextGray: { fontSize: 13, fontWeight: '500', color: c.textSecondary },

  placeName: {
    fontSize: 26,
    fontWeight: '800',
    color: c.textPrimary,
    letterSpacing: -0.5,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: '700',
    color: c.textPrimary,
  },
  ratingCount: {
    fontSize: 13,
    color: c.textSecondary,
  },
  ratingDivider: {
    width: 1,
    height: 12,
    backgroundColor: c.separator,
    marginHorizontal: 2,
  },
  ratingZone: {
    fontSize: 13,
    color: c.textSecondary,
  },

  // Action grid
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 4,
  },
  actionItem: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  actionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  actionCircleWA: {
    backgroundColor: 'rgba(37,211,102,0.1)',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: c.textSecondary,
    textAlign: 'center',
  },

  // Sections
  section: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: c.textPrimary,
  },
  seeAll: {
    fontSize: 14,
    color: '#E8571A',
    fontWeight: '500',
  },
  description: {
    fontSize: 15,
    color: c.textSecondary,
    lineHeight: 22,
  },

  // Detail cards
  detailCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.surfaceBorder,
  },
  detailCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  detailIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: c.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: c.textPrimary,
  },
  hoursTable: {
    borderTopWidth: 1,
    borderTopColor: c.separator,
    paddingVertical: 4,
  },
  hoursTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  dayLabel: {
    fontSize: 14,
    color: c.textPrimary,
    fontWeight: '500',
  },
  dayHours: {
    fontSize: 14,
    color: c.textSecondary,
  },

  // Photos
  photoThumb: {
    width: 140,
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: c.thumbFallback,
  },
  menuThumb: {
    width: 200,
    height: 260,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: c.thumbFallback,
  },

  // Reviews
  reviewCount: {
    fontSize: 17,
    fontWeight: '400',
    color: c.textSecondary,
  },
  reviewLoginPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(232,87,26,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(232,87,26,0.15)',
  },
  reviewLoginText: {
    fontSize: 14,
    color: '#E8571A',
    fontWeight: '500',
  },
  reviewForm: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
  },
  reviewFormLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: c.textPrimary,
  },
  starRow: {
    flexDirection: 'row',
    gap: 6,
  },
  reviewInput: {
    backgroundColor: c.inputBg,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: c.inputText,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  reviewFormButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  reviewCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.surfaceBorder,
  },
  reviewCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: c.textPrimary,
  },
  reviewSubmitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#E8571A',
  },
  reviewSubmitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  reviewCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
  },
  reviewCardOwn: {
    borderColor: 'rgba(232,87,26,0.2)',
    backgroundColor: c.surfaceElevated,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(232,87,26,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E8571A',
  },
  reviewName: {
    fontSize: 14,
    fontWeight: '600',
    color: c.textPrimary,
  },
  reviewDate: {
    fontSize: 12,
    color: c.textSecondary,
    marginTop: 1,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 14,
    color: c.textSecondary,
    lineHeight: 20,
  },
  noReviewsText: {
    fontSize: 14,
    color: c.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
  },

  // Map bottom sheet
  mapSheet: {
    flex: 1,
    backgroundColor: c.bgPrimary,
  },
  mapSheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: c.surfaceElevated,
    alignItems: 'center',
    gap: 6,
  },
  mapSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.sheetHandle,
    marginBottom: 8,
  },
  mapSheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: c.textPrimary,
    textAlign: 'center',
  },
  mapSheetAddress: {
    fontSize: 13,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  mapSheetMap: {
    flex: 1,
  },
  mapPin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapNoCoords: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: c.shimmer,
  },
  mapNoCoordsText: {
    fontSize: 14,
    color: c.textSecondary,
  },
  mapSheetFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: c.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: c.separator,
  },
  mapSheetClose: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: c.inputBg,
    alignItems: 'center',
  },
  mapSheetCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: c.textPrimary,
  },
  mapSheetDirections: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(232,87,26,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(232,87,26,0.25)',
  },
  mapSheetDirectionsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E8571A',
  },
  mapSheetNavigate: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: c.surfaceInverted,
  },
  mapSheetNavigateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  // Navigation banner (top of map during active navigation)
  navBanner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1A1A1E',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  navBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navBannerStep: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    flexShrink: 1,
  },
  navBannerDist: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  navBannerStop: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Distance pill (route drawn, not navigating)
  mapDistancePill: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  mapDistancePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E8571A',
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },

  // Bottom CTA
  ctaWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: c.bgPrimary,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 28,
    backgroundColor: c.surfaceInverted,
  },
  ctaBtnSaved: {
    backgroundColor: '#E8571A',
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // Maps choice sheet (Android)
  mapsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  mapsSheet: {
    backgroundColor: c.bgPrimary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  mapsSheetTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: c.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mapsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: c.separator,
  },
  mapsOptionText: {
    fontSize: 16,
    color: c.textPrimary,
    fontWeight: '500',
  },
  })
}

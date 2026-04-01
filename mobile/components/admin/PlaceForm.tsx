import { Ionicons } from '@expo/vector-icons'
import { decode } from 'base64-arraybuffer'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'

import { useCategories } from '../../hooks/useCategories'
import { useZones } from '../../hooks/useZones'
import { usePlace } from '../../hooks/usePlace'
import { supabase } from '../../lib/supabase'

const DAY_KEYS = ['mon','tue','wed','thu','fri','sat','sun'] as const
const DAY_LABELS: Record<string, { fr: string; en: string }> = {
  mon: { fr: 'Lun', en: 'Mon' },
  tue: { fr: 'Mar', en: 'Tue' },
  wed: { fr: 'Mer', en: 'Wed' },
  thu: { fr: 'Jeu', en: 'Thu' },
  fri: { fr: 'Ven', en: 'Fri' },
  sat: { fr: 'Sam', en: 'Sat' },
  sun: { fr: 'Dim', en: 'Sun' },
}

// CFA price range guidance
const PRICE_LABELS = {
  1: { fr: 'Économique', en: 'Budget', hint: '< 5 000 FCFA' },
  2: { fr: 'Intermédiaire', en: 'Mid-range', hint: '5 000–20 000 FCFA' },
  3: { fr: 'Haut de gamme', en: 'Upscale', hint: '> 20 000 FCFA' },
} as const

type DayHours = { open: string; close: string; overnight: boolean; closed: boolean }
type Hours = Record<string, DayHours>

const DEFAULT_DAY: DayHours = { open: '09:00', close: '22:00', overnight: false, closed: false }

interface Props {
  mode: 'create' | 'edit'
  placeId?: string
}

export function PlaceForm({ mode, placeId }: Props) {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const queryClient = useQueryClient()

  const { data: categories } = useCategories()
  const { data: zones } = useZones()
  const { data: existing } = usePlace(placeId ?? '')

  // Basic fields
  const [name, setName]             = useState('')
  const [descFr, setDescFr]         = useState('')
  const [descEn, setDescEn]         = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [zoneId, setZoneId]         = useState('')
  const [priceRange, setPriceRange] = useState<1|2|3>(2)
  const [phone, setPhone]           = useState('')
  const [whatsapp, setWhatsapp]     = useState('')
  const [address, setAddress]       = useState('')
  const [website, setWebsite]       = useState('')
  // New places default to INACTIVE — prevents incomplete listings going live accidentally
  const [isActive, setIsActive]         = useState(mode === 'edit')
  // Promotion — paid feature, admin-controlled
  const [isPromoted, setIsPromoted]         = useState(false)
  const [promotedLabelFr, setPromotedLabelFr] = useState('')
  const [promotedLabelEn, setPromotedLabelEn] = useState('')

  // Location
  const [latitude, setLatitude]   = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [locLoading, setLocLoading] = useState(false)
  const [locationLink, setLocationLink] = useState('')

  // Hours
  const [hours, setHours] = useState<Hours>(() =>
    Object.fromEntries(DAY_KEYS.map(d => [d, { ...DEFAULT_DAY }]))
  )

  // Gallery photos
  const [photos, setPhotos] = useState<{ uri: string; isNew: boolean; isPrimary: boolean; storageId?: string; storagePath?: string }[]>([])
  // Menu photos
  const [menuPhotos, setMenuPhotos] = useState<{ uri: string; isNew: boolean; storageId?: string; storagePath?: string }[]>([])
  // IDs of existing DB photo records to soft-delete on save
  const [deletedPhotoIds, setDeletedPhotoIds] = useState<string[]>([])
  // Video — one per place
  const [video, setVideo] = useState<{ uri: string; isNew: boolean; videoId?: string; storagePath?: string; duration?: number } | null>(null)
  const [deletedVideoId, setDeletedVideoId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Pre-fill when editing
  useEffect(() => {
    if (mode === 'edit' && existing) {
      const p = existing as any
      setName(p.name ?? '')
      setDescFr(p.description_fr ?? '')
      setDescEn(p.description_en ?? '')
      setCategoryId(p.category_id ?? '')
      setZoneId(p.zone_id ?? '')
      setPriceRange((p.price_range ?? 2) as 1|2|3)
      setPhone(p.phone ?? '')
      setWhatsapp(p.whatsapp ?? '')
      setAddress(p.address ?? '')
      setWebsite(p.website ?? '')
      setIsActive(p.is_active ?? false)
      setIsPromoted(p.is_promoted ?? false)
      setPromotedLabelFr(p.promoted_label_fr ?? '')
      setPromotedLabelEn(p.promoted_label_en ?? '')
      if (p.latitude) setLatitude(p.latitude)
      if (p.longitude) setLongitude(p.longitude)
      if (p.hours) {
        setHours(Object.fromEntries(
          DAY_KEYS.map(d => [d, { ...DEFAULT_DAY, ...(p.hours[d] ?? { closed: true }) }])
        ))
      }
      if (p.photos?.length) {
        const gallery = p.photos.filter((ph: any) => !ph.is_menu)
        const menu = p.photos.filter((ph: any) => ph.is_menu)
        setPhotos(gallery.map((ph: any) => ({
          uri: supabase.storage.from('place-photos').getPublicUrl(ph.storage_path).data.publicUrl,
          isNew: false,
          isPrimary: ph.is_primary,
          storageId: ph.id,
          storagePath: ph.storage_path,
        })))
        setMenuPhotos(menu.map((ph: any) => ({
          uri: supabase.storage.from('place-photos').getPublicUrl(ph.storage_path).data.publicUrl,
          isNew: false,
          storageId: ph.id,
          storagePath: ph.storage_path,
        })))
      }
      const sortedVideos = [...(p.videos ?? [])].sort((a: any, b: any) => a.position - b.position)
      if (sortedVideos.length > 0) {
        const v = sortedVideos[0]
        setVideo({
          uri: supabase.storage.from('place-videos').getPublicUrl(v.storage_path).data.publicUrl,
          isNew: false,
          videoId: v.id,
          storagePath: v.storage_path,
        })
      }
    }
  }, [existing, mode])

  function updateDay(day: string, field: keyof DayHours, value: any) {
    setHours(h => ({ ...h, [day]: { ...h[day], [field]: value } }))
  }

  // Parses coordinates from a Google Maps, Apple Maps, or WhatsApp location share link.
  // Handles the most common real-world share formats.
  function parseLocationLink(link: string): { lat: number; lng: number } | null {
    const patterns = [
      // Google Maps short: maps.google.com/?q=lat,lng
      /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      // Google Maps long: /@lat,lng,zoom
      /\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      // Apple Maps: ?ll=lat,lng
      /[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      // Generic fallback: two decimal coords in URL
      /(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/,
    ]
    for (const re of patterns) {
      const m = link.match(re)
      if (m) {
        const lat = parseFloat(m[1])
        const lng = parseFloat(m[2])
        if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          return { lat, lng }
        }
      }
    }
    return null
  }

  async function applyLocationLink() {
    const raw = locationLink.trim()
    // Try direct parse first (works for full Google Maps / Apple Maps URLs)
    let result = parseLocationLink(raw)

    // If that fails, follow redirects — handles maps.app.goo.gl and other short links
    if (!result) {
      setLocLoading(true)
      try {
        const response = await fetch(raw, { method: 'GET' })
        // response.url is the final URL after all redirects
        result = parseLocationLink(response.url)
      } catch {
        // network error — fall through to show error message
      } finally {
        setLocLoading(false)
      }
    }

    if (!result) {
      setErrors(e => ({
        ...e,
        locationLink: lang === 'fr'
          ? 'Lien non reconnu. Essayez un lien Google Maps ou Apple Plans.'
          : 'Link not recognized. Try a Google Maps or Apple Maps link.',
      }))
      return
    }
    setLatitude(result.lat)
    setLongitude(result.lng)
    setLocationLink('')
    setErrors(e => ({ ...e, locationLink: '', location: '' }))
  }

  // GPS capture — admin walks to the restaurant and taps this button
  async function captureLocation() {
    setLocLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          lang === 'fr' ? 'Permission refusée' : 'Permission denied',
          lang === 'fr'
            ? 'Activez la localisation dans les réglages pour utiliser cette fonctionnalité.'
            : 'Enable location in settings to use this feature.'
        )
        return
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      setLatitude(loc.coords.latitude)
      setLongitude(loc.coords.longitude)
      setErrors(e => ({ ...e, location: '' }))
    } catch {
      Alert.alert(lang === 'fr' ? 'Erreur GPS' : 'GPS error',
        lang === 'fr' ? 'Impossible d\'obtenir la position.' : 'Could not get location.')
    } finally {
      setLocLoading(false)
    }
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    })
    if (result.canceled) return
    const asset = result.assets[0]
    const compressed = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    )
    setPhotos(prev => [...prev, { uri: compressed.uri, isNew: true, isPrimary: prev.length === 0 }])
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') return
    const result = await ImagePicker.launchCameraAsync({ quality: 1 })
    if (result.canceled) return
    const asset = result.assets[0]
    const compressed = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    )
    setPhotos(prev => [...prev, { uri: compressed.uri, isNew: true, isPrimary: prev.length === 0 }])
  }

  function removePhoto(idx: number) {
    setPhotos(prev => {
      const photo = prev[idx]
      if (!photo.isNew && photo.storageId) {
        setDeletedPhotoIds(ids => [...ids, photo.storageId!])
      }
      const updated = prev.filter((_, i) => i !== idx)
      if (photo.isPrimary && updated.length > 0) updated[0].isPrimary = true
      return updated
    })
  }

  function setPrimary(idx: number) {
    setPhotos(prev => prev.map((p, i) => ({ ...p, isPrimary: i === idx })))
  }

  async function pickMenuPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    })
    if (result.canceled) return
    const asset = result.assets[0]
    const compressed = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    )
    setMenuPhotos(prev => [...prev, { uri: compressed.uri, isNew: true }])
  }

  async function takeMenuPhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') return
    const result = await ImagePicker.launchCameraAsync({ quality: 1 })
    if (result.canceled) return
    const asset = result.assets[0]
    const compressed = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    )
    setMenuPhotos(prev => [...prev, { uri: compressed.uri, isNew: true }])
  }

  function removeMenuPhoto(idx: number) {
    setMenuPhotos(prev => {
      const photo = prev[idx]
      if (!photo.isNew && photo.storageId) {
        setDeletedPhotoIds(ids => [...ids, photo.storageId!])
      }
      return prev.filter((_, i) => i !== idx)
    })
  }

  async function pickVideo() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    })
    if (result.canceled) return
    const asset = result.assets[0]
    // Queue existing video for deletion when replacing
    if (video && !video.isNew && video.videoId) {
      setDeletedVideoId(video.videoId)
    }
    setVideo({ uri: asset.uri, isNew: true, duration: asset.duration ?? undefined })
  }

  function removeVideo() {
    if (video && !video.isNew && video.videoId) {
      setDeletedVideoId(video.videoId)
    }
    setVideo(null)
  }

  function normalizePhone(value: string): string {
    // Strip all non-digits
    const digits = value.replace(/\D/g, '')
    if (!digits) return value
    // Already international (241XXXXXXXX)
    if (digits.startsWith('241') && digits.length >= 11) return `+${digits}`
    // Local format (0XXXXXXXXX)
    if (digits.startsWith('0') && digits.length >= 9) return `+241${digits.slice(1)}`
    // 8-digit without prefix
    if (digits.length === 8) return `+241${digits}`
    return value
  }

  function validatePhone(value: string): string | null {
    if (!value.trim()) return null
    const digits = value.replace(/\D/g, '')
    if (digits.length < 8 || digits.length > 12) {
      return lang === 'fr'
        ? 'Numéro invalide. Ex: 077 12 34 56 ou +241 77 12 34 56'
        : 'Invalid number. Ex: 077 12 34 56 or +241 77 12 34 56'
    }
    return null
  }

  function normalizeWebsite(value: string): string {
    const v = value.trim()
    if (!v) return v
    if (/^https?:\/\//i.test(v)) return v
    if (v.startsWith('www.')) return `https://${v}`
    // bare domain or path — prepend https
    if (v.includes('.') || v.startsWith('@')) return `https://${v}`
    return v
  }

  function validateWebsite(value: string): string | null {
    if (!value.trim()) return null
    const v = normalizeWebsite(value)
    // Must be https://something.tld — requires at least one dot after the protocol+host
    if (!/^https?:\/\/[^/]+\.[^/]{2,}/.test(v)) {
      return lang === 'fr'
        ? 'Lien invalide. Ex: instagram.com/lepatio ou https://lepatio.ga'
        : 'Invalid link. Ex: instagram.com/lepatio or https://lepatio.ga'
    }
    return null
  }

  function validateTimeFormat(value: string): boolean {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = lang === 'fr' ? 'Le nom est requis' : 'Name is required'
    } else if (name.trim().length < 2) {
      newErrors.name = lang === 'fr' ? 'Minimum 2 caractères' : 'Minimum 2 characters'
    } else if (name.trim().length > 100) {
      newErrors.name = lang === 'fr' ? 'Maximum 100 caractères' : 'Maximum 100 characters'
    }

    if (address.trim().length > 300) {
      newErrors.address = lang === 'fr' ? 'Maximum 300 caractères' : 'Maximum 300 characters'
    }

    // TODO (pre-launch): re-enable Gabon bounding box check once development is done
    // if (latitude !== null && longitude !== null) {
    //   const inGabon = latitude >= -4 && latitude <= 2.5 && longitude >= 8.5 && longitude <= 14.5
    //   if (!inGabon) newErrors.location = '...'
    // }

    if (!categoryId) {
      newErrors.category = lang === 'fr' ? 'Sélectionnez une catégorie' : 'Select a category'
    }

    if (!zoneId) {
      newErrors.zone = lang === 'fr' ? 'Sélectionnez une zone' : 'Select a zone'
    }

    const phoneErr = validatePhone(phone)
    if (phoneErr) newErrors.phone = phoneErr

    const whatsappErr = validatePhone(whatsapp)
    if (whatsappErr) newErrors.whatsapp = whatsappErr

    const websiteErr = validateWebsite(website)
    if (websiteErr) newErrors.website = websiteErr

    DAY_KEYS.forEach(day => {
      const h = hours[day]
      if (!h.closed) {
        if (!validateTimeFormat(h.open))
          newErrors[`hours_${day}_open`] = 'HH:MM'
        if (!validateTimeFormat(h.close))
          newErrors[`hours_${day}_close`] = 'HH:MM'
      }
    })

    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) {
      // Scroll hint
      Alert.alert(
        lang === 'fr' ? 'Champs invalides' : 'Invalid fields',
        lang === 'fr'
          ? 'Corrigez les champs en rouge avant de sauvegarder.'
          : 'Fix the highlighted fields before saving.'
      )
      return false
    }
    return true
  }

  // Upload a local video file URI directly to Supabase storage using
  // expo-file-system's native uploadAsync. This is the only approach that
  // reliably handles iOS photo library URIs — fetch() and XHR both produce
  // 0-byte blobs when used with the Supabase JS client in React Native.
  async function uploadVideoNative(localUri: string, storagePath: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')
    const uploadUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/place-videos/${storagePath}`
    const result = await FileSystem.uploadAsync(uploadUrl, localUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'video/mp4',
        'x-upsert': 'false',
      },
    })
    if (result.status !== 200 && result.status !== 201) {
      throw new Error(`Video upload failed (${result.status}): ${result.body}`)
    }
  }

  async function handleSave() {
    if (!validate()) return

    setSaving(true)
    try {
      // For create mode: generate the ID client-side so we can upload photos BEFORE
      // writing the place row. This guarantees that if a photo upload fails, no
      // orphaned place row is left in the database.
      // Note: crypto.randomUUID() is not available in Hermes — use manual UUID v4.
      function uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0
          const v = c === 'x' ? r : (r & 0x3 | 0x8)
          return v.toString(16)
        })
      }
      const targetId = mode === 'create' ? uuidv4() : placeId!

      // --- Soft-delete removed existing photos ---
      if (deletedPhotoIds.length > 0) {
        const { error: delError } = await supabase
          .from('photos')
          .update({ is_deleted: true } as any)
          .in('id', deletedPhotoIds)
        if (delError) throw delError
      }

      // --- Upload new photos first (create) or alongside (edit) ---
      setUploading(true)
      const photoInserts: { storage_path: string; is_primary: boolean; is_menu: boolean; position: number }[] = []

      // Gallery photos
      const newPhotos = photos.filter(p => p.isNew)
      for (let i = 0; i < newPhotos.length; i++) {
        const photo = newPhotos[i]
        const fileName = `${targetId}/${Date.now()}_${i}.jpg`
        const base64 = await FileSystem.readAsStringAsync(photo.uri, {
          encoding: FileSystem.EncodingType.Base64,
        })
        const { error: uploadError } = await supabase.storage
          .from('place-photos')
          .upload(fileName, decode(base64), { contentType: 'image/jpeg', upsert: false })
        if (uploadError) throw uploadError
        photoInserts.push({ storage_path: fileName, is_primary: photo.isPrimary, is_menu: false, position: i })
      }

      // Menu photos
      const newMenuPhotos = menuPhotos.filter(p => p.isNew)
      for (let i = 0; i < newMenuPhotos.length; i++) {
        const photo = newMenuPhotos[i]
        const fileName = `${targetId}/menu_${Date.now()}_${i}.jpg`
        const base64 = await FileSystem.readAsStringAsync(photo.uri, {
          encoding: FileSystem.EncodingType.Base64,
        })
        const { error: uploadError } = await supabase.storage
          .from('place-photos')
          .upload(fileName, decode(base64), { contentType: 'image/jpeg', upsert: false })
        if (uploadError) throw uploadError
        photoInserts.push({ storage_path: fileName, is_primary: false, is_menu: true, position: i })
      }

      // --- Write place row only after all photos are safely in storage ---
      const payload = {
        name: name.trim(),
        description_fr: descFr.trim() || null,
        description_en: descEn.trim() || null,
        category_id: categoryId,
        zone_id: zoneId,
        price_range: priceRange,
        phone: phone.trim() ? normalizePhone(phone) : null,
        whatsapp: whatsapp.trim() ? normalizePhone(whatsapp) : null,
        address: address.trim() || null,
        website: website.trim() ? normalizeWebsite(website) : null,
        is_active: isActive,
        is_promoted: isPromoted,
        promoted_label_fr: isPromoted ? (promotedLabelFr.trim() || null) : null,
        promoted_label_en: isPromoted ? (promotedLabelEn.trim() || null) : null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        hours,
      }

      if (mode === 'create') {
        const { error } = await supabase.from('places').insert({ id: targetId, ...payload } as any)
        if (error) throw error
      } else {
        const { error } = await supabase.from('places').update(payload as any).eq('id', targetId)
        if (error) throw error
      }

      // --- Insert photo rows now that both storage objects and place row exist ---
      for (const p of photoInserts) {
        await supabase.from('photos').insert({
          place_id: targetId,
          storage_path: p.storage_path,
          is_primary: p.is_primary,
          is_menu: p.is_menu,
          is_deleted: false,
          position: p.position,
        } as any)
      }

      // --- Upload new video THEN delete old one (order matters — never lose existing on upload failure) ---
      if (video?.isNew) {
        const videoFileName = `${targetId}/${Date.now()}.mp4`
        await uploadVideoNative(video.uri, videoFileName)
        // Upload succeeded — now safe to delete old record
        if (deletedVideoId) {
          await supabase.from('videos').delete().eq('id', deletedVideoId)
        }
        await supabase.from('videos').insert({
          place_id: targetId,
          storage_path: videoFileName,
          position: 0,
        } as any)
      } else if (deletedVideoId) {
        // Video was removed without replacement
        await supabase.from('videos').delete().eq('id', deletedVideoId)
      }

      setDeletedPhotoIds([])
      setDeletedVideoId(null)
      queryClient.invalidateQueries({ queryKey: ['places'] })
      queryClient.invalidateQueries({ queryKey: ['adminPlaces'] })
      queryClient.invalidateQueries({ queryKey: ['trendingPlaces'] })
      if (placeId) queryClient.invalidateQueries({ queryKey: ['place', placeId] })

      Alert.alert(
        lang === 'fr' ? 'Enregistré ✓' : 'Saved ✓',
        lang === 'fr'
          ? (mode === 'create' ? 'Le lieu a été créé avec succès.' : 'Les modifications ont été enregistrées.')
          : (mode === 'create' ? 'Place created successfully.' : 'Changes saved successfully.'),
        [{ text: 'OK', onPress: () => router.back() }]
      )
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong')
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  const isLoading = mode === 'edit' && !existing

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#1C1C1E" />
        </Pressable>
        <Text style={styles.title}>
          {mode === 'create'
            ? (lang === 'fr' ? 'Nouveau lieu' : 'New Place')
            : (lang === 'fr' ? 'Modifier' : 'Edit')}
        </Text>
        <Pressable
          style={[styles.saveBtn, (saving || uploading) && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving || uploading}
        >
          {saving || uploading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveBtnText}>{lang === 'fr' ? 'Sauver' : 'Save'}</Text>
          }
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color="#E8571A" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>

          {/* Active toggle */}
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.switchLabel}>
                  {lang === 'fr' ? 'Lieu actif (visible dans l\'app)' : 'Active (visible in app)'}
                </Text>
                {mode === 'create' && (
                  <Text style={styles.fieldHint}>
                    {lang === 'fr'
                      ? 'Désactivé par défaut — activez uniquement quand toutes les infos sont complètes.'
                      : 'Off by default — activate only when all information is complete.'}
                  </Text>
                )}
              </View>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ true: '#34C759' }}
              />
            </View>
          </View>

          {/* Promotion — paid feature */}
          <View style={[styles.card, isPromoted && styles.cardPromoted]}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.switchLabel}>
                    {lang === 'fr' ? 'Lieu mis en avant' : 'Promoted place'}
                  </Text>
                  {isPromoted && (
                    <View style={styles.promotedTag}>
                      <Text style={styles.promotedTagText}>
                        {lang === 'fr' ? 'Payant' : 'Paid'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.fieldHint}>
                  {lang === 'fr'
                    ? 'Apparaît en tête de "Tendances" avec un badge — réservé aux partenaires payants'
                    : 'Appears at the top of "Trending Now" with a badge — reserved for paying partners'}
                </Text>
              </View>
              <Switch
                value={isPromoted}
                onValueChange={setIsPromoted}
                trackColor={{ true: '#FF9500' }}
              />
            </View>
            {isPromoted && (
              <>
                <Field
                  label={lang === 'fr' ? 'Badge (français)' : 'Badge (French)'}
                  value={promotedLabelFr}
                  onChange={setPromotedLabelFr}
                  placeholder={lang === 'fr' ? 'Ex: Partenaire, À la une, Coup de cœur...' : 'Ex: Partenaire, À la une, Coup de cœur...'}
                  hint={lang === 'fr' ? 'Laissez vide pour afficher "Partenaire" par défaut' : 'Leave blank to show "Partenaire" by default'}
                />
                <Field
                  label={lang === 'fr' ? 'Badge (anglais)' : 'Badge (English)'}
                  value={promotedLabelEn}
                  onChange={setPromotedLabelEn}
                  placeholder="Ex: Partner, Featured, Staff Pick..."
                  hint={lang === 'fr' ? 'Laissez vide pour afficher "Partner" par défaut' : 'Leave blank to show "Partner" by default'}
                />
              </>
            )}
          </View>

          {/* Basic info */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{lang === 'fr' ? 'Informations' : 'Info'}</Text>
            <Field
              label={lang === 'fr' ? 'Nom *' : 'Name *'}
              value={name}
              onChange={v => { setName(v); setErrors(e => ({ ...e, name: '' })) }}
              placeholder={lang === 'fr' ? 'Ex: Le Patio, Moka Café...' : 'Ex: Le Patio, Moka Café...'}
              error={errors.name}
            />
            <Field
              label={lang === 'fr' ? 'Description (français)' : 'Description (French)'}
              value={descFr}
              onChange={setDescFr}
              multiline
              placeholder={lang === 'fr' ? 'Ambiance, spécialités, ce qui rend ce lieu unique...' : 'Atmosphere, specialties, what makes this place unique...'}
            />
            <Field
              label={lang === 'fr' ? 'Description (anglais)' : 'Description (English)'}
              value={descEn}
              onChange={setDescEn}
              multiline
              placeholder="Atmosphere, specialties, what makes this place unique..."
            />
          </View>

          {/* Category */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{lang === 'fr' ? 'Catégorie *' : 'Category *'}</Text>
            <View style={styles.chipRow}>
              {categories?.map(cat => (
                <Pressable
                  key={cat.id}
                  style={[styles.chip, categoryId === cat.id && styles.chipActive]}
                  onPress={() => { setCategoryId(cat.id); setErrors(e => ({ ...e, category: '' })) }}
                >
                  <Text style={[styles.chipText, categoryId === cat.id && styles.chipTextActive]}>
                    {lang === 'fr' ? cat.name_fr : cat.name_en}
                  </Text>
                </Pressable>
              ))}
            </View>
            {errors.category ? <Text style={styles.fieldError}>{errors.category}</Text> : null}
          </View>

          {/* Zone */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{lang === 'fr' ? 'Zone *' : 'Zone *'}</Text>
            <Text style={styles.fieldHint}>
              {lang === 'fr'
                ? 'Secteur de Libreville où se trouve le lieu'
                : 'Area of Libreville where the place is located'}
            </Text>
            <View style={styles.chipRow}>
              {zones?.map(zone => (
                <Pressable
                  key={zone.id}
                  style={[styles.chip, zoneId === zone.id && styles.chipActive]}
                  onPress={() => { setZoneId(zone.id); setErrors(e => ({ ...e, zone: '' })) }}
                >
                  <Text style={[styles.chipText, zoneId === zone.id && styles.chipTextActive]}>
                    {zone.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            {errors.zone ? <Text style={styles.fieldError}>{errors.zone}</Text> : null}
          </View>

          {/* Price range */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{lang === 'fr' ? 'Gamme de prix' : 'Price Range'}</Text>
            <View style={styles.chipRow}>
              {([1,2,3] as const).map(p => (
                <Pressable
                  key={p}
                  style={[styles.priceChip, priceRange === p && styles.chipActive]}
                  onPress={() => setPriceRange(p)}
                >
                  <Text style={[styles.chipText, priceRange === p && styles.chipTextActive]}>
                    {PRICE_LABELS[p][lang]}
                  </Text>
                  <Text style={[styles.priceHint, priceRange === p && { color: 'rgba(255,255,255,0.8)' }]}>
                    {PRICE_LABELS[p].hint}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Location */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {lang === 'fr' ? 'Localisation' : 'Location'}
            </Text>
            <Text style={styles.fieldHint}>
              {lang === 'fr'
                ? 'Rendez-vous physiquement au lieu, puis appuyez sur "Capturer ma position". Le pin sur la carte sera placé exactement à cet endroit.'
                : 'Go physically to the place, then tap "Capture my location". The map pin will be placed exactly there.'}
            </Text>

            {/* GPS button */}
            <Pressable
              style={[styles.locationBtn, locLoading && { opacity: 0.6 }]}
              onPress={captureLocation}
              disabled={locLoading}
            >
              {locLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="locate" size={18} color="#fff" />
              }
              <Text style={styles.locationBtnText}>
                {latitude
                  ? (lang === 'fr' ? 'Recapturer ma position' : 'Recapture my location')
                  : (lang === 'fr' ? 'Capturer ma position' : 'Capture my location')}
              </Text>
            </Pressable>

            {/* Show captured coordinates */}
            {latitude && longitude ? (
              <View style={styles.coordsRow}>
                <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                <Text style={styles.coordsText}>
                  {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </Text>
              </View>
            ) : (
              <View style={styles.coordsRow}>
                <Ionicons name="warning-outline" size={16} color="#FF9500" />
                <Text style={[styles.coordsText, { color: '#FF9500' }]}>
                  {lang === 'fr'
                    ? 'Pas de coordonnées — le lieu n\'apparaîtra pas sur la carte'
                    : 'No coordinates — place won\'t appear on the map'}
                </Text>
              </View>
            )}

            {errors.location ? <Text style={styles.fieldError}>{errors.location}</Text> : null}

            {/* Paste a location link — alternative to GPS */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                {lang === 'fr' ? 'Ou coller un lien de localisation' : 'Or paste a location link'}
              </Text>
              <Text style={styles.fieldHint}>
                {lang === 'fr'
                  ? 'Lien partagé depuis Google Maps, Plans (Apple) ou WhatsApp'
                  : 'Link shared from Google Maps, Apple Maps, or WhatsApp'}
              </Text>
              <View style={styles.linkInputRow}>
                <TextInput
                  style={[
                    styles.fieldInput,
                    { flex: 1 },
                    errors.locationLink ? styles.fieldInputError : null,
                  ]}
                  value={locationLink}
                  onChangeText={v => { setLocationLink(v); setErrors(e => ({ ...e, locationLink: '' })) }}
                  placeholder="https://maps.google.com/..."
                  placeholderTextColor="#C7C7CC"
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  style={[styles.linkApplyBtn, !locationLink.trim() && { opacity: 0.4 }]}
                  onPress={applyLocationLink}
                  disabled={!locationLink.trim()}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </Pressable>
              </View>
              {errors.locationLink ? <Text style={styles.fieldError}>{errors.locationLink}</Text> : null}
            </View>

            {/* Landmark text — human-readable, shown to users */}
            <Field
              label={lang === 'fr' ? 'Repère / Adresse' : 'Landmark / Address'}
              value={address}
              onChange={v => { setAddress(v); setErrors(e => ({ ...e, address: '' })) }}
              placeholder={lang === 'fr'
                ? 'Ex: En face du Port, côté Total Derrière Wharf'
                : 'Ex: Opposite the Port, near Total Derrière Wharf'}
              hint={lang === 'fr'
                ? 'Description que verront les utilisateurs — pas besoin d\'adresse précise, un repère suffit'
                : 'Description users will see — no need for a precise address, a landmark is enough'}
              error={errors.address}
            />
          </View>

          {/* Contact */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{lang === 'fr' ? 'Contact' : 'Contact'}</Text>
            <Field
              label={lang === 'fr' ? 'Téléphone' : 'Phone'}
              value={phone}
              onChange={v => { setPhone(v); setErrors(e => ({ ...e, phone: '' })) }}
              keyboard="phone-pad"
              placeholder="Ex: 077 12 34 56"
              hint={lang === 'fr'
                ? 'Format gabonais — le numéro sera automatiquement formaté en +241XXXXXXXX'
                : 'Gabonese format — number will be auto-formatted to +241XXXXXXXX'}
              error={errors.phone}
            />
            <View style={styles.whatsappHeader}>
              <Text style={styles.fieldLabel}>WhatsApp</Text>
              {phone.trim() && (
                <Pressable
                  onPress={() => { setWhatsapp(phone); setErrors(e => ({ ...e, whatsapp: '' })) }}
                  style={styles.sameAsPhoneBtn}
                >
                  <Ionicons name="copy-outline" size={13} color="#E8571A" />
                  <Text style={styles.sameAsPhoneText}>
                    {lang === 'fr' ? 'Même que téléphone' : 'Same as phone'}
                  </Text>
                </Pressable>
              )}
            </View>
            <Field
              label=""
              value={whatsapp}
              onChange={v => { setWhatsapp(v); setErrors(e => ({ ...e, whatsapp: '' })) }}
              keyboard="phone-pad"
              placeholder="Ex: 077 12 34 56"
              hint={lang === 'fr'
                ? 'Le bouton "Chat" de la fiche ouvre directement cette conversation WhatsApp'
                : 'The "Chat" button on the listing opens this WhatsApp conversation directly'}
              error={errors.whatsapp}
            />
            <Field
              label={lang === 'fr' ? 'Site web / Réseaux sociaux' : 'Website / Social media'}
              value={website}
              onChange={v => { setWebsite(v); setErrors(e => ({ ...e, website: '' })) }}
              keyboard="url"
              placeholder="Ex: instagram.com/lepatio ou https://lepatio.ga"
              hint={lang === 'fr'
                ? 'Site web, Instagram, Facebook — le lien sera complété automatiquement si besoin'
                : 'Website, Instagram, Facebook — link will be completed automatically if needed'}
              error={errors.website}
            />
          </View>

          {/* Hours */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{lang === 'fr' ? 'Horaires' : 'Hours'}</Text>
            <Text style={styles.fieldHint}>
              {lang === 'fr'
                ? 'Format 24h — ex: 09:00 à 22:00. Activez 🌙 si le lieu ferme après minuit.'
                : '24h format — ex: 09:00 to 22:00. Enable 🌙 if the place closes after midnight.'}
            </Text>
            {DAY_KEYS.map(day => {
              const h = hours[day]
              return (
                <View key={day} style={styles.dayRow}>
                  <Text style={styles.dayName}>{DAY_LABELS[day][lang]}</Text>
                  <Switch
                    value={!h.closed}
                    onValueChange={v => updateDay(day, 'closed', !v)}
                    trackColor={{ true: '#34C759' }}
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                  {!h.closed && (
                    <>
                      <TextInput
                        style={[styles.timeInput, errors[`hours_${day}_open`] ? styles.fieldInputError : null]}
                        value={h.open}
                        onChangeText={v => { updateDay(day, 'open', v); setErrors(e => ({ ...e, [`hours_${day}_open`]: '' })) }}
                        placeholder="09:00"
                        placeholderTextColor="#C7C7CC"
                      />
                      <Text style={styles.timeSep}>–</Text>
                      <TextInput
                        style={[styles.timeInput, errors[`hours_${day}_close`] ? styles.fieldInputError : null]}
                        value={h.close}
                        onChangeText={v => { updateDay(day, 'close', v); setErrors(e => ({ ...e, [`hours_${day}_close`]: '' })) }}
                        placeholder="22:00"
                        placeholderTextColor="#C7C7CC"
                      />
                      <Pressable
                        style={styles.overnightBtn}
                        onPress={() => updateDay(day, 'overnight', !h.overnight)}
                      >
                        <Ionicons
                          name={h.overnight ? 'moon' : 'moon-outline'}
                          size={16}
                          color={h.overnight ? '#5856D6' : '#C7C7CC'}
                        />
                        {h.overnight && (
                          <Text style={styles.overnightLabel}>
                            {lang === 'fr' ? 'Après minuit' : 'After midnight'}
                          </Text>
                        )}
                      </Pressable>
                    </>
                  )}
                  {h.closed && (
                    <Text style={styles.closedText}>{lang === 'fr' ? 'Fermé' : 'Closed'}</Text>
                  )}
                </View>
              )
            })}
          </View>

          {/* Gallery Photos */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{lang === 'fr' ? 'Photos' : 'Photos'}</Text>
            <Text style={styles.fieldHint}>
              {lang === 'fr'
                ? 'Prenez les photos sur place ou importez depuis votre galerie. La ★ définit la photo principale affichée en tête de fiche.'
                : 'Take photos on-site or import from your gallery. ★ sets the primary photo shown at the top of the listing.'}
            </Text>
            <View style={styles.photoGrid}>
              {photos.map((photo, idx) => (
                <View key={idx} style={styles.photoWrap}>
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                  {photo.isPrimary && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryBadgeText}>★</Text>
                    </View>
                  )}
                  <View style={styles.photoActions}>
                    {!photo.isPrimary && (
                      <Pressable style={styles.photoAction} onPress={() => setPrimary(idx)}>
                        <Ionicons name="star-outline" size={14} color="#FF9500" />
                      </Pressable>
                    )}
                    <Pressable style={[styles.photoAction, { backgroundColor: 'rgba(255,59,48,0.12)' }]} onPress={() => removePhoto(idx)}>
                      <Ionicons name="trash-outline" size={14} color="#FF3B30" />
                    </Pressable>
                  </View>
                </View>
              ))}
              <Pressable style={styles.addPhotoBtn} onPress={pickPhoto}>
                <Ionicons name="image-outline" size={24} color="#8E8E93" />
                <Text style={styles.addPhotoText}>{lang === 'fr' ? 'Galerie' : 'Gallery'}</Text>
              </Pressable>
              <Pressable style={styles.addPhotoBtn} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={24} color="#8E8E93" />
                <Text style={styles.addPhotoText}>{lang === 'fr' ? 'Caméra' : 'Camera'}</Text>
              </Pressable>
            </View>
          </View>

          {/* Video */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{lang === 'fr' ? 'Vidéo' : 'Video'}</Text>
            <Text style={styles.fieldHint}>
              {lang === 'fr'
                ? 'Une vidéo par lieu — elle sera affichée dans le feed vertical. Formats acceptés : MP4, MOV.'
                : 'One video per place — shown in the vertical feed. Accepted formats: MP4, MOV.'}
            </Text>
            {video ? (
              <VideoPreview
                uri={video.uri}
                isNew={video.isNew}
                duration={video.duration}
                lang={lang}
                onReplace={pickVideo}
                onRemove={removeVideo}
              />
            ) : (
              <Pressable style={styles.addVideoBtn} onPress={pickVideo}>
                <Ionicons name="videocam-outline" size={22} color="#8E8E93" />
                <Text style={styles.addPhotoText}>
                  {lang === 'fr' ? 'Choisir une vidéo' : 'Choose a video'}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Menu Photos */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{lang === 'fr' ? 'Photos du menu' : 'Menu Photos'}</Text>
            <Text style={styles.fieldHint}>
              {lang === 'fr'
                ? 'Photos de la carte ou du menu. Elles s\'affichent dans le panneau "Menu" de la fiche dans le feed — séparées de la galerie principale.'
                : 'Photos of your menu or food items. They appear in the "Menu" panel on the feed card — separate from the main gallery.'}
            </Text>
            <View style={styles.photoGrid}>
              {menuPhotos.map((photo, idx) => (
                <View key={idx} style={styles.photoWrap}>
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                  <View style={styles.menuBadge}>
                    <Ionicons name="receipt-outline" size={10} color="#fff" />
                  </View>
                  <View style={styles.photoActions}>
                    <Pressable style={[styles.photoAction, { backgroundColor: 'rgba(255,59,48,0.12)' }]} onPress={() => removeMenuPhoto(idx)}>
                      <Ionicons name="trash-outline" size={14} color="#FF3B30" />
                    </Pressable>
                  </View>
                </View>
              ))}
              <Pressable style={styles.addPhotoBtn} onPress={pickMenuPhoto}>
                <Ionicons name="image-outline" size={24} color="#8E8E93" />
                <Text style={styles.addPhotoText}>{lang === 'fr' ? 'Galerie' : 'Gallery'}</Text>
              </Pressable>
              <Pressable style={styles.addPhotoBtn} onPress={takeMenuPhoto}>
                <Ionicons name="camera-outline" size={24} color="#8E8E93" />
                <Text style={styles.addPhotoText}>{lang === 'fr' ? 'Caméra' : 'Camera'}</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function VideoPreview({
  uri, isNew, duration, lang, onReplace, onRemove,
}: {
  uri: string
  isNew: boolean
  duration?: number
  lang: 'fr' | 'en'
  onReplace: () => void
  onRemove: () => void
}) {
  const player = useVideoPlayer(uri, p => {
    p.loop = true
    p.muted = true
  })

  return (
    <View style={styles.videoPreviewWrap}>
      <VideoView
        player={player}
        style={styles.videoPreview}
        contentFit="cover"
        nativeControls={false}
      />
      {/* Play/pause tap overlay */}
      <Pressable
        style={styles.videoPlayOverlay}
        onPress={() => player.playing ? player.pause() : player.play()}
      >
        <Ionicons
          name={player.playing ? 'pause-circle' : 'play-circle'}
          size={44}
          color="rgba(255,255,255,0.85)"
        />
      </Pressable>
      {/* Status label */}
      <View style={styles.videoStatusBadge}>
        <Text style={styles.videoStatusText}>
          {isNew
            ? (lang === 'fr' ? 'Nouvelle vidéo' : 'New video')
            : (lang === 'fr' ? 'Vidéo enregistrée' : 'Saved video')}
          {isNew && duration ? `  •  ${Math.round(duration)}s` : ''}
        </Text>
      </View>
      {/* Actions */}
      <View style={styles.videoPreviewActions}>
        <Pressable style={styles.videoActionBtn} onPress={onReplace}>
          <Ionicons name="swap-horizontal" size={16} color="#E8571A" />
        </Pressable>
        <Pressable style={[styles.videoActionBtn, { backgroundColor: 'rgba(255,59,48,0.1)' }]} onPress={onRemove}>
          <Ionicons name="trash-outline" size={16} color="#FF3B30" />
        </Pressable>
      </View>
    </View>
  )
}

function Field({
  label, value, onChange, multiline = false,
  keyboard = 'default', placeholder, hint, error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  keyboard?: any
  placeholder?: string
  hint?: string
  error?: string
}) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      <TextInput
        style={[
          styles.fieldInput,
          multiline && styles.fieldInputMulti,
          error ? styles.fieldInputError : null,
        ]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboard}
        placeholder={placeholder}
        placeholderTextColor="#C7C7CC"
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 20, fontWeight: '700', color: '#1C1C1E' },
  saveBtn: {
    backgroundColor: '#E8571A', paddingHorizontal: 16,
    paddingVertical: 8, borderRadius: 12,
    minWidth: 70, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  form: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  switchLabel: { fontSize: 14, color: '#3C3C43', fontWeight: '500' },
  cardPromoted: { borderWidth: 1.5, borderColor: '#FF9500' },
  promotedTag: {
    backgroundColor: 'rgba(255,149,0,0.12)',
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 6,
  },
  promotedTagText: { fontSize: 10, fontWeight: '700', color: '#FF9500' },
  field: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.3 },
  fieldHint: { fontSize: 12, color: '#8E8E93', lineHeight: 17 },
  fieldInput: {
    backgroundColor: '#F2F2F7', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: '#1C1C1E',
  },
  fieldInputMulti: { minHeight: 80, textAlignVertical: 'top' },
  fieldInputError: { borderWidth: 1.5, borderColor: '#FF3B30', backgroundColor: '#FFF5F5' },
  fieldError: { fontSize: 12, color: '#FF3B30', marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#F2F2F7',
  },
  priceChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 12, backgroundColor: '#F2F2F7',
    alignItems: 'center', gap: 2,
  },
  chipActive: { backgroundColor: '#E8571A' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#3C3C43' },
  chipTextActive: { color: '#fff' },
  priceHint: { fontSize: 10, color: '#8E8E93' },
  // Location
  locationBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1C1C1E', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    justifyContent: 'center',
  },
  locationBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  coordsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coordsText: { fontSize: 12, color: '#34C759', fontWeight: '500' },
  // Location link paste
  linkInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkApplyBtn: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: '#1C1C1E',
    alignItems: 'center', justifyContent: 'center',
  },
  // WhatsApp same-as-phone
  whatsappHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sameAsPhoneBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: 'rgba(232,87,26,0.08)', borderRadius: 8,
  },
  sameAsPhoneText: { fontSize: 11, color: '#E8571A', fontWeight: '600' },
  // Hours
  dayRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, paddingVertical: 4,
    borderTopWidth: 1, borderTopColor: '#F2F2F7',
  },
  dayName: { width: 32, fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  timeInput: {
    backgroundColor: '#F2F2F7', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 6,
    fontSize: 13, color: '#1C1C1E', width: 56, textAlign: 'center',
  },
  timeSep: { fontSize: 13, color: '#8E8E93' },
  overnightBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  overnightLabel: { fontSize: 10, color: '#5856D6', fontWeight: '600' },
  closedText: { fontSize: 13, color: '#C7C7CC', marginLeft: 4 },
  // Photos
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoWrap: { width: 90, height: 90, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photoThumb: { width: '100%', height: '100%', borderRadius: 10 },
  primaryBadge: {
    position: 'absolute', top: 4, left: 4,
    backgroundColor: '#FF9500', borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  primaryBadgeText: { fontSize: 11, color: '#fff', fontWeight: '800' },
  menuBadge: {
    position: 'absolute', top: 4, left: 4,
    backgroundColor: '#007AFF', borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  photoActions: {
    position: 'absolute', bottom: 4, right: 4,
    flexDirection: 'row', gap: 4,
  },
  photoAction: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  addPhotoBtn: {
    width: 90, height: 90, borderRadius: 10,
    backgroundColor: '#F2F2F7',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#E5E5EA', borderStyle: 'dashed',
    gap: 4,
  },
  addPhotoText: { fontSize: 11, color: '#8E8E93', fontWeight: '500' },
  // Video
  videoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1C1C1E', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  videoIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  videoLabel: { fontSize: 14, fontWeight: '600', color: '#fff' },
  videoMeta: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  videoActionBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(232,87,26,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  addVideoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F2F2F7', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#E5E5EA', borderStyle: 'dashed',
  },
  // Video preview
  videoPreviewWrap: {
    borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#000',
    aspectRatio: 9 / 16,
  },
  videoPreview: {
    width: '100%', height: '100%',
  },
  videoPlayOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  videoStatusBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8,
  },
  videoStatusText: {
    color: '#fff', fontSize: 12, fontWeight: '600',
  },
  videoPreviewActions: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', gap: 8,
  },
})

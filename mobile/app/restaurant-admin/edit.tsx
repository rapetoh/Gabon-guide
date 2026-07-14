import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { router, useLocalSearchParams } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useSession } from '../../hooks/useSession'
import { usePlaceTier } from '../../hooks/usePlaceTier'
import { useThemeColors } from '../../contexts/ThemeContext'
import { supabase } from '../../lib/supabase'
import { LockedFeatureCard, supportWhatsAppUrl } from '../../components/restaurant-admin/LockedFeatureCard'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const PHOTO_THUMB = (SCREEN_WIDTH - 40 - 8) / 3  // 3-column grid

// ── Opening hours — exact same JSON shape as the admin PlaceForm writes
// to places.hours: all 7 day keys always present, each day
// { open, close, overnight, closed }.
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
type DayHours = { open: string; close: string; overnight: boolean; closed: boolean }
type Hours = Record<string, DayHours>
const DEFAULT_DAY: DayHours = { open: '09:00', close: '22:00', overnight: false, closed: false }

function defaultHours(): Hours {
  return Object.fromEntries(DAY_KEYS.map(d => [d, { ...DEFAULT_DAY }]))
}

function validateTimeFormat(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export default function RestaurantAdminEdit() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const colors = useThemeColors()
  const { session } = useSession()
  const queryClient = useQueryClient()

  const { data: place, isLoading } = useQuery({
    queryKey: ['owned-place-edit', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('places')
        .select('id, name, description_fr, description_en, address, phone, whatsapp, hours, social_instagram, social_facebook, social_tiktok, subscription_tier, subscription_expires_at, owner_id')
        .eq('id', id)
        .eq('owner_id', session!.user.id)
        .single()
      return data
    },
    enabled: !!id && !!session,
  })
  const tier = usePlaceTier(place ?? undefined)

  const { data: existingPhotos, refetch: refetchPhotos } = useQuery({
    queryKey: ['owned-place-photos', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('photos')
        .select('id, storage_path, is_menu, is_primary')
        .eq('place_id', id)
        .eq('is_deleted', false)
        .order('position', { ascending: true })
      return data ?? []
    },
    enabled: !!id,
  })

  const { data: existingVideo, refetch: refetchVideo } = useQuery({
    queryKey: ['owned-place-video', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('videos')
        .select('id, storage_path')
        .eq('place_id', id)
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle()
      return data ?? null
    },
    enabled: !!id,
  })
  const [videoUploading, setVideoUploading] = useState(false)

  const [nameFr, setNameFr] = useState('')
  const [descFr, setDescFr] = useState('')
  const [descEn, setDescEn] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [instagram, setInstagram] = useState('')
  const [facebook, setFacebook] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [hours, setHours] = useState<Hours>(defaultHours)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [initialised, setInitialised] = useState(false)

  if (place && !initialised) {
    setNameFr(place.name ?? '')
    setDescFr(place.description_fr ?? '')
    setDescEn(place.description_en ?? '')
    setAddress(place.address ?? '')
    setPhone(place.phone ?? '')
    setWhatsapp(place.whatsapp ?? '')
    setInstagram(place.social_instagram ?? '')
    setFacebook(place.social_facebook ?? '')
    setTiktok(place.social_tiktok ?? '')
    const existingHours = (place as any).hours as Hours | null
    if (existingHours) {
      // Merge like the admin PlaceForm: missing day keys default to closed
      setHours(Object.fromEntries(
        DAY_KEYS.map(d => [d, { ...DEFAULT_DAY, ...(existingHours[d] ?? { closed: true }) }])
      ))
    }
    setInitialised(true)
  }

  function updateDay(day: string, field: keyof DayHours, value: string | boolean) {
    setHours(h => ({ ...h, [day]: { ...h[day], [field]: value } }))
  }

  async function handleSave() {
    if (!id || !session) return
    if (!nameFr.trim()) {
      Alert.alert(
        lang === 'fr' ? 'Champ requis' : 'Required field',
        lang === 'fr' ? 'Le nom ne peut pas être vide.' : 'Name cannot be empty.'
      )
      return
    }
    // Validate open/close times on non-closed days (same rule as PlaceForm)
    for (const day of DAY_KEYS) {
      const h = hours[day]
      if (!h.closed && (!validateTimeFormat(h.open) || !validateTimeFormat(h.close))) {
        Alert.alert(
          lang === 'fr' ? 'Horaires invalides' : 'Invalid hours',
          lang === 'fr'
            ? `${DAY_LABELS[day].fr} : utilisez le format 24h (ex. 09:00, 22:30).`
            : `${DAY_LABELS[day].en}: use 24h format (e.g. 09:00, 22:30).`
        )
        return
      }
    }
    setSaving(true)
    const updates: Record<string, string | Hours | null> = {
      name: nameFr.trim(),
      description_fr: descFr.trim() || null,
      description_en: descEn.trim() || null,
      address: address.trim() || null,
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      hours,
    }
    // Socials only writable when tier allows (RLS would still allow it,
    // but keep storage consistent with what the place's tier displays)
    if (tier.can('social_links')) {
      updates.social_instagram = instagram.trim() || null
      updates.social_facebook = facebook.trim() || null
      updates.social_tiktok = tiktok.trim() || null
    }
    const { error } = await supabase
      .from('places')
      .update(updates)
      .eq('id', id)
      .eq('owner_id', session.user.id)

    setSaving(false)
    if (error) {
      Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', error.message)
    } else {
      queryClient.invalidateQueries({ queryKey: ['owned-place'] })
      Alert.alert(
        lang === 'fr' ? 'Enregistré ✓' : 'Saved ✓',
        lang === 'fr' ? 'Vos modifications ont été enregistrées.' : 'Your changes have been saved.',
        [{ text: 'OK', onPress: () => router.back() }]
      )
    }
  }

  async function handlePhotoUpload(isMenu: boolean) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    })
    if (result.canceled) return
    const asset = result.assets[0]

    setUploading(true)
    try {
      // Compress
      const compressed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      )

      const storagePath = `${id}/${uuidv4()}.jpg`
      const response = await fetch(compressed.uri)
      const blob = await response.blob()

      const { error: uploadError } = await supabase.storage
        .from('place-photos')
        .upload(storagePath, blob, { contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      const existingPhotos = await supabase
        .from('photos')
        .select('id')
        .eq('place_id', id)
        .eq('is_deleted', false)
        .eq('is_menu', isMenu)

      const isPrimary = !isMenu && (existingPhotos.data?.length ?? 0) === 0

      await supabase.from('photos').insert({
        place_id: id,
        storage_path: storagePath,
        is_primary: isPrimary,
        is_deleted: false,
        is_menu: isMenu,
        position: Date.now(),
      })

      refetchPhotos()
      Alert.alert(
        lang === 'fr' ? 'Succès' : 'Success',
        lang === 'fr' ? 'Photo ajoutée.' : 'Photo uploaded.'
      )
    } catch (e: any) {
      Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', e?.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function pickVideo() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    })
    if (result.canceled) return
    const asset = result.assets[0]
    setVideoUploading(true)
    try {
      const storagePath = `${id}/${uuidv4()}.mp4`
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const uploadUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/place-videos/${storagePath}`
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, asset.uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'video/mp4',
          'x-upsert': 'false',
        },
      })
      if (uploadResult.status !== 200 && uploadResult.status !== 201) {
        throw new Error(`Video upload failed (${uploadResult.status}): ${uploadResult.body}`)
      }
      // Upload succeeded — now safe to delete old record
      if (existingVideo) {
        await supabase.from('videos').delete().eq('id', existingVideo.id)
      }
      await supabase.from('videos').insert({
        place_id: id,
        storage_path: storagePath,
        thumbnail_url: null,
        caption: null,
        position: 0,
      })
      refetchVideo()
      Alert.alert(
        lang === 'fr' ? 'Succès' : 'Success',
        lang === 'fr' ? 'Vidéo ajoutée.' : 'Video uploaded.'
      )
    } catch (e: any) {
      Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', e?.message ?? 'Upload failed')
    } finally {
      setVideoUploading(false)
    }
  }

  async function deleteVideo() {
    if (!existingVideo) return
    Alert.alert(
      lang === 'fr' ? 'Supprimer la vidéo ?' : 'Delete video?',
      lang === 'fr' ? 'Cette action est irréversible.' : 'This cannot be undone.',
      [
        { text: lang === 'fr' ? 'Annuler' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'fr' ? 'Supprimer' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('videos').delete().eq('id', existingVideo.id)
            if (error) {
              Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', error.message)
            } else {
              refetchVideo()
            }
          },
        },
      ]
    )
  }

  async function deletePhoto(photoId: string) {
    Alert.alert(
      lang === 'fr' ? 'Supprimer la photo ?' : 'Delete photo?',
      lang === 'fr' ? 'Cette action est irréversible.' : 'This cannot be undone.',
      [
        { text: lang === 'fr' ? 'Annuler' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'fr' ? 'Supprimer' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('photos')
              .update({ is_deleted: true } as any)
              .eq('id', photoId)
            if (error) {
              Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', error.message)
            } else {
              refetchPhotos()
            }
          },
        },
      ]
    )
  }

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {lang === 'fr' ? 'Modifier' : 'Edit'}
        </Text>
        <Pressable onPress={handleSave} disabled={saving} hitSlop={12}>
          {saving
            ? <ActivityIndicator size="small" color="#E8571A" />
            : <Text style={styles.saveText}>{lang === 'fr' ? 'Enregistrer' : 'Save'}</Text>}
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Name */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {lang === 'fr' ? 'Nom' : 'Name'}
          </Text>
          <TextInput
            style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceElevated }]}
            value={nameFr}
            onChangeText={setNameFr}
            placeholderTextColor={colors.textPlaceholder}
          />
        </View>

        {/* Description FR */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Description (FR)</Text>
          <TextInput
            style={[styles.inputMulti, { color: colors.textPrimary, backgroundColor: colors.surfaceElevated }]}
            value={descFr}
            onChangeText={setDescFr}
            multiline
            numberOfLines={4}
            placeholderTextColor={colors.textPlaceholder}
            placeholder="Description en français…"
          />
        </View>

        {/* Description EN */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Description (EN)</Text>
          <TextInput
            style={[styles.inputMulti, { color: colors.textPrimary, backgroundColor: colors.surfaceElevated }]}
            value={descEn}
            onChangeText={setDescEn}
            multiline
            numberOfLines={4}
            placeholderTextColor={colors.textPlaceholder}
            placeholder="Description in English…"
          />
        </View>

        {/* Address (open to all tiers per PDF) */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {lang === 'fr' ? 'Adresse' : 'Address'}
          </Text>
          <TextInput
            style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceElevated }]}
            value={address}
            onChangeText={setAddress}
            placeholderTextColor={colors.textPlaceholder}
            placeholder={lang === 'fr' ? 'Quartier, rue, repère…' : 'Neighborhood, street, landmark…'}
          />
        </View>

        {/* Phone (open to all tiers — tier gates only the CTA on the public detail page) */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {lang === 'fr' ? 'Téléphone' : 'Phone'}
          </Text>
          <TextInput
            style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceElevated }]}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholderTextColor={colors.textPlaceholder}
            placeholder="+241 0X XX XX XX"
          />
        </View>

        {/* WhatsApp (open to all tiers — same as phone) */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>WhatsApp</Text>
          <TextInput
            style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceElevated }]}
            value={whatsapp}
            onChangeText={setWhatsapp}
            keyboardType="phone-pad"
            placeholderTextColor={colors.textPlaceholder}
            placeholder="+241 0X XX XX XX"
          />
        </View>

        {/* Opening hours — open to all tiers (PRD must-have) */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {lang === 'fr' ? 'Horaires' : 'Hours'}
          </Text>
          <Text style={[styles.hoursHint, { color: colors.textTertiary }]}>
            {lang === 'fr'
              ? 'Format 24h — ex: 09:00 à 22:00. Activez 🌙 si vous fermez après minuit.'
              : '24h format — e.g. 09:00 to 22:00. Enable 🌙 if you close after midnight.'}
          </Text>
          <View style={{ gap: 4 }}>
            {DAY_KEYS.map(day => {
              const h = hours[day]
              return (
                <View key={day} style={styles.dayRow}>
                  <Text style={[styles.dayName, { color: colors.textPrimary }]}>
                    {DAY_LABELS[day][lang]}
                  </Text>
                  <Switch
                    value={!h.closed}
                    onValueChange={v => updateDay(day, 'closed', !v)}
                    trackColor={{ true: '#34C759' }}
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                  {!h.closed ? (
                    <>
                      <TextInput
                        style={[styles.timeInput, { color: colors.textPrimary, backgroundColor: colors.surfaceElevated }]}
                        value={h.open}
                        onChangeText={v => updateDay(day, 'open', v)}
                        placeholder="09:00"
                        placeholderTextColor={colors.textPlaceholder}
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <Text style={[styles.timeSep, { color: colors.textSecondary }]}>–</Text>
                      <TextInput
                        style={[styles.timeInput, { color: colors.textPrimary, backgroundColor: colors.surfaceElevated }]}
                        value={h.close}
                        onChangeText={v => updateDay(day, 'close', v)}
                        placeholder="22:00"
                        placeholderTextColor={colors.textPlaceholder}
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <Pressable
                        style={styles.overnightBtn}
                        onPress={() => updateDay(day, 'overnight', !h.overnight)}
                        hitSlop={6}
                      >
                        <Ionicons
                          name={h.overnight ? 'moon' : 'moon-outline'}
                          size={16}
                          color={h.overnight ? '#5856D6' : '#C7C7CC'}
                        />
                      </Pressable>
                    </>
                  ) : (
                    <Text style={[styles.closedText, { color: colors.textTertiary }]}>
                      {lang === 'fr' ? 'Fermé' : 'Closed'}
                    </Text>
                  )}
                </View>
              )
            })}
          </View>
        </View>

        {/* Social links — Standard+ */}
        <View style={[styles.field, { gap: 10 }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {lang === 'fr' ? 'Réseaux sociaux' : 'Social links'}
          </Text>
          {tier.can('social_links') ? (
            <View style={{ gap: 10 }}>
              <View style={styles.socialField}>
                <Ionicons name="logo-instagram" size={18} color="#E4405F" />
                <TextInput
                  style={[styles.socialInput, { color: colors.textPrimary, backgroundColor: colors.surfaceElevated }]}
                  value={instagram}
                  onChangeText={setInstagram}
                  autoCapitalize="none"
                  keyboardType="url"
                  placeholderTextColor={colors.textPlaceholder}
                  placeholder="https://instagram.com/…"
                />
              </View>
              <View style={styles.socialField}>
                <Ionicons name="logo-facebook" size={18} color="#1877F2" />
                <TextInput
                  style={[styles.socialInput, { color: colors.textPrimary, backgroundColor: colors.surfaceElevated }]}
                  value={facebook}
                  onChangeText={setFacebook}
                  autoCapitalize="none"
                  keyboardType="url"
                  placeholderTextColor={colors.textPlaceholder}
                  placeholder="https://facebook.com/…"
                />
              </View>
              <View style={styles.socialField}>
                <Ionicons name="logo-tiktok" size={18} color={colors.textPrimary} />
                <TextInput
                  style={[styles.socialInput, { color: colors.textPrimary, backgroundColor: colors.surfaceElevated }]}
                  value={tiktok}
                  onChangeText={setTiktok}
                  autoCapitalize="none"
                  keyboardType="url"
                  placeholderTextColor={colors.textPlaceholder}
                  placeholder="https://tiktok.com/@…"
                />
              </View>
            </View>
          ) : (
            <LockedFeatureCard
              title={lang === 'fr' ? 'Réseaux sociaux' : 'Social links'}
              unlocksAt="standard"
              icon="link"
              description={lang === 'fr' ? 'Affichez vos liens Instagram, Facebook et TikTok' : 'Show your Instagram, Facebook and TikTok links'}
            />
          )}
        </View>

        {/* Video — Premium only */}
        <View style={[styles.field, { gap: 10 }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {lang === 'fr' ? 'Vidéo' : 'Video'}
          </Text>
          {!tier.can('video') ? (
            <LockedFeatureCard
              title={lang === 'fr' ? 'Ajouter une vidéo' : 'Add a video'}
              unlocksAt="premium"
              icon="videocam-outline"
              description={lang === 'fr' ? 'Mettez en avant votre établissement avec une vidéo verticale' : 'Promote your place with a vertical video'}
            />
          ) : existingVideo ? (
            <OwnerVideoPreview
              uri={supabase.storage.from('place-videos').getPublicUrl(existingVideo.storage_path).data.publicUrl}
              lang={lang}
              onReplace={pickVideo}
              onRemove={deleteVideo}
              disabled={videoUploading}
            />
          ) : (
            <Pressable
              style={[styles.uploadBtn, { backgroundColor: colors.surfaceElevated }]}
              onPress={pickVideo}
              disabled={videoUploading}
            >
              <Ionicons name="videocam-outline" size={20} color="#E8571A" />
              <Text style={[styles.uploadText, { color: colors.textPrimary }]}>
                {videoUploading
                  ? (lang === 'fr' ? 'Envoi en cours…' : 'Uploading…')
                  : (lang === 'fr' ? 'Ajouter une vidéo' : 'Add video')}
              </Text>
              {videoUploading && <ActivityIndicator size="small" color="#E8571A" style={{ marginLeft: 'auto' }} />}
            </Pressable>
          )}
        </View>

        {/* Gallery Photos — open to all tiers, capped at tier.photoLimit */}
        <View style={[styles.field, { gap: 10 }]}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 0 }]}>
              {lang === 'fr' ? 'Photos' : 'Photos'}
            </Text>
            <Text style={[styles.labelHint, { color: colors.textTertiary }]}>
              {(() => {
                const used = existingPhotos?.filter(p => !p.is_menu).length ?? 0
                if (tier.photoLimit >= 9999) return `${used}`
                return `${used} / ${tier.photoLimit}`
              })()}
            </Text>
          </View>
          <View style={styles.photoGrid}>
            {existingPhotos?.filter(p => !p.is_menu).map(photo => (
              <View key={photo.id} style={styles.photoWrap}>
                <Image
                  source={{ uri: supabase.storage.from('place-photos').getPublicUrl(photo.storage_path).data.publicUrl }}
                  style={styles.photoThumb}
                  contentFit="cover"
                />
                {photo.is_primary && (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeText}>★</Text>
                  </View>
                )}
                <Pressable style={styles.deleteBtn} onPress={() => deletePhoto(photo.id)}>
                  <Ionicons name="trash-outline" size={13} color="#FF3B30" />
                </Pressable>
              </View>
            ))}
            {(() => {
              const used = existingPhotos?.filter(p => !p.is_menu).length ?? 0
              const atCap = used >= tier.photoLimit
              return (
                <Pressable
                  style={[
                    styles.addPhotoBtn,
                    { backgroundColor: colors.surfaceElevated },
                    atCap && { opacity: 0.4 },
                  ]}
                  onPress={() => {
                    if (atCap) {
                      const waUrl = supportWhatsAppUrl()
                      Alert.alert(
                        lang === 'fr' ? 'Limite atteinte' : 'Limit reached',
                        lang === 'fr'
                          ? `Votre pack autorise ${tier.photoLimit} photo(s). Passez au pack supérieur pour en ajouter plus.`
                          : `Your pack allows ${tier.photoLimit} photo(s). Upgrade your pack to add more.`,
                        waUrl
                          ? [
                              { text: 'OK', style: 'cancel' },
                              {
                                text: lang === 'fr' ? 'Contacter O\'Kili' : 'Contact O\'Kili',
                                onPress: () => { void Linking.openURL(waUrl) },
                              },
                            ]
                          : undefined
                      )
                      return
                    }
                    handlePhotoUpload(false)
                  }}
                  disabled={uploading}
                >
                  {uploading
                    ? <ActivityIndicator size="small" color="#E8571A" />
                    : <Ionicons name={atCap ? 'lock-closed' : 'add'} size={24} color="#8E8E93" />}
                </Pressable>
              )
            })()}
          </View>
        </View>

        {/* Menu Photos — Standard+ */}
        <View style={[styles.field, { gap: 10 }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {lang === 'fr' ? 'Photos du menu' : 'Menu Photos'}
          </Text>
          {!tier.can('menu') ? (
            <LockedFeatureCard
              title={lang === 'fr' ? 'Photos du menu' : 'Menu photos'}
              unlocksAt="standard"
              icon="restaurant-outline"
              description={lang === 'fr' ? 'Téléchargez les photos de votre carte ou menu' : 'Upload photos of your menu'}
            />
          ) : (
            <View style={styles.photoGrid}>
              {existingPhotos?.filter(p => p.is_menu).map(photo => (
                <View key={photo.id} style={styles.photoWrap}>
                  <Image
                    source={{ uri: supabase.storage.from('place-photos').getPublicUrl(photo.storage_path).data.publicUrl }}
                    style={styles.photoThumb}
                    contentFit="cover"
                  />
                  <View style={styles.menuBadge}>
                    <Ionicons name="receipt-outline" size={10} color="#fff" />
                  </View>
                  <Pressable style={styles.deleteBtn} onPress={() => deletePhoto(photo.id)}>
                    <Ionicons name="trash-outline" size={13} color="#FF3B30" />
                  </Pressable>
                </View>
              ))}
              <Pressable
                style={[styles.addPhotoBtn, { backgroundColor: colors.surfaceElevated }]}
                onPress={() => handlePhotoUpload(true)}
                disabled={uploading}
              >
                {uploading
                  ? <ActivityIndicator size="small" color="#E8571A" />
                  : <Ionicons name="add" size={24} color="#8E8E93" />}
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function OwnerVideoPreview({
  uri, lang, onReplace, onRemove, disabled,
}: {
  uri: string
  lang: 'fr' | 'en'
  onReplace: () => void
  onRemove: () => void
  disabled?: boolean
}) {
  const player = useVideoPlayer(uri, p => {
    p.loop = true
    p.muted = true
  })

  return (
    <View style={styles.videoPreviewWrap}>
      <VideoView
        player={player}
        style={styles.videoPreviewView}
        contentFit="cover"
        nativeControls={false}
      />
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
      <View style={styles.videoStatusBadge}>
        <Text style={styles.videoStatusText}>
          {lang === 'fr' ? 'Vidéo enregistrée' : 'Saved video'}
        </Text>
      </View>
      <View style={styles.videoPreviewActions}>
        <Pressable style={styles.videoBtn} onPress={onReplace} disabled={disabled}>
          <Ionicons name="swap-horizontal" size={16} color="#E8571A" />
        </Pressable>
        <Pressable style={[styles.videoBtn, { backgroundColor: 'rgba(255,59,48,0.1)' }]} onPress={onRemove} disabled={disabled}>
          <Ionicons name="trash-outline" size={16} color="#FF3B30" />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E8571A',
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 15,
  },
  inputMulti: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  // Opening hours editor
  hoursHint: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
  },
  dayName: {
    width: 36,
    fontSize: 13,
    fontWeight: '600',
  },
  timeInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    fontSize: 14,
    textAlign: 'center',
  },
  timeSep: {
    fontSize: 14,
  },
  overnightBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedText: {
    flex: 1,
    fontSize: 13,
  },

  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  photoWrap: {
    width: PHOTO_THUMB,
    height: PHOTO_THUMB,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  primaryBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#FF9500',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  primaryBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  menuBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#007AFF',
    borderRadius: 6,
    padding: 3,
  },
  deleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: 4,
  },
  addPhotoBtn: {
    width: PHOTO_THUMB,
    height: PHOTO_THUMB,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    borderStyle: 'dashed',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
  },
  uploadText: {
    fontSize: 15,
    fontWeight: '500',
  },
  videoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  videoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(232,87,26,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoSavedText: {
    fontSize: 14,
    fontWeight: '500',
  },
  videoBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(232,87,26,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPreviewWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    aspectRatio: 9 / 16,
  },
  videoPreviewView: {
    width: '100%',
    height: '100%',
  },
  videoPlayOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoStatusBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  videoStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  videoPreviewActions: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  socialField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  socialInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  labelHint: {
    fontSize: 12,
    fontWeight: '500',
  },
})

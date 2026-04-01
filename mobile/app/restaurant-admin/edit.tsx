import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useSession } from '../../hooks/useSession'
import { useThemeColors } from '../../contexts/ThemeContext'
import { supabase } from '../../lib/supabase'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const PHOTO_THUMB = (SCREEN_WIDTH - 40 - 8) / 3  // 3-column grid

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
        .select('id, name, description_fr, description_en, owner_id')
        .eq('id', id)
        .eq('owner_id', session!.user.id)
        .single()
      return data
    },
    enabled: !!id && !!session,
  })

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
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [initialised, setInitialised] = useState(false)

  if (place && !initialised) {
    setNameFr(place.name ?? '')
    setDescFr(place.description_fr ?? '')
    setDescEn(place.description_en ?? '')
    setInitialised(true)
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
    setSaving(true)
    const { error } = await supabase
      .from('places')
      .update({ name: nameFr.trim(), description_fr: descFr.trim() || null, description_en: descEn.trim() || null })
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
      const response = await fetch(asset.uri)
      const blob = await response.blob()
      const { error: uploadError } = await supabase.storage
        .from('place-videos')
        .upload(storagePath, blob, { contentType: 'video/mp4' })
      if (uploadError) throw uploadError
      // Upload succeeded — now safe to delete old record
      if (existingVideo) {
        await supabase.from('videos').delete().eq('id', existingVideo.id)
      }
      await supabase.from('videos').insert({
        place_id: id,
        storage_path: storagePath,
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

        {/* Video */}
        <View style={[styles.field, { gap: 10 }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {lang === 'fr' ? 'Vidéo' : 'Video'}
          </Text>
          {existingVideo ? (
            <View style={[styles.videoCard, { backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.videoIconWrap}>
                <Ionicons name="play-circle" size={32} color="#E8571A" />
              </View>
              <Text style={[styles.videoSavedText, { color: colors.textPrimary, flex: 1 }]}>
                {lang === 'fr' ? 'Vidéo enregistrée' : 'Saved video'}
              </Text>
              <Pressable style={styles.videoBtn} onPress={pickVideo} disabled={videoUploading}>
                <Ionicons name="swap-horizontal" size={16} color="#E8571A" />
              </Pressable>
              <Pressable style={[styles.videoBtn, { backgroundColor: 'rgba(255,59,48,0.1)' }]} onPress={deleteVideo} disabled={videoUploading}>
                <Ionicons name="trash-outline" size={16} color="#FF3B30" />
              </Pressable>
            </View>
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

        {/* Gallery Photos */}
        <View style={[styles.field, { gap: 10 }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {lang === 'fr' ? 'Photos' : 'Photos'}
          </Text>
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
            <Pressable
              style={[styles.addPhotoBtn, { backgroundColor: colors.surfaceElevated }]}
              onPress={() => handlePhotoUpload(false)}
              disabled={uploading}
            >
              {uploading
                ? <ActivityIndicator size="small" color="#E8571A" />
                : <Ionicons name="add" size={24} color="#8E8E93" />}
            </Pressable>
          </View>
        </View>

        {/* Menu Photos */}
        <View style={[styles.field, { gap: 10 }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {lang === 'fr' ? 'Photos du menu' : 'Menu Photos'}
          </Text>
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
        </View>
      </ScrollView>
    </SafeAreaView>
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
})

import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
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
      router.back()
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

        {/* Photo upload */}
        <View style={[styles.field, { gap: 10 }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {lang === 'fr' ? 'Photos' : 'Photos'}
          </Text>
          <Pressable
            style={[styles.uploadBtn, { backgroundColor: colors.surfaceElevated }]}
            onPress={() => handlePhotoUpload(false)}
            disabled={uploading}
          >
            <Ionicons name="image-outline" size={20} color="#E8571A" />
            <Text style={[styles.uploadText, { color: colors.textPrimary }]}>
              {uploading
                ? (lang === 'fr' ? 'Envoi en cours…' : 'Uploading…')
                : (lang === 'fr' ? 'Ajouter une photo' : 'Add photo')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.uploadBtn, { backgroundColor: colors.surfaceElevated }]}
            onPress={() => handlePhotoUpload(true)}
            disabled={uploading}
          >
            <Ionicons name="receipt-outline" size={20} color="#E8571A" />
            <Text style={[styles.uploadText, { color: colors.textPrimary }]}>
              {lang === 'fr' ? 'Ajouter une photo de menu' : 'Add menu photo'}
            </Text>
          </Pressable>
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
})

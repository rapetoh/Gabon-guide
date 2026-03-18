import { Ionicons } from '@expo/vector-icons'
import { decode } from 'base64-arraybuffer'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
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
  const [name, setName]               = useState('')
  const [descFr, setDescFr]           = useState('')
  const [descEn, setDescEn]           = useState('')
  const [categoryId, setCategoryId]   = useState('')
  const [zoneId, setZoneId]           = useState('')
  const [priceRange, setPriceRange]   = useState<1|2|3>(2)
  const [phone, setPhone]             = useState('')
  const [whatsapp, setWhatsapp]       = useState('')
  const [address, setAddress]         = useState('')
  const [website, setWebsite]         = useState('')
  const [isActive, setIsActive]       = useState(true)

  // Hours
  const [hours, setHours] = useState<Hours>(() =>
    Object.fromEntries(DAY_KEYS.map(d => [d, { ...DEFAULT_DAY }]))
  )

  // Photos
  const [photos, setPhotos] = useState<{ uri: string; isNew: boolean; isPrimary: boolean; storageId?: string; storagePath?: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

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
      setIsActive(p.is_active ?? true)
      if (p.hours) {
        const merged = Object.fromEntries(
          DAY_KEYS.map(d => [d, { ...DEFAULT_DAY, ...(p.hours[d] ?? { closed: true }) }])
        )
        setHours(merged)
      }
      if (p.photos?.length) {
        setPhotos(p.photos.map((ph: any) => ({
          uri: supabase.storage.from('place-photos').getPublicUrl(ph.storage_path).data.publicUrl,
          isNew: false,
          isPrimary: ph.is_primary,
          storageId: ph.id,
          storagePath: ph.storage_path,
        })))
      }
    }
  }, [existing, mode])

  function updateDay(day: string, field: keyof DayHours, value: any) {
    setHours(h => ({ ...h, [day]: { ...h[day], [field]: value } }))
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    })
    if (result.canceled) return
    const asset = result.assets[0]
    // Compress: max 1200px wide, 80% JPEG quality
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
      const updated = prev.filter((_, i) => i !== idx)
      // If removed was primary, make first remaining primary
      if (prev[idx].isPrimary && updated.length > 0) updated[0].isPrimary = true
      return updated
    })
  }

  function setPrimary(idx: number) {
    setPhotos(prev => prev.map((p, i) => ({ ...p, isPrimary: i === idx })))
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert(lang === 'fr' ? 'Nom requis' : 'Name required'); return }
    if (!categoryId) { Alert.alert(lang === 'fr' ? 'Catégorie requise' : 'Category required'); return }
    if (!zoneId) { Alert.alert(lang === 'fr' ? 'Zone requise' : 'Zone required'); return }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description_fr: descFr.trim() || null,
        description_en: descEn.trim() || null,
        category_id: categoryId,
        zone_id: zoneId,
        price_range: priceRange,
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        address: address.trim() || null,
        website: website.trim() || null,
        is_active: isActive,
        hours,
      }

      let targetId = placeId
      if (mode === 'create') {
        const { data, error } = await supabase.from('places').insert(payload as any).select('id').single()
        if (error) throw error
        targetId = data.id
      } else {
        const { error } = await supabase.from('places').update(payload as any).eq('id', placeId!)
        if (error) throw error
      }

      // Upload new photos
      setUploading(true)
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i]
        if (!photo.isNew) continue
        const fileName = `${targetId}/${Date.now()}_${i}.jpg`
        const base64 = await FileSystem.readAsStringAsync(photo.uri, {
          encoding: FileSystem.EncodingType.Base64,
        })
        const { error: uploadError } = await supabase.storage
          .from('place-photos')
          .upload(fileName, decode(base64), { contentType: 'image/jpeg', upsert: false })
        if (uploadError) throw uploadError
        await supabase.from('photos').insert({
          place_id: targetId!,
          storage_path: fileName,
          is_primary: photo.isPrimary,
          position: i,
        } as any)
      }

      queryClient.invalidateQueries({ queryKey: ['places'] })
      queryClient.invalidateQueries({ queryKey: ['adminPlaces'] })
      if (placeId) queryClient.invalidateQueries({ queryKey: ['place', placeId] })

      router.back()
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
              <Text style={styles.switchLabel}>
                {lang === 'fr' ? 'Lieu actif (visible dans l\'app)' : 'Active (visible in app)'}
              </Text>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ true: '#34C759' }}
              />
            </View>
          </View>

          {/* Basic info */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{lang === 'fr' ? 'Informations' : 'Info'}</Text>
            <Field label={lang === 'fr' ? 'Nom *' : 'Name *'} value={name} onChange={setName} />
            <Field label={lang === 'fr' ? 'Description (français)' : 'Description (French)'} value={descFr} onChange={setDescFr} multiline />
            <Field label={lang === 'fr' ? 'Description (anglais)' : 'Description (English)'} value={descEn} onChange={setDescEn} multiline />
          </View>

          {/* Category */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{lang === 'fr' ? 'Catégorie *' : 'Category *'}</Text>
            <View style={styles.chipRow}>
              {categories?.map(cat => (
                <Pressable
                  key={cat.id}
                  style={[styles.chip, categoryId === cat.id && styles.chipActive]}
                  onPress={() => setCategoryId(cat.id)}
                >
                  <Text style={[styles.chipText, categoryId === cat.id && styles.chipTextActive]}>
                    {lang === 'fr' ? cat.name_fr : cat.name_en}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Zone */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{lang === 'fr' ? 'Zone *' : 'Zone *'}</Text>
            <View style={styles.chipRow}>
              {zones?.map(zone => (
                <Pressable
                  key={zone.id}
                  style={[styles.chip, zoneId === zone.id && styles.chipActive]}
                  onPress={() => setZoneId(zone.id)}
                >
                  <Text style={[styles.chipText, zoneId === zone.id && styles.chipTextActive]}>
                    {zone.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Price range */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{lang === 'fr' ? 'Gamme de prix' : 'Price Range'}</Text>
            <View style={styles.chipRow}>
              {([1,2,3] as const).map(p => {
                const labels = {
                  1: { fr: 'Économique', en: 'Budget' },
                  2: { fr: 'Intermédiaire', en: 'Mid-range' },
                  3: { fr: 'Haut de gamme', en: 'Upscale' },
                }
                return (
                  <Pressable
                    key={p}
                    style={[styles.chip, priceRange === p && styles.chipActive]}
                    onPress={() => setPriceRange(p)}
                  >
                    <Text style={[styles.chipText, priceRange === p && styles.chipTextActive]}>
                      {labels[p][lang]}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {/* Contact */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{lang === 'fr' ? 'Contact' : 'Contact'}</Text>
            <Field label={lang === 'fr' ? 'Téléphone' : 'Phone'} value={phone} onChange={setPhone} keyboard="phone-pad" />
            <Field label="WhatsApp" value={whatsapp} onChange={setWhatsapp} keyboard="phone-pad" placeholder="24101234567" />
            <Field label={lang === 'fr' ? 'Adresse' : 'Address'} value={address} onChange={setAddress} />
            <Field label="Website" value={website} onChange={setWebsite} keyboard="url" placeholder="https://..." />
          </View>

          {/* Hours */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{lang === 'fr' ? 'Horaires' : 'Hours'}</Text>
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
                        style={styles.timeInput}
                        value={h.open}
                        onChangeText={v => updateDay(day, 'open', v)}
                        placeholder="09:00"
                        placeholderTextColor="#C7C7CC"
                      />
                      <Text style={styles.timeSep}>–</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={h.close}
                        onChangeText={v => updateDay(day, 'close', v)}
                        placeholder="22:00"
                        placeholderTextColor="#C7C7CC"
                      />
                      <Pressable onPress={() => updateDay(day, 'overnight', !h.overnight)}>
                        <Ionicons
                          name={h.overnight ? 'moon' : 'moon-outline'}
                          size={18}
                          color={h.overnight ? '#5856D6' : '#C7C7CC'}
                        />
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

          {/* Photos */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{lang === 'fr' ? 'Photos' : 'Photos'}</Text>
            <View style={styles.photoGrid}>
              {photos.map((photo, idx) => (
                <View key={idx} style={styles.photoWrap}>
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                  {photo.isPrimary && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryBadgeText}>✓</Text>
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
            <Text style={styles.photoHint}>
              {lang === 'fr' ? '★ = photo principale · Photos compressées automatiquement' : '★ = primary photo · Photos auto-compressed'}
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function Field({
  label, value, onChange, multiline = false,
  keyboard = 'default', placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  keyboard?: any
  placeholder?: string
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboard}
        placeholder={placeholder}
        placeholderTextColor="#C7C7CC"
      />
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
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, gap: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 14, color: '#3C3C43', flex: 1 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.3 },
  fieldInput: {
    backgroundColor: '#F2F2F7', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: '#1C1C1E',
  },
  fieldInputMulti: { minHeight: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#F2F2F7',
  },
  chipActive: { backgroundColor: '#E8571A' },
  chipText: { fontSize: 13, fontWeight: '500', color: '#3C3C43' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  dayRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, paddingVertical: 4,
    borderTopWidth: 1, borderTopColor: '#F2F2F7',
  },
  dayName: { width: 32, fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  timeInput: {
    backgroundColor: '#F2F2F7', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 6,
    fontSize: 13, color: '#1C1C1E', width: 58, textAlign: 'center',
  },
  timeSep: { fontSize: 13, color: '#8E8E93' },
  closedText: { fontSize: 13, color: '#C7C7CC', marginLeft: 8 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoWrap: { width: 90, height: 90, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photoThumb: { width: '100%', height: '100%', borderRadius: 10 },
  primaryBadge: {
    position: 'absolute', top: 4, left: 4,
    backgroundColor: '#FF9500', borderRadius: 10,
    width: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },
  primaryBadgeText: { fontSize: 10, color: '#fff', fontWeight: '800' },
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
  photoHint: { fontSize: 12, color: '#8E8E93', lineHeight: 16 },
})

import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'

import { useSession } from '../../hooks/useSession'
import { useThemeColors } from '../../contexts/ThemeContext'
import { supabase } from '../../lib/supabase'

interface OwnedPlace {
  id: string
  name: string
  is_active: boolean
  categories: { name_fr: string; name_en: string } | null
  zones: { name: string } | null
  photos: { id: string; storage_path: string; is_primary: boolean; is_deleted: boolean; is_menu: boolean }[]
}

function useOwnedPlace(userId: string | undefined) {
  return useQuery({
    queryKey: ['owned-place', userId],
    queryFn: async () => {
      if (!userId) return null
      const { data } = await supabase
        .from('places')
        .select(`
          id, name, is_active,
          categories ( name_fr, name_en ),
          zones ( name ),
          photos ( id, storage_path, is_primary, is_deleted, is_menu )
        `)
        .eq('owner_id', userId)
        .eq('is_deleted', false)
        .single()
      return data as unknown as OwnedPlace | null
    },
    enabled: !!userId,
  })
}

export default function RestaurantAdminDashboard() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const colors = useThemeColors()
  const { session } = useSession()
  const { data: place, isLoading } = useOwnedPlace(session?.user.id)

  const primaryPhoto = place?.photos
    ?.filter(p => !p.is_deleted && !p.is_menu)
    ?.find(p => p.is_primary)
    ?? place?.photos?.filter(p => !p.is_deleted && !p.is_menu)?.[0]

  const photoUrl = primaryPhoto
    ? supabase.storage.from('place-photos').getPublicUrl(primaryPhoto.storage_path).data.publicUrl
    : null

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (!place) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {lang === 'fr' ? 'Mon restaurant' : 'My Restaurant'}
        </Text>
        <View style={styles.center}>
          <Ionicons name="storefront-outline" size={48} color={colors.iconMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {lang === 'fr'
              ? 'Aucun restaurant associé à votre compte.'
              : 'No restaurant linked to your account.'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {lang === 'fr' ? 'Mon restaurant' : 'My Restaurant'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Place card */}
      <View style={[styles.placeCard, { backgroundColor: colors.surfaceElevated }]}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.placePhoto} contentFit="cover" />
        ) : (
          <View style={[styles.placePhoto, styles.placePhotoFallback]}>
            <Ionicons name="image-outline" size={32} color={colors.iconMuted} />
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.placeName, { color: colors.textPrimary }]}>{place.name}</Text>
          <Text style={[styles.placeMeta, { color: colors.textSecondary }]}>
            {place.categories
              ? (lang === 'fr' ? place.categories.name_fr : place.categories.name_en)
              : ''}
            {place.zones ? ` · ${place.zones.name}` : ''}
          </Text>
          <View style={[styles.statusBadge, place.is_active ? styles.statusActive : styles.statusInactive]}>
            <Text style={[styles.statusText, place.is_active ? styles.statusTextActive : styles.statusTextInactive]}>
              {place.is_active
                ? (lang === 'fr' ? 'Actif' : 'Active')
                : (lang === 'fr' ? 'Inactif' : 'Inactive')}
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.actionBtn, { backgroundColor: colors.surfaceElevated }]}
          onPress={() => router.push({ pathname: '/restaurant-admin/edit', params: { id: place.id } } as any)}
        >
          <Ionicons name="create-outline" size={22} color="#E8571A" />
          <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>
            {lang === 'fr' ? 'Modifier les infos' : 'Edit info'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} />
        </Pressable>
      </View>
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
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 260,
  },
  placeCard: {
    flexDirection: 'row',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  placePhoto: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  placePhotoFallback: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeName: {
    fontSize: 17,
    fontWeight: '700',
  },
  placeMeta: {
    fontSize: 13,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 2,
  },
  statusActive: { backgroundColor: 'rgba(52,199,89,0.12)' },
  statusInactive: { backgroundColor: 'rgba(255,59,48,0.1)' },
  statusText: { fontSize: 12, fontWeight: '600' },
  statusTextActive: { color: '#34C759' },
  statusTextInactive: { color: '#FF3B30' },
  actions: {
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
  },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
})

import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import AppBackground from '../../components/AppBackground'
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useFavorites } from '../../hooks/useFavorites'
import { usePlaces } from '../../hooks/usePlaces'
import { useSession } from '../../hooks/useSession'
import { supabase } from '../../lib/supabase'
import { useThemeColors } from '../../contexts/ThemeContext'
import { ThemeColors } from '../../constants/themes'

function photoUrl(path: string) {
  return supabase.storage.from('place-photos').getPublicUrl(path).data.publicUrl
}

export default function FavoritesScreen() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const { session } = useSession()
  const { favoriteIds, toggleFavorite } = useFavorites()
  const { data } = usePlaces()
  const colors = useThemeColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const allPlaces = data?.pages.flat() ?? []
  const favoritePlaces = allPlaces.filter(p => favoriteIds.includes(p.id))

  if (!session) {
    return (
      <AppBackground>
        <SafeAreaView style={styles.centered} edges={['top']}>
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="heart-outline" size={40} color="#E8571A" />
            </View>
            <Text style={styles.emptyTitle}>{t('favorites.title')}</Text>
            <Text style={styles.emptyBody}>{t('favorites.loginRequired')}</Text>
            <Pressable style={styles.loginBtn} onPress={() => router.push('/auth/login')}>
              <Text style={styles.loginBtnText}>{t('auth.login')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </AppBackground>
    )
  }

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Text style={styles.title}>{t('favorites.title')}</Text>

        {favoritePlaces.length === 0 ? (
          <View style={styles.centered}>
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="heart-outline" size={40} color="#E8571A" />
              </View>
              <Text style={styles.emptyBody}>{t('favorites.empty')}</Text>
              <Text style={styles.emptyHint}>{t('favorites.emptyHint')}</Text>
            </View>
          </View>
        ) : (
          <FlatList
            data={favoritePlaces}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const photo = (item as any).photos?.find((p: any) => p.is_primary) ?? (item as any).photos?.[0]
              const cat = (item as any).categories
              const zone = (item as any).zones
              return (
                <Pressable style={styles.card} onPress={() => router.push(`/place/${item.id}`)}>
                  <View style={styles.thumb}>
                    {photo ? (
                      <Image source={{ uri: photoUrl(photo.storage_path) }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, styles.thumbFallback]} />
                    )}
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {lang === 'fr' ? cat?.name_fr : cat?.name_en}
                      {zone ? ` · ${zone.name}` : ''}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => toggleFavorite.mutate(item.id)}
                    hitSlop={8}
                  >
                    <Ionicons name="heart" size={22} color="#E8571A" />
                  </Pressable>
                </Pressable>
              )
            }}
          />
        )}
      </SafeAreaView>
    </AppBackground>
  )
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: c.textPrimary,
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 16,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyState: {
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 40,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'rgba(232,87,26,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: c.textPrimary,
    },
    emptyBody: {
      fontSize: 16,
      fontWeight: '500',
      color: c.textSecondary,
      textAlign: 'center',
    },
    emptyHint: {
      fontSize: 14,
      color: c.textTertiary,
      textAlign: 'center',
    },
    loginBtn: {
      marginTop: 8,
      backgroundColor: '#E8571A',
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 14,
    },
    loginBtnText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },
    list: {
      paddingHorizontal: 24,
      paddingBottom: 100,
      gap: 10,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
    },
    thumb: {
      width: 70,
      height: 70,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: c.thumbFallback,
    },
    thumbFallback: {
      backgroundColor: c.thumbFallback,
    },
    cardBody: {
      flex: 1,
      gap: 4,
    },
    cardName: {
      fontSize: 16,
      fontWeight: '600',
      color: c.textPrimary,
    },
    cardSub: {
      fontSize: 13,
      color: c.textSecondary,
    },
  })
}

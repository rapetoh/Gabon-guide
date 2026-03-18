import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { supabase } from '../../lib/supabase'
import { useQuery } from '@tanstack/react-query'

interface AdminPlace {
  id: string
  name: string
  is_active: boolean
  categories: { name_fr: string; name_en: string } | null
  zones: { name: string } | null
}

function useAdminPlaces() {
  return useQuery({
    queryKey: ['adminPlaces'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('places')
        .select('id, name, is_active, categories(name_fr, name_en), zones(name)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as AdminPlace[]
    },
  })
}

export default function AdminDashboardScreen() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const { data: places, isLoading } = useAdminPlaces()

  const active = places?.filter(p => p.is_active).length ?? 0
  const total = places?.length ?? 0

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#1C1C1E" />
        </Pressable>
        <Text style={styles.title}>{lang === 'fr' ? 'Gestion' : 'Admin'}</Text>
        <Pressable style={styles.addBtn} onPress={() => router.push('/admin/place/new')}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{total}</Text>
          <Text style={styles.statLabel}>{lang === 'fr' ? 'Lieux' : 'Places'}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#34C759' }]}>{active}</Text>
          <Text style={styles.statLabel}>{lang === 'fr' ? 'Actifs' : 'Active'}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#FF9500' }]}>{total - active}</Text>
          <Text style={styles.statLabel}>{lang === 'fr' ? 'Inactifs' : 'Inactive'}</Text>
        </View>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#E8571A" />
        </View>
      ) : (
        <FlatList
          data={places}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/admin/place/${item.id}`)}
            >
              <View style={[styles.statusDot, item.is_active ? styles.dotActive : styles.dotInactive]} />
              <View style={styles.rowBody}>
                <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {lang === 'fr' ? item.categories?.name_fr : item.categories?.name_en}
                  {item.zones ? ` · ${item.zones.name}` : ''}
                </Text>
              </View>
              <View style={[styles.statusBadge, item.is_active ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.statusBadgeText, item.is_active ? styles.badgeActiveText : styles.badgeInactiveText]}>
                  {item.is_active
                    ? (lang === 'fr' ? 'Actif' : 'Active')
                    : (lang === 'fr' ? 'Inactif' : 'Inactive')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 20, fontWeight: '700', color: '#1C1C1E' },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E8571A',
    alignItems: 'center', justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  statNumber: { fontSize: 24, fontWeight: '800', color: '#1C1C1E' },
  statLabel: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, gap: 8, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: '#34C759' },
  dotInactive: { backgroundColor: '#C7C7CC' },
  rowBody: { flex: 1, gap: 3 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  rowSub: { fontSize: 13, color: '#8E8E93' },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8,
  },
  badgeActive: { backgroundColor: 'rgba(52,199,89,0.1)' },
  badgeInactive: { backgroundColor: 'rgba(0,0,0,0.05)' },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
  badgeActiveText: { color: '#34C759' },
  badgeInactiveText: { color: '#8E8E93' },
})

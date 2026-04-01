import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
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
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as AdminPlace[]
    },
  })
}

type Filter = 'all' | 'active' | 'inactive'

type ListItem =
  | { type: 'place'; data: AdminPlace }
  | { type: 'separator'; label: string }

export default function AdminDashboardScreen() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const { data: places, isLoading } = useAdminPlaces()
  const [filter, setFilter] = useState<Filter>('all')

  const active = places?.filter(p => p.is_active) ?? []
  const inactive = places?.filter(p => !p.is_active) ?? []
  const total = places?.length ?? 0

  // Build the list depending on active filter
  function buildList(): ListItem[] {
    if (filter === 'active') return active.map(p => ({ type: 'place', data: p }))
    if (filter === 'inactive') return inactive.map(p => ({ type: 'place', data: p }))
    // 'all': active first, then a separator, then inactive
    const items: ListItem[] = active.map(p => ({ type: 'place', data: p }))
    if (active.length > 0 && inactive.length > 0) {
      items.push({
        type: 'separator',
        label: lang === 'fr'
          ? `${inactive.length} inactif${inactive.length > 1 ? 's' : ''}`
          : `${inactive.length} inactive`,
      })
    }
    inactive.forEach(p => items.push({ type: 'place', data: p }))
    return items
  }

  const listData = buildList()

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#1C1C1E" />
        </Pressable>
        <Text style={styles.title}>{lang === 'fr' ? 'Gestion' : 'Admin'}</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.usersBtn} onPress={() => router.push('/admin/users' as any)}>
            <Ionicons name="people-outline" size={20} color="#E8571A" />
          </Pressable>
          <Pressable style={styles.addBtn} onPress={() => router.push('/admin/place/new')}>
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Stats row — tapping each card filters the list */}
      <View style={styles.statsRow}>
        <Pressable
          style={[styles.statCard, filter === 'all' && styles.statCardActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.statNumber, filter === 'all' && styles.statNumberSelected]}>
            {total}
          </Text>
          <Text style={styles.statLabel}>{lang === 'fr' ? 'Tous' : 'All'}</Text>
        </Pressable>
        <Pressable
          style={[styles.statCard, filter === 'active' && styles.statCardActive]}
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.statNumber, { color: '#34C759' }]}>
            {active.length}
          </Text>
          <Text style={styles.statLabel}>{lang === 'fr' ? 'Actifs' : 'Active'}</Text>
        </Pressable>
        <Pressable
          style={[styles.statCard, filter === 'inactive' && styles.statCardActive]}
          onPress={() => setFilter('inactive')}
        >
          <Text style={[styles.statNumber, { color: '#FF9500' }]}>
            {inactive.length}
          </Text>
          <Text style={styles.statLabel}>{lang === 'fr' ? 'Inactifs' : 'Inactive'}</Text>
        </Pressable>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#E8571A" />
        </View>
      ) : listData.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {filter === 'active'
              ? (lang === 'fr' ? 'Aucun lieu actif' : 'No active places')
              : filter === 'inactive'
              ? (lang === 'fr' ? 'Aucun lieu inactif' : 'No inactive places')
              : (lang === 'fr' ? 'Aucun lieu' : 'No places yet')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, idx) =>
            item.type === 'separator' ? `sep-${idx}` : item.data.id
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            if (item.type === 'separator') {
              return (
                <View style={styles.separator}>
                  <View style={styles.separatorLine} />
                  <Text style={styles.separatorLabel}>{item.label}</Text>
                  <View style={styles.separatorLine} />
                </View>
              )
            }
            const place = item.data
            return (
              <Pressable
                style={styles.row}
                onPress={() => router.push(`/admin/place/${place.id}`)}
              >
                <View style={[styles.statusDot, place.is_active ? styles.dotActive : styles.dotInactive]} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>{place.name}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {lang === 'fr' ? place.categories?.name_fr : place.categories?.name_en}
                    {place.zones ? ` · ${place.zones.name}` : ''}
                  </Text>
                </View>
                <View style={[styles.statusBadge, place.is_active ? styles.badgeActive : styles.badgeInactive]}>
                  <Text style={[styles.statusBadgeText, place.is_active ? styles.badgeActiveText : styles.badgeInactiveText]}>
                    {place.is_active
                      ? (lang === 'fr' ? 'Actif' : 'Active')
                      : (lang === 'fr' ? 'Inactif' : 'Inactive')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
              </Pressable>
            )
          }}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  usersBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(232,87,26,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
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
    borderWidth: 2,
    borderColor: 'transparent',
  },
  statCardActive: {
    borderColor: '#E8571A',
  },
  statNumber: { fontSize: 24, fontWeight: '800', color: '#1C1C1E' },
  statNumberSelected: { color: '#E8571A' },
  statLabel: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, color: '#8E8E93' },
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
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  separatorLine: { flex: 1, height: 1, backgroundColor: '#E5E5EA' },
  separatorLabel: { fontSize: 12, color: '#8E8E93', fontWeight: '600' },
})

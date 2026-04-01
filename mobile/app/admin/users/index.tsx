/**
 * Admin — Users screen
 * Lists all registered users with name, email, join date, and role badge.
 * Tap any row to open the role editor.
 * Data comes from get_all_users_for_admin() RPC which joins auth.users
 * (email) with profiles (name, role) — admin-only via SECURITY DEFINER.
 */
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
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'

import { supabase } from '../../../lib/supabase'

interface UserRow {
  id: string
  full_name: string | null
  role: 'user' | 'restaurant_owner' | 'admin'
  is_admin: boolean
  email: string
  joined_at: string
}

function useAllUsers() {
  return useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_users_for_admin')
      if (error) throw error
      return (data ?? []) as UserRow[]
    },
  })
}

const ROLE_META: Record<string, { fr: string; en: string; color: string; bg: string }> = {
  admin:            { fr: 'Admin',        en: 'Admin',  color: '#fff',    bg: '#E8571A' },
  restaurant_owner: { fr: 'Propriétaire', en: 'Owner',  color: '#fff',    bg: '#007AFF' },
  user:             { fr: 'Utilisateur',  en: 'User',   color: '#8E8E93', bg: 'rgba(0,0,0,0.06)' },
}

function formatJoinDate(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(
    lang === 'fr' ? 'fr-FR' : 'en-US',
    { month: 'short', year: 'numeric' }
  )
}

export default function AdminUsersScreen() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const { data: users, isLoading, error } = useAllUsers()
  const [search, setSearch] = useState('')

  const filtered = (users ?? []).filter(u => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (u.full_name ?? '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    )
  })

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color="#1C1C1E" />
        </Pressable>
        <Text style={styles.title}>
          {lang === 'fr' ? 'Utilisateurs' : 'Users'}
          {users && users.length > 0 ? ` (${users.length})` : ''}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color="#8E8E93" />
        <TextInput
          style={styles.searchInput}
          placeholder={lang === 'fr' ? 'Nom ou email…' : 'Name or email…'}
          placeholderTextColor="#C7C7CC"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color="#C7C7CC" />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#E8571A" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={32} color="#FF3B30" />
          <Text style={styles.errorText}>
            {lang === 'fr' ? 'Impossible de charger les utilisateurs.' : 'Could not load users.'}
          </Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {search.trim()
              ? (lang === 'fr' ? 'Aucun résultat' : 'No results')
              : (lang === 'fr' ? 'Aucun utilisateur' : 'No users')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={u => u.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const meta = ROLE_META[item.role] ?? ROLE_META.user
            const displayName = item.full_name?.trim() || (lang === 'fr' ? 'Sans nom' : 'Unnamed')
            const initial = displayName.charAt(0).toUpperCase()
            const joinDate = formatJoinDate(item.joined_at, lang)
            const avatarColor = item.role === 'admin'
              ? '#E8571A'
              : item.role === 'restaurant_owner'
              ? '#007AFF'
              : '#E5E5EA'
            const avatarTextColor = item.role === 'user' ? '#8E8E93' : '#fff'

            return (
              <Pressable
                style={styles.row}
                onPress={() => router.push(`/admin/users/${item.id}` as any)}
              >
                {/* Avatar */}
                <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                  <Text style={[styles.avatarText, { color: avatarTextColor }]}>
                    {initial}
                  </Text>
                </View>

                {/* Name + email + join date */}
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>{displayName}</Text>
                  <Text style={styles.rowEmail} numberOfLines={1}>{item.email}</Text>
                  <Text style={styles.rowDate}>
                    {lang === 'fr' ? 'Inscrit' : 'Joined'} {joinDate}
                  </Text>
                </View>

                {/* Role badge */}
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <View style={[styles.roleBadge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.roleBadgeText, { color: meta.color }]}>
                      {lang === 'fr' ? meta.fr : meta.en}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#C7C7CC" />
                </View>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1C1C1E',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 15, color: '#8E8E93' },
  errorText: { fontSize: 14, color: '#FF3B30', textAlign: 'center', maxWidth: 240 },
  list: { paddingHorizontal: 16, gap: 8, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700' },
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  rowEmail: { fontSize: 13, color: '#3C3C43', opacity: 0.6 },
  rowDate: { fontSize: 11, color: '#C7C7CC', marginTop: 1 },
  roleBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },
})

/**
 * Admin — User role editor
 *
 * Lets an admin change a user's role:
 *   - user             → regular account, no special access
 *   - restaurant_owner → can manage a single linked place
 *   - admin            → full admin access (also sets is_admin = true)
 *
 * When setting restaurant_owner, a place picker appears so the admin
 * can link this user to the place they own (sets places.owner_id).
 */
import { Ionicons } from '@expo/vector-icons'
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
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '../../../lib/supabase'

type Role = 'user' | 'restaurant_owner' | 'admin'

interface UserProfile {
  id: string
  full_name: string | null
  role: Role
  is_admin: boolean
}

interface Place {
  id: string
  name: string
  owner_id: string | null
}

function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ['adminUserProfile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, is_admin')
        .eq('id', userId)
        .single()
      if (error) throw error
      return data as UserProfile
    },
    enabled: !!userId,
  })
}

function usePlacesForOwnerPicker() {
  return useQuery({
    queryKey: ['adminPlacesForPicker'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('places')
        .select('id, name, owner_id')
        .eq('is_deleted', false)
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []) as Place[]
    },
  })
}

function useCurrentOwnedPlace(userId: string) {
  return useQuery({
    queryKey: ['adminOwnedPlace', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('places')
        .select('id, name')
        .eq('owner_id', userId)
        .eq('is_deleted', false)
        .maybeSingle()
      return data as { id: string; name: string } | null
    },
    enabled: !!userId,
  })
}

const ROLES: { value: Role; labelFr: string; labelEn: string; icon: string; desc: { fr: string; en: string } }[] = [
  {
    value: 'user',
    labelFr: 'Utilisateur',
    labelEn: 'User',
    icon: 'person-outline',
    desc: {
      fr: 'Compte standard — peut sauvegarder des lieux et laisser des avis.',
      en: 'Standard account — can save places and leave reviews.',
    },
  },
  {
    value: 'restaurant_owner',
    labelFr: 'Propriétaire',
    labelEn: 'Restaurant Owner',
    icon: 'storefront-outline',
    desc: {
      fr: 'Peut modifier les infos et photos de son propre restaurant.',
      en: 'Can edit info and photos for their own restaurant.',
    },
  },
  {
    value: 'admin',
    labelFr: 'Administrateur',
    labelEn: 'Admin',
    icon: 'shield-checkmark-outline',
    desc: {
      fr: 'Accès complet à toutes les fonctions d\'administration.',
      en: 'Full access to all admin functions.',
    },
  },
]

export default function AdminUserEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const queryClient = useQueryClient()

  const { data: user, isLoading: userLoading } = useUserProfile(id)
  const { data: places, isLoading: placesLoading } = usePlacesForOwnerPicker()
  const { data: currentOwnedPlace } = useCurrentOwnedPlace(id)

  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [showPlacePicker, setShowPlacePicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [initialised, setInitialised] = useState(false)

  // Initialise state once user data arrives
  if (user && !initialised) {
    setSelectedRole(user.role ?? 'user')
    setInitialised(true)
  }
  if (currentOwnedPlace && !selectedPlaceId && !initialised) {
    setSelectedPlaceId(currentOwnedPlace.id)
  }
  // Set initial place selection when owned place loads (may arrive after init)
  if (currentOwnedPlace && selectedPlaceId === null && initialised) {
    setSelectedPlaceId(currentOwnedPlace.id)
  }

  const effectiveRole = selectedRole ?? user?.role ?? 'user'

  const selectedPlace = places?.find(p => p.id === selectedPlaceId) ?? null

  async function handleSave() {
    if (!user || !selectedRole) return

    if (selectedRole === 'restaurant_owner' && !selectedPlaceId) {
      Alert.alert(
        lang === 'fr' ? 'Lieu requis' : 'Place required',
        lang === 'fr'
          ? 'Veuillez sélectionner un restaurant à associer à ce propriétaire.'
          : 'Please select a restaurant to link to this owner.'
      )
      return
    }

    setSaving(true)
    try {
      // 1. Update profile role (and is_admin flag)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role: selectedRole,
          is_admin: selectedRole === 'admin',
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // 2. If previously owned a place and role is changing away from restaurant_owner,
      //    clear that place's owner_id
      if (user.role === 'restaurant_owner' && selectedRole !== 'restaurant_owner' && currentOwnedPlace) {
        await supabase
          .from('places')
          .update({ owner_id: null })
          .eq('id', currentOwnedPlace.id)
      }

      // 3. If restaurant_owner, link the selected place
      if (selectedRole === 'restaurant_owner' && selectedPlaceId) {
        // First clear owner_id from any place that might already have this user
        await supabase
          .from('places')
          .update({ owner_id: null })
          .eq('owner_id', user.id)
        // Then set the new one
        const { error: placeError } = await supabase
          .from('places')
          .update({ owner_id: user.id })
          .eq('id', selectedPlaceId)
        if (placeError) throw placeError
      }

      queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
      queryClient.invalidateQueries({ queryKey: ['adminUserProfile', user.id] })
      queryClient.invalidateQueries({ queryKey: ['adminOwnedPlace', user.id] })
      queryClient.invalidateQueries({ queryKey: ['adminPlacesForPicker'] })

      router.back()
    } catch (e: any) {
      Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', e?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (userLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color="#E8571A" />
        </View>
      </SafeAreaView>
    )
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>{lang === 'fr' ? 'Utilisateur introuvable' : 'User not found'}</Text>
        </View>
      </SafeAreaView>
    )
  }

  const displayName = user.full_name?.trim() || (lang === 'fr' ? 'Sans nom' : 'Unnamed')
  const initial = displayName.charAt(0).toUpperCase()
  const hasChanges = selectedRole !== user.role || (
    selectedRole === 'restaurant_owner' &&
    selectedPlaceId !== (currentOwnedPlace?.id ?? null)
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color="#1C1C1E" />
        </Pressable>
        <Text style={styles.title}>{lang === 'fr' ? 'Rôle utilisateur' : 'User Role'}</Text>
        <Pressable
          onPress={handleSave}
          disabled={saving || !hasChanges}
          hitSlop={10}
          style={[styles.saveBtn, (!hasChanges || saving) && { opacity: 0.4 }]}
        >
          {saving
            ? <ActivityIndicator size="small" color="#E8571A" />
            : <Text style={styles.saveBtnText}>{lang === 'fr' ? 'Enregistrer' : 'Save'}</Text>}
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* User card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userId}>{user.id.slice(0, 16)}…</Text>
          </View>
        </View>

        {/* Role picker */}
        <Text style={styles.sectionLabel}>
          {lang === 'fr' ? 'RÔLE' : 'ROLE'}
        </Text>
        <View style={styles.roleList}>
          {ROLES.map(role => {
            const isSelected = effectiveRole === role.value
            return (
              <Pressable
                key={role.value}
                style={[styles.roleRow, isSelected && styles.roleRowSelected]}
                onPress={() => {
                  setSelectedRole(role.value)
                  if (role.value !== 'restaurant_owner') {
                    setShowPlacePicker(false)
                  }
                }}
              >
                <View style={[styles.roleIcon, isSelected && { backgroundColor: 'rgba(232,87,26,0.12)' }]}>
                  <Ionicons
                    name={role.icon as any}
                    size={20}
                    color={isSelected ? '#E8571A' : '#8E8E93'}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.roleLabel, isSelected && { color: '#E8571A' }]}>
                    {lang === 'fr' ? role.labelFr : role.labelEn}
                  </Text>
                  <Text style={styles.roleDesc} numberOfLines={2}>
                    {lang === 'fr' ? role.desc.fr : role.desc.en}
                  </Text>
                </View>
                <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
              </Pressable>
            )
          })}
        </View>

        {/* Place picker — only shown when restaurant_owner is selected */}
        {effectiveRole === 'restaurant_owner' && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>
              {lang === 'fr' ? 'RESTAURANT ASSOCIÉ' : 'LINKED RESTAURANT'}
            </Text>
            <Pressable
              style={styles.placePickerBtn}
              onPress={() => setShowPlacePicker(v => !v)}
            >
              <Ionicons name="storefront-outline" size={18} color="#E8571A" />
              <Text style={[styles.placePickerText, !selectedPlace && { color: '#C7C7CC' }]} numberOfLines={1}>
                {selectedPlace
                  ? selectedPlace.name
                  : (lang === 'fr' ? 'Choisir un restaurant…' : 'Choose a restaurant…')}
              </Text>
              <Ionicons
                name={showPlacePicker ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#C7C7CC"
              />
            </Pressable>

            {showPlacePicker && (
              <View style={styles.placeDropdown}>
                {placesLoading ? (
                  <ActivityIndicator color="#E8571A" style={{ padding: 16 }} />
                ) : (places ?? []).map(place => {
                  const isOwnedByOther = place.owner_id && place.owner_id !== user.id
                  return (
                    <Pressable
                      key={place.id}
                      style={[
                        styles.placeOption,
                        selectedPlaceId === place.id && styles.placeOptionSelected,
                      ]}
                      onPress={() => {
                        setSelectedPlaceId(place.id)
                        setShowPlacePicker(false)
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[
                          styles.placeOptionText,
                          selectedPlaceId === place.id && { color: '#E8571A', fontWeight: '700' },
                        ]} numberOfLines={1}>
                          {place.name}
                        </Text>
                        {isOwnedByOther && (
                          <Text style={styles.placeOptionOwned}>
                            {lang === 'fr' ? 'Déjà associé à un propriétaire' : 'Already linked to an owner'}
                          </Text>
                        )}
                      </View>
                      {selectedPlaceId === place.id && (
                        <Ionicons name="checkmark" size={16} color="#E8571A" />
                      )}
                    </Pressable>
                  )
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, color: '#8E8E93' },
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
  saveBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#E8571A' },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 16,
    padding: 16,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#E8571A',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: '#fff' },
  userName: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  userId: { fontSize: 12, color: '#C7C7CC', marginTop: 2 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  roleList: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  roleRowSelected: {
    backgroundColor: 'rgba(232,87,26,0.04)',
  },
  roleIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  roleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  roleDesc: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 16,
  },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#C7C7CC',
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuterSelected: { borderColor: '#E8571A' },
  radioInner: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#E8571A',
  },
  placePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 14,
  },
  placePickerText: {
    flex: 1,
    fontSize: 15,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  placeDropdown: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  placeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    gap: 10,
  },
  placeOptionSelected: {
    backgroundColor: 'rgba(232,87,26,0.05)',
  },
  placeOptionText: {
    fontSize: 15,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  placeOptionOwned: {
    fontSize: 11,
    color: '#FF9500',
    marginTop: 2,
  },
})

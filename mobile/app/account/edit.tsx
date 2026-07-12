import { Ionicons } from '@expo/vector-icons'
import { useQueryClient } from '@tanstack/react-query'
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { decode as decodeBase64 } from 'base64-arraybuffer'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useThemeColors } from '../../contexts/ThemeContext'
import type { ThemeColors } from '../../constants/themes'
import { useSession } from '../../hooks/useSession'
import { useProfile } from '../../hooks/useProfile'
import { supabase } from '../../lib/supabase'

const ORANGE = '#E8571A'
const RED    = '#FF3B30'

// Uploads a JPEG into `avatars/{user_id}/avatar.jpg` and returns the
// public URL we'll write into profiles.avatar_url.
async function uploadAvatar(userId: string, uri: string): Promise<string> {
  // Re-encode + downscale before upload so we always end up with a
  // reasonable JPEG no matter what the picker gave us.
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 512 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  )
  if (!manipulated.base64) throw new Error('Image manipulation returned no base64')

  const path = `${userId}/avatar.jpg`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, decodeBase64(manipulated.base64), {
      contentType: 'image/jpeg',
      upsert: true,
    })
  if (error) throw error

  // Public URL + cache-buster so the new image actually shows up
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}`
}

export default function AccountEditScreen() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const colors = useThemeColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { session, loading: sessionLoading } = useSession()
  const { displayName, avatarUrl } = useProfile()
  const queryClient = useQueryClient()

  // If the user somehow lands here logged-out, bounce back — but only once
  // the session check has actually resolved, otherwise the initial
  // loading tick (session=null) bounces logged-in users too.
  useEffect(() => {
    if (!sessionLoading && !session) router.replace('/(tabs)/profile' as any)
  }, [session, sessionLoading])

  // Form state
  const [name, setName] = useState(displayName === 'User' ? '' : (displayName ?? ''))
  const [avatar, setAvatar] = useState<string | null>(avatarUrl)

  // Session and profile load asynchronously. If this screen mounts before
  // they arrive, the fields above initialize blank/stale. Hydrate them once
  // the data is available, but only while the field still holds its initial
  // empty value so we never clobber something the user has started typing.
  useEffect(() => {
    if (!name && displayName && displayName !== 'User') setName(displayName)
  }, [displayName, name])
  useEffect(() => {
    if (avatar == null && avatarUrl) setAvatar(avatarUrl)
  }, [avatarUrl, avatar])

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')

  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // ─── Avatar picker + upload ──────────────────────────────────────────
  async function pickAvatar() {
    if (!session) return
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(
        lang === 'fr' ? 'Accès requis' : 'Permission needed',
        lang === 'fr' ? 'Autorisez l\'accès aux photos pour choisir un avatar.' : 'Allow photo access to pick an avatar.',
      )
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    })
    if (result.canceled || !result.assets[0]?.uri) return

    setSavingProfile(true)
    try {
      const publicUrl = await uploadAvatar(session.user.id, result.assets[0].uri)
      setAvatar(publicUrl)
      // Commit immediately — a picked photo is already a confirmed choice
      // (browse → crop → choose). Requiring the separate "Save" tap below
      // silently lost the photo for anyone who left the screen first.
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', session.user.id)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', message)
    } finally {
      setSavingProfile(false)
    }
  }

  // ─── Save name + avatar to profiles ─────────────────────────────────
  async function saveProfile() {
    if (!session) return
    const trimmedName = name.trim()
    if (trimmedName.length < 2) {
      Alert.alert(
        lang === 'fr' ? 'Nom trop court' : 'Name too short',
        lang === 'fr' ? 'Veuillez saisir au moins 2 caractères.' : 'Please enter at least 2 characters.',
      )
      return
    }
    setSavingProfile(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: trimmedName, avatar_url: avatar })
        .eq('id', session.user.id)
      if (error) throw error
      // Tell every screen holding cached profile data (profile tab header,
      // reviews, etc.) to refetch — otherwise the old name keeps showing
      // until the app is force-quit.
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      Alert.alert(
        lang === 'fr' ? 'Enregistré ✓' : 'Saved ✓',
        lang === 'fr' ? 'Profil mis à jour.' : 'Profile updated.',
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed'
      Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', message)
    } finally {
      setSavingProfile(false)
    }
  }

  // ─── Change password ────────────────────────────────────────────────
  async function changePassword() {
    if (newPassword.length < 8) {
      Alert.alert(
        lang === 'fr' ? 'Mot de passe trop court' : 'Password too short',
        lang === 'fr' ? 'Au moins 8 caractères.' : 'At least 8 characters.',
      )
      return
    }
    if (!session?.user.email || !currentPassword) {
      Alert.alert(
        lang === 'fr' ? 'Mot de passe actuel requis' : 'Current password required',
        lang === 'fr' ? 'Saisissez votre mot de passe actuel pour confirmer.' : 'Enter your current password to confirm.',
      )
      return
    }
    setSavingPassword(true)
    try {
      // Re-verify current password by signing in with it. If wrong, we'll get an error
      // here and stop. If correct, Supabase replaces the session — same user, same row.
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword,
      })
      if (signInErr) throw new Error(
        lang === 'fr' ? 'Mot de passe actuel incorrect.' : 'Current password incorrect.',
      )
      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword })
      if (updErr) throw updErr
      setCurrentPassword('')
      setNewPassword('')
      Alert.alert(
        lang === 'fr' ? 'Mot de passe modifié ✓' : 'Password changed ✓',
        lang === 'fr' ? 'Votre nouveau mot de passe est actif.' : 'Your new password is active.',
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Password change failed'
      Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', message)
    } finally {
      setSavingPassword(false)
    }
  }

  // ─── Delete account (double confirm) ─────────────────────────────────
  function confirmDelete() {
    Alert.alert(
      lang === 'fr' ? 'Supprimer le compte ?' : 'Delete account?',
      lang === 'fr'
        ? 'Ceci est irréversible. Vos favoris, coupons et crédit seront supprimés. Vos avis resteront visibles avec votre prénom mais sans lien vers votre compte.'
        : 'This is permanent. Your favourites, coupons, and credit will be deleted. Your reviews stay visible with your first name but no longer link to an account.',
      [
        { text: lang === 'fr' ? 'Annuler' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'fr' ? 'Continuer' : 'Continue',
          style: 'destructive',
          onPress: secondConfirm,
        },
      ],
    )
  }
  function secondConfirm() {
    Alert.alert(
      lang === 'fr' ? 'Vraiment supprimer ?' : 'Really delete?',
      lang === 'fr' ? 'Dernière chance. On y va ?' : 'Last chance. Proceed?',
      [
        { text: lang === 'fr' ? 'Non' : 'No', style: 'cancel' },
        { text: lang === 'fr' ? 'Oui, supprimer' : 'Yes, delete', style: 'destructive', onPress: doDelete },
      ],
    )
  }
  async function doDelete() {
    setDeleting(true)
    try {
      const { error } = await supabase.rpc('delete_my_account')
      if (error) throw error
      // The server deleted auth.users; sign out locally to clear the
      // cached session before navigating away.
      await supabase.auth.signOut()
      router.replace('/(tabs)' as any)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Delete failed'
      Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', message)
      setDeleting(false)
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {lang === 'fr' ? 'Mon compte' : 'My account'}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <Pressable onPress={pickAvatar} style={styles.avatarBtn}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={48} color={colors.textSecondary} />
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </Pressable>
            <Text style={[styles.avatarHint, { color: colors.textSecondary }]}>
              {lang === 'fr' ? 'Appuyez pour changer la photo' : 'Tap to change photo'}
            </Text>
          </View>

          {/* Name + avatar save row */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {lang === 'fr' ? 'Nom complet' : 'Full name'}
            </Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.inputBorder }]}
              value={name}
              onChangeText={setName}
              placeholder={lang === 'fr' ? 'Votre nom' : 'Your name'}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
            />
            <Pressable
              style={[styles.primaryBtn, savingProfile && styles.primaryBtnDisabled]}
              onPress={saveProfile}
              disabled={savingProfile}
            >
              {savingProfile
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>{lang === 'fr' ? 'Enregistrer' : 'Save'}</Text>}
            </Pressable>
          </View>

          {/* Email — read-only for now; the change-email flow was removed
              on purpose (founder decision 2026-07-12). Users still see which
              account they're signed into. */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {lang === 'fr' ? 'Adresse email' : 'Email'}
            </Text>
            <Text style={[styles.input, { color: colors.textSecondary, borderColor: colors.inputBorder, paddingTop: 14 }]}>
              {session?.user.email ?? ''}
            </Text>
          </View>

          {/* Password */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {lang === 'fr' ? 'Changer le mot de passe' : 'Change password'}
            </Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.inputBorder }]}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder={lang === 'fr' ? 'Mot de passe actuel' : 'Current password'}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.inputBorder, marginTop: 8 }]}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder={lang === 'fr' ? 'Nouveau mot de passe (8+ caractères)' : 'New password (8+ chars)'}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
            />
            <Pressable
              style={[
                styles.primaryBtn,
                (savingPassword || !currentPassword || !newPassword) && styles.primaryBtnDisabled,
              ]}
              onPress={changePassword}
              disabled={savingPassword || !currentPassword || !newPassword}
            >
              {savingPassword
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>
                    {lang === 'fr' ? 'Mettre à jour le mot de passe' : 'Update password'}
                  </Text>}
            </Pressable>
          </View>

          {/* Danger zone */}
          <View style={[styles.section, styles.dangerSection]}>
            <Text style={[styles.dangerHeader, { color: RED }]}>
              {lang === 'fr' ? 'Zone dangereuse' : 'Danger zone'}
            </Text>
            <Text style={[styles.hint, { color: colors.textSecondary, marginBottom: 12 }]}>
              {lang === 'fr'
                ? 'Supprimer votre compte est définitif. Vos avis resteront visibles avec votre prénom mais ne seront plus liés à votre compte.'
                : 'Deleting your account is permanent. Your reviews stay visible with your first name but no longer link to an account.'}
            </Text>
            <Pressable
              style={[styles.dangerBtn, deleting && { opacity: 0.5 }]}
              onPress={confirmDelete}
              disabled={deleting}
            >
              {deleting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.dangerBtnText}>
                    {lang === 'fr' ? 'Supprimer mon compte' : 'Delete my account'}
                  </Text>}
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  avatarSection: { alignItems: 'center', marginVertical: 16 },
  avatarBtn: { position: 'relative' },
  avatar: { width: 112, height: 112, borderRadius: 56 },
  avatarFallback: {
    backgroundColor: colors.thumbFallback,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: ORANGE,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bgPrimary,
  },
  avatarHint: { fontSize: 13, marginTop: 8 },

  section: { marginTop: 24 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  hint: { fontSize: 12, marginTop: 8 },

  primaryBtn: {
    backgroundColor: ORANGE,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  dangerSection: {
    marginTop: 40,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  dangerHeader: { fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  dangerBtn: {
    backgroundColor: RED,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  dangerBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})

import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Linking from 'expo-linking'

import { supabase } from '../lib/supabase'
import { useThemeColors } from '../contexts/ThemeContext'
import { ThemeColors } from '../constants/themes'

// Landing screen for the password-recovery email link
// (okili://reset-password?code=... — PKCE flow). Exchanges the code for a
// session, then lets the user set a new password.
export default function ResetPasswordScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const colors = useThemeColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const params = useLocalSearchParams<{ code?: string }>()
  const url = Linking.useURL()

  const [phase, setPhase] = useState<'exchanging' | 'form' | 'invalid'>('exchanging')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function establishSession() {
      try {
        // Primary path: PKCE code in the query string.
        const code = typeof params.code === 'string' ? params.code.split('#')[0] : null
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
          if (!cancelled) setPhase('form')
          return
        }
        // Fallback: implicit-flow tokens in the URL fragment.
        const fragment = url?.split('#')[1] ?? ''
        const frag = new URLSearchParams(fragment)
        const accessToken = frag.get('access_token')
        const refreshToken = frag.get('refresh_token')
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) throw error
          if (!cancelled) setPhase('form')
          return
        }
        // No token — maybe the user already has a recovery session (re-entry).
        const { data } = await supabase.auth.getSession()
        if (!cancelled) setPhase(data.session ? 'form' : 'invalid')
      } catch {
        if (!cancelled) setPhase('invalid')
      }
    }
    establishSession()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code, url])

  async function handleSave() {
    if (password.length < 6) {
      Alert.alert(
        lang === 'fr' ? 'Mot de passe trop court' : 'Password too short',
        lang === 'fr' ? 'Utilisez au moins 6 caractères.' : 'Use at least 6 characters.'
      )
      return
    }
    if (password !== confirm) {
      Alert.alert(
        lang === 'fr' ? 'Les mots de passe ne correspondent pas' : 'Passwords do not match',
        lang === 'fr' ? 'Vérifiez les deux champs.' : 'Please check both fields.'
      )
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      Alert.alert(
        lang === 'fr' ? 'Mot de passe modifié' : 'Password updated',
        lang === 'fr' ? 'Vous êtes connecté avec votre nouveau mot de passe.' : 'You are signed in with your new password.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ''
      Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', message || (lang === 'fr' ? 'Réessayez.' : 'Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 24 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>
        {lang === 'fr' ? 'Nouveau mot de passe' : 'New password'}
      </Text>

      {phase === 'exchanging' && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.surfaceInverted} />
        </View>
      )}

      {phase === 'invalid' && (
        <View style={styles.center}>
          <Text style={styles.hint}>
            {lang === 'fr'
              ? 'Ce lien de réinitialisation est invalide ou a expiré. Demandez un nouveau lien depuis l\'écran de connexion.'
              : 'This reset link is invalid or has expired. Request a new link from the login screen.'}
          </Text>
          <Pressable style={styles.button} onPress={() => router.replace('/auth/login')}>
            <Text style={styles.buttonText}>
              {lang === 'fr' ? 'Retour à la connexion' : 'Back to login'}
            </Text>
          </Pressable>
        </View>
      )}

      {phase === 'form' && (
        <View>
          <Text style={styles.hint}>
            {lang === 'fr'
              ? 'Choisissez un nouveau mot de passe pour votre compte.'
              : 'Choose a new password for your account.'}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={lang === 'fr' ? 'Nouveau mot de passe' : 'New password'}
            placeholderTextColor={colors.textPlaceholder}
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            style={styles.input}
            placeholder={lang === 'fr' ? 'Confirmer le mot de passe' : 'Confirm password'}
            placeholderTextColor={colors.textPlaceholder}
            secureTextEntry
            autoCapitalize="none"
            value={confirm}
            onChangeText={setConfirm}
          />
          <Pressable
            style={[styles.button, saving && { opacity: 0.6 }]}
            disabled={saving}
            onPress={handleSave}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>{lang === 'fr' ? 'Enregistrer' : 'Save'}</Text>}
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary, paddingHorizontal: 24 },
    title: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },
    center: { marginTop: 32, alignItems: 'center', gap: 16 },
    hint: { fontSize: 15, color: colors.textSecondary, marginBottom: 16, lineHeight: 21 },
    input: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.inputBg,
      marginBottom: 12,
    },
    button: {
      backgroundColor: colors.surfaceInverted,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 4,
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  })
}

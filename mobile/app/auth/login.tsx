import * as AppleAuthentication from 'expo-apple-authentication'
import * as WebBrowser from 'expo-web-browser'
import { router } from 'expo-router'
import { useState } from 'react'
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

import { supabase } from '../../lib/supabase'

// Required for expo-web-browser OAuth redirect handling
WebBrowser.maybeCompleteAuthSession()

type Mode = 'login' | 'register'

export default function LoginScreen() {
  const { t } = useTranslation()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // --- Email / Password ---
  async function handleEmailAuth() {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('errors.generic'))
      return
    }

    setLoading(true)
    try {
      let error
      if (mode === 'register') {
        ;({ error } = await supabase.auth.signUp({ email: email.trim(), password }))
      } else {
        ;({ error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        }))
      }

      if (error) throw error
      // Root layout's onAuthStateChange fires → session is set → navigate home
      router.replace('/(tabs)')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('errors.generic')
      Alert.alert(message)
    } finally {
      setLoading(false)
    }
  }

  // --- Google OAuth ---
  // We hardcode the redirect URI because makeRedirectUri() returns the Expo dev client
  // URL (exp+okili://...) in dev builds, which doesn't match the okili:// scheme
  // registered in Supabase and Google Cloud Console.
  const REDIRECT_URI = 'okili://'

  async function handleGoogleSignIn() {
    setLoading(true)
    try {
      // Get the Supabase OAuth URL without auto-opening a browser
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: REDIRECT_URI, skipBrowserRedirect: true },
      })
      if (error) throw error
      if (!data.url) throw new Error('No OAuth URL returned')

      // Open Google's login page in a secure in-app browser
      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI)

      if (result.type === 'success') {
        // The callback URL looks like: okili:?code=xxxx%23
        // URLSearchParams decodes %23 → '#', so we split on '#' to get the clean code
        const queryStr = result.url.split('?')[1] ?? ''
        const code = new URLSearchParams(queryStr).get('code')?.split('#')[0]
        if (!code) throw new Error('No code in OAuth callback URL')
        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
        if (sessionError) throw sessionError
        router.replace('/(tabs)')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('errors.generic')
      Alert.alert(message)
    } finally {
      setLoading(false)
    }
  }

  // --- Apple Sign-In (iOS only) ---
  async function handleAppleSignIn() {
    setLoading(true)
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      })

      if (!credential.identityToken) throw new Error('No identity token from Apple')

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      })
      if (error) throw error
      router.replace('/(tabs)')
    } catch (err: unknown) {
      // ERR_CANCELED means user dismissed the sheet — not an error
      if ((err as { code?: string }).code === 'ERR_CANCELED') return
      const message = err instanceof Error ? err.message : t('errors.generic')
      Alert.alert(message)
    } finally {
      setLoading(false)
    }
  }

  const isLogin = mode === 'login'

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand header */}
        <View style={styles.header}>
          <Text style={styles.brand}>O'Kili</Text>
          <Text style={styles.tagline}>{t('app.tagline')}</Text>
        </View>

        {/* Mode toggle */}
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleBtn, isLogin && styles.toggleActive]}
            onPress={() => setMode('login')}
          >
            <Text style={[styles.toggleText, isLogin && styles.toggleTextActive]}>
              {t('auth.login')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, !isLogin && styles.toggleActive]}
            onPress={() => setMode('register')}
          >
            <Text style={[styles.toggleText, !isLogin && styles.toggleTextActive]}>
              {t('auth.register')}
            </Text>
          </Pressable>
        </View>

        {/* Email / Password form */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder={t('auth.email')}
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <TextInput
            style={styles.input}
            placeholder={t('auth.password')}
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            textContentType={isLogin ? 'password' : 'newPassword'}
          />

          {isLogin && (
            <Pressable style={styles.forgotBtn}>
              <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
            onPress={handleEmailAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {isLogin ? t('auth.login') : t('auth.register')}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('auth.or')}</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social buttons */}
        <View style={styles.socialButtons}>
          <Pressable
            style={[styles.socialBtn, loading && styles.socialBtnDisabled]}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            {/* Google "G" mark — simple text placeholder */}
            <Text style={styles.socialIcon}>G</Text>
            <Text style={styles.socialBtnText}>{t('auth.continueWithGoogle')}</Text>
          </Pressable>

          {/* Apple Sign-In only available on iOS */}
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={styles.appleBtn}
              onPress={handleAppleSignIn}
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const ORANGE = '#E8571A'

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  // Brand
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brand: {
    fontSize: 40,
    fontWeight: '800',
    color: ORANGE,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  // Toggle
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  toggleTextActive: {
    color: '#1F2937',
    fontWeight: '600',
  },
  // Form
  form: {
    gap: 12,
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1F2937',
  },
  forgotBtn: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    fontSize: 13,
    color: ORANGE,
    fontWeight: '500',
  },
  primaryBtn: {
    backgroundColor: ORANGE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  // Social
  socialButtons: {
    gap: 12,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  socialBtnDisabled: {
    opacity: 0.6,
  },
  socialIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4285F4',
  },
  socialBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  appleBtn: {
    height: 50,
    width: '100%',
  },
})

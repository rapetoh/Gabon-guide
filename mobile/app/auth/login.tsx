import * as AppleAuthentication from 'expo-apple-authentication'
import * as WebBrowser from 'expo-web-browser'
import { router, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
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
import { useThemeColors } from '../../contexts/ThemeContext'
import { ThemeColors } from '../../constants/themes'

// Required for expo-web-browser OAuth redirect handling
WebBrowser.maybeCompleteAuthSession()

type Mode = 'login' | 'register'

export default function LoginScreen() {
  const { t } = useTranslation()
  const colors = useThemeColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const { redirect } = useLocalSearchParams<{ redirect?: string }>()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)

  function navigateAfterAuth() {
    if (redirect) {
      router.replace(redirect as any)
    } else {
      router.replace('/(tabs)')
    }
  }

  // --- Email / Password ---
  async function handleEmailAuth() {
    const emailTrimmed = email.trim()
    const passwordTrimmed = password.trim()

    if (!emailTrimmed || !passwordTrimmed) {
      Alert.alert(
        t('errors.generic'),
        t('auth.fillAllFields') ?? 'Please fill in all fields.'
      )
      return
    }

    // Basic email format check before hitting the server
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      Alert.alert(
        t('auth.invalidEmail') ?? 'Invalid email',
        t('auth.invalidEmailHint') ?? 'Please enter a valid email address.'
      )
      return
    }

    setLoading(true)
    try {
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: emailTrimmed,
          password: passwordTrimmed,
          options: { data: { full_name: fullName.trim() || null } },
        })
        if (error) throw error

        // Supabase requires email confirmation — user needs to verify before logging in
        if (data.user && !data.session) {
          Alert.alert(
            t('auth.checkEmail') ?? 'Check your email',
            t('auth.checkEmailHint') ?? `We sent a confirmation link to ${emailTrimmed}. Click it to activate your account.`
          )
          return
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailTrimmed,
          password: passwordTrimmed,
        })
        if (error) throw error
      }

      // Root layout's onAuthStateChange fires → session is set → navigate back to context
      navigateAfterAuth()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('errors.generic')
      Alert.alert(t('errors.generic'), message)
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    const emailTrimmed = email.trim()
    if (!emailTrimmed) {
      Alert.alert(
        t('auth.forgotPassword') ?? 'Reset password',
        t('auth.enterEmailFirst') ?? 'Enter your email address above, then tap "Forgot password".'
      )
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailTrimmed, {
        redirectTo: 'okili://reset-password',
      })
      if (error) throw error
      Alert.alert(
        t('auth.resetSent') ?? 'Email sent',
        t('auth.resetSentHint') ?? `We sent a password reset link to ${emailTrimmed}.`
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('errors.generic')
      Alert.alert(t('errors.generic'), message)
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
        navigateAfterAuth()
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
          {!isLogin && (
            <TextInput
              style={styles.input}
              placeholder={t('auth.fullName') ?? 'Full name'}
              placeholderTextColor={colors.textPlaceholder}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
            />
          )}
          <TextInput
            style={styles.input}
            placeholder={t('auth.email')}
            placeholderTextColor={colors.textPlaceholder}
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
            placeholderTextColor={colors.textPlaceholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            textContentType={isLogin ? 'password' : 'newPassword'}
          />

          {isLogin && (
            <Pressable style={styles.forgotBtn} onPress={handleForgotPassword} disabled={loading}>
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

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.surfaceElevated,
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
      color: c.textSecondary,
      marginTop: 4,
    },
    // Toggle
    toggleRow: {
      flexDirection: 'row',
      backgroundColor: c.toggleBg,
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
      backgroundColor: c.toggleActive,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    toggleText: {
      fontSize: 14,
      fontWeight: '500',
      color: c.textSecondary,
    },
    toggleTextActive: {
      color: c.textPrimary,
      fontWeight: '600',
    },
    // Form
    form: {
      gap: 12,
      marginBottom: 24,
    },
    input: {
      backgroundColor: c.inputBg,
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      color: c.inputText,
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
      backgroundColor: c.divider,
    },
    dividerText: {
      fontSize: 13,
      color: c.textSecondary,
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
      borderColor: c.inputBorder,
      borderRadius: 12,
      paddingVertical: 14,
      gap: 10,
      backgroundColor: c.inputBg,
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
      color: c.textPrimary,
    },
    appleBtn: {
      height: 50,
      width: '100%',
    },
  })
}

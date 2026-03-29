import AsyncStorage from '@react-native-async-storage/async-storage'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ONBOARDING_KEY } from '../_layout'
import { useThemeColors } from '../../contexts/ThemeContext'

async function skipOnboarding() {
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true')
  router.replace('/(tabs)' as any)
}

export default function OnboardingWelcome() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const insets = useSafeAreaInsets()
  const colors = useThemeColors()

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      {/* Skip button */}
      <Pressable style={styles.skipBtn} onPress={skipOnboarding} hitSlop={12}>
        <Text style={[styles.skipText, { color: colors.textSecondary }]}>
          {lang === 'fr' ? 'Passer' : 'Skip'}
        </Text>
      </Pressable>

      {/* Progress bar */}
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: '25%', backgroundColor: '#E8571A' }]} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.emoji]}>🌍</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {lang === 'fr' ? 'Bienvenue sur O\'Kili' : 'Welcome to O\'Kili'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {lang === 'fr'
            ? 'Découvrez les meilleurs restaurants, bars et activités à Libreville.'
            : 'Discover the best restaurants, bars and activities in Libreville.'}
        </Text>
      </View>

      {/* Next */}
      <Pressable
        style={styles.nextBtn}
        onPress={() => router.push('/onboarding/areas' as any)}
      >
        <Text style={styles.nextText}>
          {lang === 'fr' ? 'Commencer →' : 'Get started →'}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  skipBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
  },
  skipText: {
    fontSize: 15,
  },
  progress: {
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    marginTop: 16,
    marginBottom: 48,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  emoji: {
    fontSize: 64,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 300,
  },
  nextBtn: {
    backgroundColor: '#E8571A',
    paddingVertical: 18,
    borderRadius: 28,
    alignItems: 'center',
  },
  nextText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
})

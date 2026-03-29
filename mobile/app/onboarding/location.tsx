import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ONBOARDING_KEY } from '../_layout'
import { useThemeColors } from '../../contexts/ThemeContext'

async function finishOnboarding() {
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true')
  router.replace('/(tabs)' as any)
}

export default function OnboardingLocation() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const insets = useSafeAreaInsets()
  const colors = useThemeColors()

  async function handleAllow() {
    await Location.requestForegroundPermissionsAsync()
    await finishOnboarding()
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      {/* Skip */}
      <Pressable style={styles.skipBtn} onPress={finishOnboarding} hitSlop={12}>
        <Text style={[styles.skipText, { color: colors.textSecondary }]}>
          {lang === 'fr' ? 'Passer' : 'Skip'}
        </Text>
      </Pressable>

      {/* Progress — full */}
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: '100%', backgroundColor: '#E8571A' }]} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.emoji}>📍</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {lang === 'fr' ? 'Restaurants près de vous' : 'Places near you'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {lang === 'fr'
            ? 'Activez la localisation pour voir les restaurants et activités autour de vous.'
            : 'Enable location to discover restaurants and activities around you.'}
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable style={styles.allowBtn} onPress={handleAllow}>
          <Text style={styles.allowText}>
            {lang === 'fr' ? '📍 Activer la localisation' : '📍 Allow location'}
          </Text>
        </Pressable>
        <Pressable style={styles.laterBtn} onPress={finishOnboarding}>
          <Text style={[styles.laterText, { color: colors.textSecondary }]}>
            {lang === 'fr' ? 'Pas maintenant' : 'Not now'}
          </Text>
        </Pressable>
      </View>
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
    paddingBottom: 40,
  },
  emoji: {
    fontSize: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 300,
  },
  actions: {
    gap: 12,
  },
  allowBtn: {
    backgroundColor: '#E8571A',
    paddingVertical: 18,
    borderRadius: 28,
    alignItems: 'center',
  },
  allowText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  laterBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  laterText: {
    fontSize: 15,
  },
})

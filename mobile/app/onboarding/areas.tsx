import AsyncStorage from '@react-native-async-storage/async-storage'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ONBOARDING_KEY } from '../_layout'
import { useThemeColors } from '../../contexts/ThemeContext'
import { useZones } from '../../hooks/useZones'

const PREF_ZONES_KEY = 'onboarding_preferred_zones'

async function skipOnboarding() {
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true')
  router.replace('/(tabs)' as any)
}

export default function OnboardingAreas() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const insets = useSafeAreaInsets()
  const colors = useThemeColors()
  const { data: zones } = useZones()
  const [selected, setSelected] = useState<string[]>([])

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(z => z !== id) : [...prev, id])
  }

  async function handleNext() {
    await AsyncStorage.setItem(PREF_ZONES_KEY, JSON.stringify(selected))
    router.push('/onboarding/preferences' as any)
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      {/* Skip */}
      <Pressable style={styles.skipBtn} onPress={skipOnboarding} hitSlop={12}>
        <Text style={[styles.skipText, { color: colors.textSecondary }]}>
          {lang === 'fr' ? 'Passer' : 'Skip'}
        </Text>
      </Pressable>

      {/* Progress */}
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: '50%', backgroundColor: '#E8571A' }]} />
      </View>

      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {lang === 'fr' ? 'Vos quartiers' : 'Your neighbourhoods'}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {lang === 'fr' ? 'Sélectionnez un ou plusieurs quartiers' : 'Select one or more areas'}
      </Text>

      <ScrollView style={{ flex: 1, marginTop: 24 }} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {(zones ?? []).map(zone => {
            const active = selected.includes(zone.id)
            return (
              <Pressable
                key={zone.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggle(zone.id)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {zone.name}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>

      <Pressable style={styles.nextBtn} onPress={handleNext}>
        <Text style={styles.nextText}>
          {lang === 'fr' ? 'Suivant →' : 'Next →'}
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
    marginBottom: 32,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 24,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
  },
  chipActive: {
    backgroundColor: '#E8571A',
    borderColor: '#E8571A',
  },
  chipText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#3C3C43',
  },
  chipTextActive: {
    color: '#fff',
  },
  nextBtn: {
    backgroundColor: '#E8571A',
    paddingVertical: 18,
    borderRadius: 28,
    alignItems: 'center',
    marginTop: 16,
  },
  nextText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
})

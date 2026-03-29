import AsyncStorage from '@react-native-async-storage/async-storage'
import { router } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ONBOARDING_KEY } from '../_layout'
import { useThemeColors } from '../../contexts/ThemeContext'
import { supabase } from '../../lib/supabase'

const PREF_VIBES_KEY = 'onboarding_preferred_vibes'
const PREF_ZONES_KEY = 'onboarding_preferred_zones'

const VIBES_FR = ['Restaurants', 'Bars', 'Nightlife', 'Brunch', 'Date Night', 'Happy Hour', 'Familial', 'Terrasse', 'Rapide']
const VIBES_EN = ['Restaurants', 'Bars', 'Nightlife', 'Brunch', 'Date Night', 'Happy Hour', 'Family', 'Outdoor', 'Quick Bite']

async function skipOnboarding() {
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true')
  router.replace('/(tabs)' as any)
}

export default function OnboardingPreferences() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const insets = useSafeAreaInsets()
  const colors = useThemeColors()
  const [selected, setSelected] = useState<string[]>([])

  const vibes = lang === 'fr' ? VIBES_FR : VIBES_EN

  function toggle(vibe: string) {
    setSelected(prev => prev.includes(vibe) ? prev.filter(v => v !== vibe) : [...prev, vibe])
  }

  async function handleContinue() {
    await AsyncStorage.setItem(PREF_VIBES_KEY, JSON.stringify(selected))

    // If user is logged in, save preferences to their profile
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const zones = JSON.parse(await AsyncStorage.getItem(PREF_ZONES_KEY) ?? '[]') as string[]
      await supabase
        .from('profiles')
        .update({ preferred_vibes: selected, preferred_zones: zones })
        .eq('id', session.user.id)
    }

    router.push('/onboarding/location' as any)
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
        <View style={[styles.progressFill, { width: '75%', backgroundColor: '#E8571A' }]} />
      </View>

      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {lang === 'fr' ? 'Vos préférences' : 'Your preferences'}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {lang === 'fr' ? 'Qu\'est-ce que vous aimez ?' : 'What do you enjoy?'}
      </Text>

      <ScrollView style={{ flex: 1, marginTop: 24 }} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {vibes.map(vibe => {
            const active = selected.includes(vibe)
            return (
              <Pressable
                key={vibe}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggle(vibe)}
              >
                {active && <Text style={styles.check}>✓ </Text>}
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{vibe}</Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>

      <Pressable style={styles.nextBtn} onPress={handleContinue}>
        <Text style={styles.nextText}>
          {lang === 'fr' ? 'Continuer →' : 'Continue →'}
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
    flexDirection: 'row',
    alignItems: 'center',
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
  check: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '700',
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

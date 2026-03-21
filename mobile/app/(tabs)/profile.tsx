import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import AppBackground from '../../components/AppBackground'
import { useTheme } from '../../contexts/ThemeContext'
import { useTranslation } from 'react-i18next'
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useSession } from '../../hooks/useSession'
import { useProfile } from '../../hooks/useProfile'
import { supabase } from '../../lib/supabase'

export default function ProfileScreen() {
  const { t, i18n } = useTranslation()
  const { session } = useSession()
  const { theme, setTheme } = useTheme()
  const { isAdmin } = useIsAdmin()
  const { displayName, avatarUrl } = useProfile()
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  const handleLogout = () => supabase.auth.signOut()

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Text style={styles.title}>{lang === 'fr' ? 'Profil' : 'Profile'}</Text>

        {session ? (
          <View style={styles.profileCard}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.displayName} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.memberSince}>
                {lang === 'fr' ? 'Membre O\'Kili' : 'O\'Kili member'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.authCard}>
            <View style={styles.authIcon}>
              <Ionicons name="person-outline" size={36} color="#E8571A" />
            </View>
            <Text style={styles.authTitle}>
              {lang === 'fr' ? 'Rejoignez O\'Kili' : 'Join O\'Kili'}
            </Text>
            <Text style={styles.authBody}>
              {lang === 'fr'
                ? 'Connectez-vous pour sauvegarder vos lieux favoris.'
                : 'Log in to save your favourite places.'}
            </Text>
            <Pressable style={styles.loginBtn} onPress={() => router.push('/auth/login')}>
              <Text style={styles.loginBtnText}>{t('auth.login')}</Text>
            </Pressable>
          </View>
        )}

        {/* Settings */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsHeader}>
            {lang === 'fr' ? 'Préférences' : 'Preferences'}
          </Text>

          {/* Language toggle */}
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: 'rgba(0,122,255,0.1)' }]}>
              <Ionicons name="globe-outline" size={18} color="#007AFF" />
            </View>
            <Text style={styles.rowLabel}>{t('settings.language')}</Text>
            <View style={styles.segmentWrap}>
              <Pressable
                style={[styles.seg, lang === 'fr' && styles.segActive]}
                onPress={() => i18n.changeLanguage('fr')}
              >
                <Text style={[styles.segText, lang === 'fr' && styles.segTextActive]}>FR</Text>
              </Pressable>
              <Pressable
                style={[styles.seg, lang === 'en' && styles.segActive]}
                onPress={() => i18n.changeLanguage('en')}
              >
                <Text style={[styles.segText, lang === 'en' && styles.segTextActive]}>EN</Text>
              </Pressable>
            </View>
          </View>

          {/* Theme toggle */}
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: 'rgba(175,82,222,0.1)' }]}>
              <Ionicons name="color-palette-outline" size={18} color="#AF52DE" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{lang === 'fr' ? 'Thème vibrant' : 'Vibrant theme'}</Text>
              <Text style={styles.rowSub}>
                {theme === 'vibrant'
                  ? (lang === 'fr' ? 'Activé' : 'On')
                  : (lang === 'fr' ? 'Désactivé' : 'Off')}
              </Text>
            </View>
            <Switch
              value={theme === 'vibrant'}
              onValueChange={v => setTheme(v ? 'vibrant' : 'clean')}
              trackColor={{ false: '#E5E5EA', true: '#AF52DE' }}
              thumbColor="#fff"
            />
          </View>

        </View>

        {/* Admin section — only visible to admins */}
        {isAdmin && (
          <View style={styles.settingsSection}>
            <Text style={styles.settingsHeader}>Admin</Text>
            <Pressable style={styles.row} onPress={() => router.push('/admin')}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(232,87,26,0.1)' }]}>
                <Ionicons name="shield-outline" size={18} color="#E8571A" />
              </View>
              <Text style={styles.rowLabel}>
                {lang === 'fr' ? 'Gérer les lieux' : 'Manage Places'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
            </Pressable>
          </View>
        )}

        {session && (
          <View style={styles.settingsSection}>
            <Pressable style={[styles.row, styles.logoutRow]} onPress={handleLogout}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(255,59,48,0.1)' }]}>
                <Ionicons name="log-out-outline" size={18} color="#FF3B30" />
              </View>
              <Text style={[styles.rowLabel, { color: '#FF3B30' }]}>{t('auth.logout')}</Text>
            </Pressable>
          </View>
        )}

        {/* Quality promise */}
        <View style={styles.qualityCard}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#34C759" />
          <Text style={styles.qualityText}>{t('quality.promise')}</Text>
        </View>
      </SafeAreaView>
    </AppBackground>
  )
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    gap: 14,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E8571A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  displayName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 3,
  },
  memberSince: {
    fontSize: 13,
    color: '#8E8E93',
  },
  authCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 24,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    gap: 10,
  },
  authIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(232,87,26,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  authTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  authBody: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
  loginBtn: {
    marginTop: 4,
    backgroundColor: '#E8571A',
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: 14,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  settingsSection: {
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    overflow: 'hidden',
  },
  settingsHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  logoutRow: {
    borderTopWidth: 0,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 14,
    color: '#8E8E93',
  },
  rowSub: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 1,
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  seg: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  segActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  segTextActive: {
    color: '#1C1C1E',
  },
  qualityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 24,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(52,199,89,0.1)',
  },
  qualityText: {
    flex: 1,
    fontSize: 13,
    color: '#1C1C1E',
    lineHeight: 18,
  },
})

import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import AppBackground from '../../components/AppBackground'
import { useTheme, useThemeColors } from '../../contexts/ThemeContext'
import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import QRCode from 'react-native-qrcode-svg'

import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useSession } from '../../hooks/useSession'
import { useProfile } from '../../hooks/useProfile'
import { useMyReferral } from '../../hooks/useReferrals'
import { useCreditBalance } from '../../hooks/useCredit'
import { encodeCreditQrPayload, useMyCoupons, type MyCouponEntry } from '../../hooks/useCouponRedemption'
import { supabase } from '../../lib/supabase'
import { ThemeColors, AppTheme } from '../../constants/themes'

function formatFcfa(n: number, lang: 'fr' | 'en'): string {
  return `${n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA`
}

function discountLabel(c: MyCouponEntry, lang: 'fr' | 'en'): string | null {
  if (c.discountType === null || c.discountValue === null) return null
  if (c.discountType === 'percentage') return `-${c.discountValue}%`
  return `-${formatFcfa(c.discountValue, lang)}`
}

function formatExpiry(iso: string, lang: 'fr' | 'en'): string {
  return new Date(iso).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric', month: 'short',
  })
}

const THEME_OPTIONS: { key: AppTheme; labelFr: string; labelEn: string }[] = [
  { key: 'clean',   labelFr: 'Clair',   labelEn: 'Light'  },
  { key: 'vibrant', labelFr: 'Vif',     labelEn: 'Vivid'  },
  { key: 'dark',    labelFr: 'Sombre',  labelEn: 'Dark'   },
]

export default function ProfileScreen() {
  const { t, i18n } = useTranslation()
  const { session } = useSession()
  const { theme, setTheme } = useTheme()
  const colors = useThemeColors()
  const { isAdmin, role } = useIsAdmin()
  const { displayName, avatarUrl } = useProfile()
  const { data: referral } = useMyReferral()
  const { data: credit } = useCreditBalance()
  const { data: myCoupons } = useMyCoupons()
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  const styles = useMemo(() => createStyles(colors), [colors])

  const [creditQrOpen, setCreditQrOpen] = useState(false)
  const [creditApplied, setCreditApplied] = useState<{ amount: number } | null>(null)
  const qc = useQueryClient()

  const creditBalance = credit?.balance_fcfa ?? 0
  const creditQrPayload = session?.user.id ? encodeCreditQrPayload({ userId: session.user.id }) : null

  // Realtime: while the credit QR modal is open, watch for the owner
  // applying a credit deduction (a credit_transactions INSERT with reason
  // 'redemption_session' and a negative delta). Flip to a success state.
  useEffect(() => {
    if (!creditQrOpen || !session?.user.id) return
    setCreditApplied(null)
    const userId = session.user.id
    const channel = supabase
      .channel(`credit-applied:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'credit_transactions', filter: `user_id=eq.${userId}` },
        payload => {
          const row = payload.new as { reason: string; delta_fcfa: number }
          if (row.reason === 'redemption_session' && row.delta_fcfa < 0) {
            setCreditApplied({ amount: Math.abs(row.delta_fcfa) })
            qc.invalidateQueries({ queryKey: ['credit-balance', userId] })
            qc.invalidateQueries({ queryKey: ['credit-transactions', userId] })
            qc.invalidateQueries({ queryKey: ['user-activity', userId] })
          }
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [creditQrOpen, session?.user.id, qc])

  function closeCreditQr() {
    setCreditQrOpen(false)
    setCreditApplied(null)
  }

  const handleLogout = () => supabase.auth.signOut()

  async function handleShareReferral() {
    if (!referral?.code) return
    try {
      await Share.share({
        message: t('referral.shareMessage', { code: referral.code }),
      })
    } catch {
      // User cancelled — silent
    }
  }

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
        <Text style={styles.title}>{lang === 'fr' ? 'Profil' : 'Profile'}</Text>

        {session ? (
          /* Whole card opens the account editor — standard "tap your
             identity to edit it" pattern; chevron signals tappability. */
          <Pressable style={styles.profileCard} onPress={() => router.push('/account/edit' as any)}>
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
            <Ionicons name="chevron-forward" size={18} color={colors.iconMuted} />
          </Pressable>
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

          {/* Appearance — 3-way theme selector */}
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: 'rgba(175,82,222,0.1)' }]}>
              <Ionicons name="color-palette-outline" size={18} color="#AF52DE" />
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={styles.rowLabel}>
                {lang === 'fr' ? 'Apparence' : 'Appearance'}
              </Text>
              <View style={styles.themeSegWrap}>
                {THEME_OPTIONS.map(opt => (
                  <Pressable
                    key={opt.key}
                    style={[styles.themeSeg, theme === opt.key && styles.themeSegActive]}
                    onPress={() => setTheme(opt.key)}
                  >
                    <Text style={[styles.themeSegText, theme === opt.key && styles.themeSegTextActive]}>
                      {lang === 'fr' ? opt.labelFr : opt.labelEn}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Welcome credit + referral combined card.
            Surfaced whenever the user is signed in and either has credit
            or a referral code to share. */}
        {session && (creditBalance > 0 || referral?.code) && (
          <View style={styles.creditCard}>
            <View style={styles.creditHeader}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(232,87,26,0.1)' }]}>
                <Ionicons name="gift" size={18} color="#E8571A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.creditLabel}>
                  {lang === 'fr' ? 'Crédit O\'Kili' : 'O\'Kili credit'}
                </Text>
                <Text style={styles.creditAmount}>
                  {formatFcfa(creditBalance, lang)}
                </Text>
              </View>
            </View>
            <Text style={styles.creditHint}>
              {creditBalance > 0
                ? (lang === 'fr'
                    ? 'À utiliser dans n\'importe quel restaurant O\'Kili. Montrez votre QR au moment de payer.'
                    : 'Spend it at any O\'Kili restaurant. Show your QR when paying.')
                : (lang === 'fr'
                    ? 'Invitez un ami avec votre code pour gagner du crédit utilisable partout.'
                    : 'Invite a friend with your code to earn credit you can spend anywhere.')}
            </Text>
            <View style={styles.creditActions}>
              {creditBalance > 0 && creditQrPayload && (
                <Pressable onPress={() => setCreditQrOpen(true)} style={styles.creditPrimaryBtn}>
                  <Ionicons name="qr-code-outline" size={16} color="#fff" />
                  <Text style={styles.creditPrimaryBtnText}>
                    {lang === 'fr' ? 'Mon QR de crédit' : 'My credit QR'}
                  </Text>
                </Pressable>
              )}
              {referral?.code && (
                <Pressable onPress={handleShareReferral} style={[styles.creditSecondaryBtn, creditBalance === 0 && styles.creditPrimaryBtn]}>
                  <Ionicons name="share-outline" size={16} color={creditBalance === 0 ? '#fff' : '#E8571A'} />
                  <Text style={[styles.creditSecondaryBtnText, creditBalance === 0 && styles.creditPrimaryBtnText]}>
                    {lang === 'fr' ? 'Partager mon code' : 'Share my code'}
                  </Text>
                </Pressable>
              )}
            </View>
            {referral?.code && (
              <Text style={styles.creditFootnote}>
                {lang === 'fr' ? 'Code : ' : 'Code: '}
                <Text style={styles.creditCodeMono}>{referral.code}</Text>
                {' · '}
                {t('referral.invited', { count: referral.invitedCount })}
              </Text>
            )}
            <Pressable
              onPress={() => router.push('/account/activity' as any)}
              style={styles.creditActivityLink}
            >
              <Ionicons name="time-outline" size={14} color="#E8571A" />
              <Text style={styles.creditActivityLinkText}>
                {lang === 'fr' ? 'Voir mon activité' : 'View my activity'}
              </Text>
              <Ionicons name="chevron-forward" size={14} color="#E8571A" />
            </Pressable>
          </View>
        )}

        {/* My coupons — every unredeemed coupon the user holds. Closes the
            discoverability gap for coupons earned without visiting the place. */}
        {session && myCoupons && myCoupons.length > 0 && (
          <View style={styles.myCouponsSection}>
            <Text style={styles.myCouponsHeader}>
              {lang === 'fr' ? 'Mes coupons' : 'My coupons'}
            </Text>
            <View style={{ gap: 10 }}>
              {myCoupons.map(c => {
                const placeLabel = c.isPlatform
                  ? (lang === 'fr' ? "Promo O'Kili" : "O'Kili promo")
                  : (c.placeName ?? '—')
                return (
                  <Pressable
                    key={c.redemptionId}
                    style={styles.myCouponCard}
                    onPress={() => {
                      if (c.placeId) router.push(`/place/${c.placeId}` as any)
                    }}
                    disabled={!c.placeId}
                  >
                    <View style={styles.myCouponBorder} />
                    <View style={styles.myCouponBody}>
                      <View style={styles.myCouponTop}>
                        <Text style={styles.myCouponPlace} numberOfLines={1}>{placeLabel}</Text>
                        {discountLabel(c, lang) && (
                          <View style={styles.myCouponDiscount}>
                            <Text style={styles.myCouponDiscountText}>{discountLabel(c, lang)}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.myCouponTitle} numberOfLines={2}>
                        {lang === 'en' && c.titleEn ? c.titleEn : c.titleFr}
                      </Text>
                      <Text style={styles.myCouponMeta}>
                        {c.isPlatform
                          ? (lang === 'fr' ? 'Valable dans tous les restaurants · Expire le ' : 'Valid at any restaurant · Until ')
                          : (lang === 'fr' ? 'Expire le ' : 'Until ')}
                        {formatExpiry(c.expiresAt, lang)}
                      </Text>
                    </View>
                    {c.placeId && (
                      <Ionicons name="chevron-forward" size={18} color={colors.iconMuted} style={styles.myCouponChevron} />
                    )}
                  </Pressable>
                )
              })}
            </View>
          </View>
        )}

        {/* Restaurant owner section */}
        {role === 'restaurant_owner' && (
          <View style={styles.settingsSection}>
            <Text style={styles.settingsHeader}>{lang === 'fr' ? 'Mon restaurant' : 'My Restaurant'}</Text>
            <Pressable style={styles.row} onPress={() => router.push('/restaurant-admin/scanner' as any)}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(232,87,26,0.12)' }]}>
                <Ionicons name="scan" size={18} color="#E8571A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>
                  {lang === 'fr' ? 'Scanner un coupon' : 'Scan a coupon'}
                </Text>
                <Text style={styles.rowSub}>
                  {lang === 'fr' ? 'Valider les coupons et crédits des clients' : 'Validate customer coupons and credits'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} />
            </Pressable>
            <Pressable style={styles.row} onPress={() => router.push('/restaurant-admin' as any)}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(232,87,26,0.1)' }]}>
                <Ionicons name="storefront-outline" size={18} color="#E8571A" />
              </View>
              <Text style={styles.rowLabel}>
                {lang === 'fr' ? 'Gérer mon restaurant' : 'Manage My Restaurant'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} />
            </Pressable>
          </View>
        )}

        {/* Admin section — only visible to admins. This is the home of
            every admin domain. Each row is a separate management surface;
            the page they open is self-contained. */}
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
              <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} />
            </Pressable>
            <Pressable style={styles.row} onPress={() => router.push('/admin/users' as any)}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(232,87,26,0.1)' }]}>
                <Ionicons name="people-outline" size={18} color="#E8571A" />
              </View>
              <Text style={styles.rowLabel}>
                {lang === 'fr' ? 'Gérer les utilisateurs' : 'Manage Users'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} />
            </Pressable>
            <Pressable style={styles.row} onPress={() => router.push('/admin/coupons' as any)}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(232,87,26,0.1)' }]}>
                <Ionicons name="ticket-outline" size={18} color="#E8571A" />
              </View>
              <Text style={styles.rowLabel}>
                {lang === 'fr' ? 'Coupons & promos' : 'Coupons & promos'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} />
            </Pressable>
            <Pressable style={styles.row} onPress={() => router.push('/admin/activity' as any)}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(232,87,26,0.1)' }]}>
                <Ionicons name="time-outline" size={18} color="#E8571A" />
              </View>
              <Text style={styles.rowLabel}>
                {lang === 'fr' ? 'Activité' : 'Activity'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} />
            </Pressable>
            <Pressable style={styles.row} onPress={() => router.push('/admin/referrals' as any)}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(232,87,26,0.1)' }]}>
                <Ionicons name="gift-outline" size={18} color="#E8571A" />
              </View>
              <Text style={styles.rowLabel}>
                {lang === 'fr' ? 'Parrainage' : 'Referrals'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} />
            </Pressable>
            <Pressable style={styles.row} onPress={() => router.push('/admin/tier-settings' as any)}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(232,87,26,0.1)' }]}>
                <Ionicons name="options-outline" size={18} color="#E8571A" />
              </View>
              <Text style={styles.rowLabel}>
                {lang === 'fr' ? 'Plans tarifaires' : 'Tier settings'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} />
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
        </ScrollView>
      </SafeAreaView>

      {/* Credit QR modal — shown when the user taps "My credit QR".
          The owner scans this at checkout to pull the user's credit
          balance into the redemption session. */}
      <Modal
        visible={creditQrOpen}
        transparent
        animationType="fade"
        onRequestClose={closeCreditQr}
      >
        <Pressable style={styles.qrBackdrop} onPress={closeCreditQr}>
          <Pressable style={styles.qrCard} onPress={() => {/* swallow */}}>
            <Pressable onPress={closeCreditQr} style={styles.qrCloseBtn} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </Pressable>
            {creditApplied ? (
              <>
                <View style={[styles.qrIconWrap, { backgroundColor: 'rgba(52,199,89,0.12)' }]}>
                  <Ionicons name="checkmark-circle" size={32} color="#34C759" />
                </View>
                <Text style={[styles.qrTitle, { color: colors.textPrimary }]}>
                  {lang === 'fr' ? 'Crédit utilisé !' : 'Credit used!'}
                </Text>
                <Text style={[styles.qrAmount, { color: '#34C759' }]}>
                  −{formatFcfa(creditApplied.amount, lang)}
                </Text>
                <Text style={[styles.qrInstruction, { color: colors.textSecondary }]}>
                  {lang === 'fr'
                    ? `Appliqué à votre addition. Solde restant : ${formatFcfa(creditBalance, lang)}.`
                    : `Applied to your bill. Remaining balance: ${formatFcfa(creditBalance, lang)}.`}
                </Text>
                <Pressable onPress={closeCreditQr} style={styles.qrDoneBtn}>
                  <Text style={styles.qrDoneBtnText}>
                    {lang === 'fr' ? 'Terminé' : 'Done'}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.qrIconWrap}>
                  <Ionicons name="gift" size={22} color="#E8571A" />
                </View>
                <Text style={[styles.qrTitle, { color: colors.textPrimary }]}>
                  {lang === 'fr' ? 'Mon crédit O\'Kili' : 'My O\'Kili credit'}
                </Text>
                <Text style={styles.qrAmount}>
                  {formatFcfa(creditBalance, lang)}
                </Text>
                <View style={styles.qrBg}>
                  {creditQrPayload && (
                    <QRCode value={creditQrPayload} size={220} backgroundColor="#fff" color="#000" />
                  )}
                </View>
                <Text style={[styles.qrInstruction, { color: colors.textSecondary }]}>
                  {lang === 'fr'
                    ? 'Présentez ce QR au restaurant. Le serveur le scannera pour appliquer votre crédit à votre addition.'
                    : 'Show this QR at the restaurant. The waiter scans it to apply your credit to the bill.'}
                </Text>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </AppBackground>
  )
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: c.textPrimary,
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
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
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
      color: c.textPrimary,
      marginBottom: 3,
    },
    memberSince: {
      fontSize: 13,
      color: c.textSecondary,
    },
    authCard: {
      marginHorizontal: 24,
      marginBottom: 24,
      padding: 24,
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
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
      color: c.textPrimary,
    },
    authBody: {
      fontSize: 14,
      color: c.textSecondary,
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
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      overflow: 'hidden',
    },
    settingsHeader: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textSecondary,
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
      borderTopColor: c.separator,
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
      color: c.textPrimary,
      fontWeight: '500',
    },
    rowSub: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 1,
    },
    // Language FR/EN segmented pill
    segmentWrap: {
      flexDirection: 'row',
      backgroundColor: c.toggleBg,
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
      backgroundColor: c.toggleActive,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    segText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textSecondary,
    },
    segTextActive: {
      color: c.textPrimary,
    },
    // Appearance 3-way segmented control
    themeSegWrap: {
      flexDirection: 'row',
      backgroundColor: c.toggleBg,
      borderRadius: 8,
      padding: 2,
      gap: 2,
    },
    themeSeg: {
      flex: 1,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 6,
      alignItems: 'center',
    },
    themeSegActive: {
      backgroundColor: c.toggleActive,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    themeSegText: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textSecondary,
    },
    themeSegTextActive: {
      color: c.textPrimary,
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
      color: c.textPrimary,
      lineHeight: 18,
    },
    // ── Welcome credit / referral card ─────────────────────────
    creditCard: {
      marginHorizontal: 24,
      marginBottom: 16,
      padding: 16,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      gap: 12,
    },
    creditHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    creditLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    creditAmount: {
      fontSize: 26,
      fontWeight: '800',
      color: '#E8571A',
      marginTop: 2,
    },
    creditHint: {
      fontSize: 12,
      color: c.textSecondary,
      lineHeight: 17,
    },
    creditActions: {
      flexDirection: 'row',
      gap: 8,
    },
    creditPrimaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: '#E8571A',
      paddingVertical: 10,
      borderRadius: 999,
    },
    creditPrimaryBtnText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
    creditSecondaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: 'rgba(232,87,26,0.4)',
      backgroundColor: 'rgba(232,87,26,0.06)',
      paddingVertical: 10,
      borderRadius: 999,
    },
    creditSecondaryBtnText: {
      color: '#E8571A',
      fontSize: 13,
      fontWeight: '700',
    },
    creditFootnote: {
      fontSize: 11,
      color: c.textSecondary,
      fontWeight: '500',
    },
    creditCodeMono: {
      fontWeight: '800',
      color: '#E8571A',
      letterSpacing: 1,
    },
    creditActivityLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 6,
      marginTop: 2,
    },
    creditActivityLinkText: {
      color: '#E8571A',
      fontSize: 12,
      fontWeight: '700',
    },

    // ── My coupons section ─────────────────────────────────────
    myCouponsSection: {
      marginHorizontal: 24,
      marginBottom: 16,
      gap: 10,
    },
    myCouponsHeader: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: 4,
    },
    myCouponCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 14,
      overflow: 'hidden',
    },
    myCouponBorder: { width: 4, alignSelf: 'stretch', backgroundColor: '#E8571A' },
    myCouponBody: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 4 },
    myCouponTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    myCouponPlace: { flex: 1, fontSize: 12, fontWeight: '700', color: c.textPrimary, textTransform: 'uppercase', letterSpacing: 0.4 },
    myCouponDiscount: {
      backgroundColor: 'rgba(232,87,26,0.12)',
      paddingHorizontal: 8, paddingVertical: 2,
      borderRadius: 999,
    },
    myCouponDiscountText: { color: '#E8571A', fontSize: 11, fontWeight: '700' },
    myCouponTitle: { fontSize: 14, fontWeight: '600', color: c.textPrimary, lineHeight: 18 },
    myCouponMeta: { fontSize: 11, color: c.textSecondary, marginTop: 2 },
    myCouponChevron: { marginRight: 10 },

    // ── Credit QR modal ────────────────────────────────────────
    qrBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    qrCard: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: c.bgPrimary,
      borderRadius: 22,
      padding: 22,
      paddingTop: 28,
      alignItems: 'center',
      gap: 12,
    },
    qrCloseBtn: {
      position: 'absolute',
      top: 12, right: 12,
      width: 30, height: 30,
      borderRadius: 15,
      backgroundColor: 'rgba(0,0,0,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    qrIconWrap: {
      width: 44, height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(232,87,26,0.1)',
      alignItems: 'center', justifyContent: 'center',
    },
    qrTitle: { fontSize: 16, fontWeight: '700' },
    qrAmount: { fontSize: 22, fontWeight: '800', color: '#E8571A' },
    qrBg: {
      backgroundColor: '#fff',
      padding: 12,
      borderRadius: 16,
    },
    qrInstruction: {
      fontSize: 12,
      lineHeight: 17,
      textAlign: 'center',
      maxWidth: 280,
    },
    qrDoneBtn: {
      marginTop: 4,
      backgroundColor: '#34C759',
      paddingHorizontal: 28,
      paddingVertical: 12,
      borderRadius: 999,
    },
    qrDoneBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  })
}

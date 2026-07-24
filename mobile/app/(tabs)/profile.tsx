import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import AppBackground from '../../components/AppBackground'
import { useTheme, useThemeColors } from '../../contexts/ThemeContext'
import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import QRCode from 'react-native-qrcode-svg'

import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle, ClipPath, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg'

import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useSession } from '../../hooks/useSession'
import { useProfile } from '../../hooks/useProfile'
import { useMyReferral } from '../../hooks/useReferrals'
import { useCreditBalance } from '../../hooks/useCredit'
import { encodeCreditQrPayload, useMyCoupons, type MyCouponEntry } from '../../hooks/useCouponRedemption'
import { CouponQrModal } from '../../components/place/CouponsBlock'
import WalletCouponCard from '../../components/WalletCouponCard'
import { usePullRefresh } from '../../hooks/usePullRefresh'
import { disableProximity, enableProximity, isProximityEnabled } from '../../lib/proximity'
import { supabase } from '../../lib/supabase'
import { ThemeColors, AppTheme } from '../../constants/themes'

function formatFcfa(n: number, lang: 'fr' | 'en'): string {
  return `${n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA`
}

// Estuaire brand mark (same paths as the app icon / design handoff)
function EstuaireMark({ size = 26, fg = '#fff', accent = '#E8571A', water = 'transparent' }: {
  size?: number; fg?: string; accent?: string; water?: string
}) {
  const uid = `est${size}${fg.replace(/[^a-z0-9]/gi, '')}`
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs><ClipPath id={uid}><Circle cx="50" cy="50" r="33" /></ClipPath></Defs>
      <Circle cx="50" cy="50" r="42" fill="none" stroke={fg} strokeWidth="9" />
      <G clipPath={`url(#${uid})`}>
        <Circle cx="50" cy="52" r="16" fill={accent} />
        <Path d="M10 62 Q20 56 30 62 T50 62 T70 62 T90 62 L90 90 L10 90 Z" fill={fg} />
        <Path d="M10 73 Q20 67 30 73 T50 73 T70 73 T90 73" fill="none" stroke={water} strokeWidth="3" />
      </G>
    </Svg>
  )
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

  // "Coupons utilisés" tile on the credit card
  const { data: usedCouponsCount } = useQuery({
    queryKey: ['used-coupons-count', session?.user.id],
    queryFn: async (): Promise<number> => {
      if (!session) return 0
      const { count, error } = await supabase
        .from('coupon_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .not('redeemed_at', 'is', null)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!session,
    staleTime: 60_000,
  })
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  const styles = useMemo(() => createStyles(colors), [colors])

  const [creditQrOpen, setCreditQrOpen] = useState(false)
  const [creditApplied, setCreditApplied] = useState<{ amount: number } | null>(null)
  const [walletCoupon, setWalletCoupon] = useState<MyCouponEntry | null>(null)
  const [couponPage, setCouponPage] = useState(0)
  const { width: windowWidth } = useWindowDimensions()
  // Wallet carousel: one card per page with the next card peeking so the
  // swipe affordance is self-evident. 24 = section margin, 32 = peek.
  const couponCardWidth = windowWidth - 24 * 2 - 32
  const couponSnap = couponCardWidth + 12
  const [referralPromptOpen, setReferralPromptOpen] = useState(false)
  const [proximityOn, setProximityOn] = useState(false)
  const { refreshing, onRefresh } = usePullRefresh()

  useEffect(() => {
    isProximityEnabled().then(setProximityOn).catch(() => {})
  }, [])

  async function handleProximityToggle(next: boolean) {
    if (next) {
      setProximityOn(true) // optimistic; reverted if permission is refused
      const ok = await enableProximity().catch(() => false)
      if (!ok) {
        setProximityOn(false)
        Alert.alert(
          lang === 'fr' ? 'Autorisation requise' : 'Permission needed',
          lang === 'fr'
            ? 'Pour vous signaler les bons plans quand vous passez à côté, O\'Kili a besoin de l\'autorisation de position « Toujours » (Réglages → O\'Kili → Position).'
            : 'To alert you about deals as you walk by, O\'Kili needs the "Always" location permission (Settings → O\'Kili → Location).',
        )
      }
    } else {
      setProximityOn(false)
      disableProximity().catch(() => {})
    }
  }
  const [referralCodeInput, setReferralCodeInput] = useState('')
  const [claimingCode, setClaimingCode] = useState(false)
  const qc = useQueryClient()

  const creditBalance = credit?.balance_fcfa ?? 0
  const creditQrPayload = session?.user.id ? encodeCreditQrPayload({ userId: session.user.id }) : null

  // Late referral-code entry (OAuth signups never see the signup form's code
  // field). Only offered while the server-side claim window is open: no
  // referrer yet + account created in the last 7 days (migration 037).
  const { data: claimProfile } = useQuery({
    queryKey: ['late-referral-eligibility', session?.user.id],
    queryFn: async () => {
      if (!session) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('referred_by, created_at')
        .eq('id', session.user.id)
        .maybeSingle()
      if (error) throw error
      return (data as { referred_by: string | null; created_at: string } | null) ?? null
    },
    enabled: !!session,
  })
  const canClaimReferral = !!claimProfile
    && claimProfile.referred_by === null
    && Date.now() - new Date(claimProfile.created_at).getTime() < 7 * 24 * 60 * 60 * 1000

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

  // ── Late referral-code claim ────────────────────────────────────
  function claimErrorMessage(raw: string): string {
    if (raw.includes('ALREADY_REFERRED')) {
      return lang === 'fr' ? 'Un code a déjà été utilisé pour ce compte.' : 'A code has already been used for this account.'
    }
    if (raw.includes('CODE_NOT_FOUND')) {
      return lang === 'fr' ? 'Code introuvable.' : 'Code not found.'
    }
    if (raw.includes('SELF_REFERRAL')) {
      return lang === 'fr' ? 'Vous ne pouvez pas utiliser votre propre code.' : 'You cannot use your own code.'
    }
    if (raw.includes('CLAIM_WINDOW_CLOSED')) {
      return lang === 'fr' ? 'La période pour saisir un code est passée.' : 'The window to enter a code has passed.'
    }
    return t('errors.generic')
  }

  async function submitReferralClaim(raw: string) {
    const code = raw.trim().toUpperCase()
    if (!code || claimingCode) return
    setClaimingCode(true)
    try {
      // Cast: claim_referral_code (migration 037) isn't in the hand-written
      // database.types Functions yet.
      const { error } = await (supabase.rpc as any)('claim_referral_code', { p_code: code })
      if (error) throw error
      setReferralPromptOpen(false)
      setReferralCodeInput('')
      Alert.alert(
        lang === 'fr' ? 'Code appliqué !' : 'Code applied!',
        lang === 'fr'
          ? 'Vous recevez votre crédit de bienvenue.'
          : 'You are receiving your welcome credit.',
      )
      const userId = session?.user.id
      qc.invalidateQueries({ queryKey: ['late-referral-eligibility', userId] })
      qc.invalidateQueries({ queryKey: ['my-referral', userId] })
      qc.invalidateQueries({ queryKey: ['credit-balance', userId] })
      qc.invalidateQueries({ queryKey: ['credit-transactions', userId] })
      qc.invalidateQueries({ queryKey: ['user-activity', userId] })
    } catch (e: any) {
      Alert.alert(
        lang === 'fr' ? 'Code non appliqué' : 'Code not applied',
        claimErrorMessage(e?.message ?? ''),
      )
    } finally {
      setClaimingCode(false)
    }
  }

  function openReferralPrompt() {
    if (Platform.OS === 'ios') {
      // Alert.prompt is iOS-only; Android gets the small modal below.
      Alert.prompt(
        lang === 'fr' ? 'Code de parrainage' : 'Referral code',
        lang === 'fr'
          ? 'Saisissez le code de la personne qui vous a invité.'
          : 'Enter the code of the person who invited you.',
        [
          { text: lang === 'fr' ? 'Annuler' : 'Cancel', style: 'cancel' },
          { text: 'OK', onPress: (code?: string) => { if (code) submitReferralClaim(code) } },
        ],
        'plain-text',
      )
    } else {
      setReferralCodeInput('')
      setReferralPromptOpen(true)
    }
  }

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E8571A" />}
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
              {/* Role-aware subtitle: badge only for the rare roles — a badge
                  on every member would mean nothing. */}
              {isAdmin || role === 'admin' ? (
                <View style={styles.roleRow}>
                  <Ionicons name="shield-checkmark" size={13} color="#E8571A" />
                  <Text style={[styles.memberSince, styles.roleText]}>
                    {lang === 'fr' ? 'Admin O\'Kili' : 'O\'Kili admin'}
                  </Text>
                </View>
              ) : role === 'restaurant_owner' ? (
                <View style={styles.roleRow}>
                  <Ionicons name="storefront" size={13} color="#E8571A" />
                  <Text style={[styles.memberSince, styles.roleText]}>
                    {lang === 'fr' ? 'Restaurateur' : 'Restaurant owner'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.memberSince}>
                  {lang === 'fr' ? 'Membre O\'Kili' : 'O\'Kili member'}
                </Text>
              )}
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

        {/* O'Kili Credit — bank-card treatment (design handoff "La carte").
            Surfaced whenever the user is signed in and either has credit
            or a referral code to share. */}
        {session && (creditBalance > 0 || referral?.code || canClaimReferral) && (
          <View style={styles.creditSection}>
            <View style={styles.bankCardShadow}>
              <LinearGradient
                colors={['#26262A', '#1C1C1E', '#141416']}
                start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 1 }}
                style={styles.bankCard}
              >
                {/* warm sunset bloom across the right half, like the reference */}
                <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Defs>
                    <RadialGradient id="sunGlow" cx="76%" cy="14%" r="80%">
                      <Stop offset="0%" stopColor="#FF7A3C" stopOpacity="0.50" />
                      <Stop offset="35%" stopColor="#E8571A" stopOpacity="0.22" />
                      <Stop offset="70%" stopColor="#E8571A" stopOpacity="0.06" />
                      <Stop offset="100%" stopColor="#E8571A" stopOpacity="0" />
                    </RadialGradient>
                    <RadialGradient id="sunCore" cx="80%" cy="8%" r="26%">
                      <Stop offset="0%" stopColor="#FF9A5C" stopOpacity="0.35" />
                      <Stop offset="100%" stopColor="#FF9A5C" stopOpacity="0" />
                    </RadialGradient>
                  </Defs>
                  <Circle cx="76%" cy="14%" r="80%" fill="url(#sunGlow)" />
                  <Circle cx="80%" cy="8%" r="26%" fill="url(#sunCore)" />
                </Svg>
                <View style={styles.bankWatermark}>
                  <EstuaireMark size={210} fg="#fff" accent="#fff" />
                </View>
                <View style={styles.bankTopRow}>
                  <View style={styles.bankBrandRow}>
                    <EstuaireMark size={26} />
                    <Text style={styles.bankBrand}>
                      O<Text style={{ color: '#E8571A' }}>'</Text>Kili <Text style={styles.bankBrandLight}>Credit</Text>
                    </Text>
                  </View>
                  <View style={styles.bankPill}>
                    <Text style={styles.bankPillText}>{lang === 'fr' ? 'MEMBRE' : 'MEMBER'}</Text>
                  </View>
                </View>
                <View style={{ marginTop: 'auto' }}>
                  <Text style={styles.bankLabel}>{lang === 'fr' ? 'SOLDE DISPONIBLE' : 'AVAILABLE BALANCE'}</Text>
                  <View style={styles.bankBalanceRow}>
                    <Text style={styles.bankBalance}>{creditBalance.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}</Text>
                    <Text style={styles.bankCurrency}>FCFA</Text>
                  </View>
                </View>
                <View style={styles.bankBottomRow}>
                  {referral?.code ? (
                    <View>
                      <Text style={styles.bankSmallLabel}>{lang === 'fr' ? 'CODE PARRAIN' : 'REFERRAL CODE'}</Text>
                      <Pressable onPress={handleShareReferral} style={styles.bankCodeChip} hitSlop={6}>
                        <Text style={styles.bankCode}>{referral.code}</Text>
                        <Ionicons name="copy-outline" size={13} color="rgba(255,255,255,0.8)" />
                      </Pressable>
                    </View>
                  ) : <View />}
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.bankSmallLabel}>{lang === 'fr' ? 'TITULAIRE' : 'HOLDER'}</Text>
                    <Text style={styles.bankHolder} numberOfLines={1}>{displayName}</Text>
                  </View>
                </View>
              </LinearGradient>
              </View>

            {/* stats strip */}
            <View style={styles.bankStatsRow}>
              <View style={styles.bankStat}>
                <Text style={styles.bankStatValue}>{referral?.invitedCount ?? 0}</Text>
                <Text style={styles.bankStatLabel}>{lang === 'fr' ? 'Amis invités' : 'Friends invited'}</Text>
              </View>
              <View style={styles.bankStat}>
                <Text style={styles.bankStatValue}>{(credit?.lifetime_earned ?? 0).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}</Text>
                <Text style={styles.bankStatLabel}>{lang === 'fr' ? 'FCFA gagnés' : 'FCFA earned'}</Text>
              </View>
              <View style={styles.bankStat}>
                <Text style={styles.bankStatValue}>{usedCouponsCount ?? 0}</Text>
                <Text style={styles.bankStatLabel}>{lang === 'fr' ? 'Coupons utilisés' : 'Coupons used'}</Text>
              </View>
            </View>

            {/* actions */}
            {referral?.code && (
              <Pressable onPress={handleShareReferral} style={styles.bankShareBtn}>
                <Ionicons name="share-outline" size={17} color="#fff" />
                <Text style={styles.bankShareBtnText}>{lang === 'fr' ? 'Partager mon code' : 'Share my code'}</Text>
              </Pressable>
            )}
            {creditBalance > 0 && creditQrPayload && (
              <Pressable onPress={() => setCreditQrOpen(true)} style={styles.bankQrBtn}>
                <Ionicons name="qr-code-outline" size={16} color={colors.textPrimary} />
                <Text style={[styles.bankQrBtnText, { color: colors.textPrimary }]}>
                  {lang === 'fr' ? 'Mon QR de crédit' : 'My credit QR'}
                </Text>
              </Pressable>
            )}
            {canClaimReferral && (
              <Pressable
                onPress={openReferralPrompt}
                style={styles.creditActivityLink}
                disabled={claimingCode}
              >
                <Ionicons name="ticket-outline" size={14} color="#E8571A" />
                <Text style={styles.creditActivityLinkText}>
                  {lang === 'fr' ? 'Vous avez un code de parrainage ?' : 'Have a referral code?'}
                </Text>
                <Ionicons name="chevron-forward" size={14} color="#E8571A" />
              </Pressable>
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
            <Text style={styles.bankFootnote}>
              {lang === 'fr'
                ? 'Invitez un ami avec votre code — vous gagnez tous les deux du crédit à dépenser partout.'
                : 'Invite a friend with your code — you both earn credit to spend anywhere.'}
            </Text>
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

          {/* Proximity deal alerts — opt-in, needs "Always" location */}
          {session && (
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(52,199,89,0.1)' }]}>
                <Ionicons name="location-outline" size={18} color="#34C759" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>
                  {lang === 'fr' ? 'Bons plans à proximité' : 'Nearby deal alerts'}
                </Text>
                <Text style={styles.rowHint}>
                  {lang === 'fr'
                    ? 'Une alerte (max 1/jour) quand vous passez près d’un coupon en cours'
                    : 'One alert (max 1/day) when you walk by a live coupon'}
                </Text>
              </View>
              <Switch
                value={proximityOn}
                onValueChange={handleProximityToggle}
                trackColor={{ true: '#34C759' }}
              />
            </View>
          )}
        </View>

        {/* My coupons — every unredeemed coupon the user holds. Closes the
            discoverability gap for coupons earned without visiting the place. */}
        {session && myCoupons && myCoupons.length > 0 && (
          <View style={styles.myCouponsSection}>
            <View>
              <Text style={styles.myCouponsHeader}>
                {lang === 'fr' ? 'Mes coupons' : 'My coupons'}
              </Text>
              <Text style={styles.myCouponsSub}>
                {lang === 'fr'
                  ? `${myCoupons.length} offre${myCoupons.length > 1 ? 's' : ''} active${myCoupons.length > 1 ? 's' : ''}`
                  : `${myCoupons.length} active offer${myCoupons.length > 1 ? 's' : ''}`}
              </Text>
            </View>
            {myCoupons.length === 1 ? (
              <WalletCouponCard
                coupon={myCoupons[0]}
                lang={lang}
                onPress={() => setWalletCoupon(myCoupons[0])}
              />
            ) : (
              <View>
                {/* Swipeable wallet: bleed past the section margin so the
                    next card peeks in from the screen edge. */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={couponSnap}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  style={{ marginHorizontal: -24 }}
                  contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
                  onMomentumScrollEnd={e => {
                    const page = Math.round(e.nativeEvent.contentOffset.x / couponSnap)
                    setCouponPage(Math.max(0, Math.min(page, myCoupons.length - 1)))
                  }}
                >
                  {myCoupons.map(c => (
                    <View key={c.redemptionId} style={{ width: couponCardWidth }}>
                      <WalletCouponCard
                        coupon={c}
                        lang={lang}
                        onPress={() => setWalletCoupon(c)}
                      />
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.couponDots}>
                  {myCoupons.map((c, i) => (
                    <View
                      key={c.redemptionId}
                      style={[styles.couponDot, i === couponPage && styles.couponDotActive]}
                    />
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Restaurant owner / admin section — the coupon scanner is available
            to both (admins can validate platform coupons anywhere); only
            owners get the restaurant-management row. */}
        {(role === 'restaurant_owner' || role === 'admin' || isAdmin) && (
          <View style={styles.settingsSection}>
            <Text style={styles.settingsHeader}>
              {role === 'restaurant_owner'
                ? (lang === 'fr' ? 'Mon restaurant' : 'My Restaurant')
                : (lang === 'fr' ? 'Coupons' : 'Coupons')}
            </Text>
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
            {role === 'restaurant_owner' && (
              <Pressable style={styles.row} onPress={() => router.push('/restaurant-admin' as any)}>
                <View style={[styles.rowIcon, { backgroundColor: 'rgba(232,87,26,0.1)' }]}>
                  <Ionicons name="storefront-outline" size={18} color="#E8571A" />
                </View>
                <Text style={styles.rowLabel}>
                  {lang === 'fr' ? 'Gérer mon restaurant' : 'Manage My Restaurant'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} />
              </Pressable>
            )}
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

      {/* Wallet coupon QR — same modal as the place page. It reuses (or
          mints) the user's open redemption row server-side, so the QR the
          owner scans is always the live code. */}
      <CouponQrModal
        visible={walletCoupon !== null}
        coupon={walletCoupon ? {
          id: walletCoupon.couponId,
          title_fr: walletCoupon.titleFr,
          title_en: walletCoupon.titleEn,
          discount_type: walletCoupon.discountType,
          discount_value: walletCoupon.discountValue,
        } : null}
        onClose={() => setWalletCoupon(null)}
      />

      {/* Android referral-code prompt — Alert.prompt is iOS-only. */}
      <Modal
        visible={referralPromptOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReferralPromptOpen(false)}
      >
        <Pressable style={styles.qrBackdrop} onPress={() => setReferralPromptOpen(false)}>
          <Pressable style={styles.qrCard} onPress={() => {/* swallow */}}>
            <Text style={[styles.qrTitle, { color: colors.textPrimary }]}>
              {lang === 'fr' ? 'Code de parrainage' : 'Referral code'}
            </Text>
            <Text style={[styles.qrInstruction, { color: colors.textSecondary }]}>
              {lang === 'fr'
                ? 'Saisissez le code de la personne qui vous a invité.'
                : 'Enter the code of the person who invited you.'}
            </Text>
            <TextInput
              style={styles.codeInput}
              value={referralCodeInput}
              onChangeText={setReferralCodeInput}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="OKILI123"
              placeholderTextColor={colors.textPlaceholder}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}>
              <Pressable style={styles.creditSecondaryBtn} onPress={() => setReferralPromptOpen(false)}>
                <Text style={styles.creditSecondaryBtnText}>
                  {lang === 'fr' ? 'Annuler' : 'Cancel'}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.creditPrimaryBtn, (!referralCodeInput.trim() || claimingCode) && { opacity: 0.5 }]}
                onPress={() => submitReferralClaim(referralCodeInput)}
                disabled={!referralCodeInput.trim() || claimingCode}
              >
                <Text style={styles.creditPrimaryBtnText}>
                  {claimingCode
                    ? (lang === 'fr' ? 'Envoi…' : 'Sending…')
                    : (lang === 'fr' ? 'Valider' : 'Apply')}
                </Text>
              </Pressable>
            </View>
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
    roleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    roleText: {
      color: '#E8571A',
      fontWeight: '600',
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
    rowHint: {
      fontSize: 11,
      color: c.textSecondary,
      marginTop: 2,
      lineHeight: 14,
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
    // ── O'Kili Credit bank card (design "La carte") ────────────
    creditSection: { marginHorizontal: 24, marginBottom: 24 },
    bankCardShadow: {
      // Shadow lives on an un-clipped wrapper so the card actually floats
      // like a physical object (overflow:hidden on the card kills shadows).
      borderRadius: 22,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.32,
      shadowRadius: 20,
      elevation: 10,
      backgroundColor: '#1C1C1E',
    },
    bankCard: {
      borderRadius: 22,
      overflow: 'hidden',
      height: 200,
      padding: 18,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    bankWatermark: { position: 'absolute', right: -44, bottom: -62, opacity: 0.10 },
    bankTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    bankBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    bankBrand: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
    bankBrandLight: { fontWeight: '600', color: 'rgba(255,255,255,0.65)' },
    bankPill: {
      paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
      backgroundColor: 'rgba(232,87,26,0.18)',
      borderWidth: 1, borderColor: 'rgba(232,87,26,0.35)',
    },
    bankPillText: { fontSize: 9.5, fontWeight: '700', letterSpacing: 1.2, color: '#FF9A66' },
    bankLabel: { fontSize: 9.5, fontWeight: '600', letterSpacing: 1.3, color: 'rgba(255,255,255,0.55)' },
    bankBalanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
    bankBalance: { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
    bankCurrency: { fontSize: 13, fontWeight: '700', color: '#FF9A66' },
    bankBottomRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 },
    bankSmallLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 1.3, color: 'rgba(255,255,255,0.45)', marginBottom: 3 },
    bankCodeChip: {
      flexDirection: 'row', alignItems: 'center', gap: 7,
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.09)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    },
    bankCode: {
      fontSize: 13, fontWeight: '600', letterSpacing: 2.4, color: '#fff',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    bankHolder: { fontSize: 12.5, fontWeight: '700', color: '#fff', maxWidth: 140 },
    bankStatsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    bankStat: {
      flex: 1, backgroundColor: c.surfaceElevated, borderRadius: 12,
      paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.separator,
    },
    bankStatValue: { fontSize: 16, fontWeight: '800', color: c.textPrimary },
    bankStatLabel: { fontSize: 10, color: c.textSecondary, marginTop: 1 },
    bankShareBtn: {
      height: 46, marginTop: 10, borderRadius: 999,
      backgroundColor: '#E8571A',
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
      shadowColor: '#E8571A', shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
    },
    bankShareBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    bankQrBtn: {
      height: 40, marginTop: 8, borderRadius: 999,
      backgroundColor: c.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.separator,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    bankQrBtnText: { fontSize: 14, fontWeight: '700' },
    bankFootnote: {
      fontSize: 11.5, color: c.textSecondary, textAlign: 'center',
      marginTop: 10, lineHeight: 17, paddingHorizontal: 12,
    },

    // ── Welcome credit / referral card (legacy styles kept for links) ──
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
    myCouponsSub: {
      fontSize: 12,
      color: c.textSecondary,
      paddingHorizontal: 4,
      marginTop: 2,
    },
    couponDots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      marginTop: 10,
    },
    couponDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.iconMuted,
      opacity: 0.4,
    },
    couponDotActive: {
      backgroundColor: '#E8571A',
      opacity: 1,
      width: 16,
    },

    // ── Android referral-code prompt ───────────────────────────
    codeInput: {
      alignSelf: 'stretch',
      borderWidth: 1,
      borderColor: c.inputBorder,
      backgroundColor: c.inputBg,
      color: c.inputText,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 2,
      textAlign: 'center',
    },

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

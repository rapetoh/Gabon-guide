import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useThemeColors } from '../contexts/ThemeContext'
import {
  useMarkAllNotificationsRead,
  useNotifications,
  type AppNotification,
} from '../hooks/useNotifications'

function formatFcfa(n: number, lang: 'fr' | 'en'): string {
  return `${Math.abs(n).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} FCFA`
}

function formatDateTime(iso: string, lang: 'fr' | 'en'): string {
  return new Date(iso).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

// Mirrors the server-side push copy in supabase/functions/send_push.
function notificationCopy(n: AppNotification, lang: 'fr' | 'en'): { title: string; body: string; icon: any; color: string } {
  const p = n.payload
  const place = p.place_name ?? (lang === 'fr' ? 'un établissement' : 'a place')
  switch (n.type) {
    case 'coupon_redeemed': {
      const coupon = lang === 'fr' ? (p.coupon_title_fr ?? p.coupon_title_en) : (p.coupon_title_en ?? p.coupon_title_fr)
      return {
        title: lang === 'fr' ? 'Coupon utilisé 🎉' : 'Coupon redeemed 🎉',
        body: lang === 'fr'
          ? `Votre coupon${coupon ? ` « ${coupon} »` : ''} a été validé chez ${place}.`
          : `Your coupon${coupon ? ` “${coupon}”` : ''} was validated at ${place}.`,
        icon: 'pricetag', color: '#E8571A',
      }
    }
    case 'credit_spent':
      return {
        title: lang === 'fr' ? 'Crédit utilisé' : 'Credit used',
        body: lang === 'fr'
          ? `${formatFcfa(p.delta_fcfa ?? 0, lang)} de crédit utilisé chez ${place}.`
          : `${formatFcfa(p.delta_fcfa ?? 0, lang)} of credit used at ${place}.`,
        icon: 'card-outline', color: '#FF3B30',
      }
    case 'credit_received': {
      const delta = p.delta_fcfa ?? 0
      if (delta < 0) {
        return {
          title: lang === 'fr' ? 'Crédit ajusté' : 'Credit adjusted',
          body: lang === 'fr'
            ? `Votre crédit O'Kili a été ajusté de −${formatFcfa(delta, lang)}.`
            : `Your O'Kili credit was adjusted by −${formatFcfa(delta, lang)}.`,
          icon: 'construct-outline', color: '#FF3B30',
        }
      }
      return {
        title: lang === 'fr' ? 'Crédit reçu 💰' : 'Credit received 💰',
        body: lang === 'fr'
          ? `+${formatFcfa(delta, lang)} ajouté à votre crédit O'Kili.`
          : `+${formatFcfa(delta, lang)} added to your O'Kili credit.`,
        icon: 'wallet-outline', color: '#34C759',
      }
    }
    case 'referral_reward':
      return {
        title: lang === 'fr' ? 'Parrainage récompensé 🎁' : 'Referral reward 🎁',
        body: lang === 'fr'
          ? `+${formatFcfa(p.delta_fcfa ?? 0, lang)} — un ami s'est inscrit avec votre code.`
          : `+${formatFcfa(p.delta_fcfa ?? 0, lang)} — a friend joined with your code.`,
        icon: 'people', color: '#34C759',
      }
    case 'review_reply':
      return {
        title: lang === 'fr' ? `${place} vous a répondu` : `${place} replied to you`,
        body: p.reply_excerpt ?? (lang === 'fr' ? 'Voir la réponse à votre avis.' : 'See the reply to your review.'),
        icon: 'chatbubble-ellipses-outline', color: '#007AFF',
      }
    case 'new_review': {
      const stars = '★'.repeat(Math.max(1, Math.min(5, p.rating ?? 5)))
      const who = p.author_name ?? (lang === 'fr' ? 'Un client' : 'A customer')
      return {
        title: lang === 'fr' ? `Nouvel avis sur ${place} ⭐` : `New review on ${place} ⭐`,
        body: lang === 'fr'
          ? `${who} : ${stars}${p.excerpt ? ` — « ${p.excerpt} »` : ''}`
          : `${who}: ${stars}${p.excerpt ? ` — “${p.excerpt}”` : ''}`,
        icon: 'star-outline', color: '#FF9F0A',
      }
    }
    case 'new_coupon': {
      const coupon = lang === 'fr' ? (p.coupon_title_fr ?? p.coupon_title_en) : (p.coupon_title_en ?? p.coupon_title_fr)
      if (p.platform) {
        return {
          title: lang === 'fr' ? "Nouveau coupon O'Kili 🏷️" : "New O'Kili coupon 🏷️",
          body: coupon ?? (lang === 'fr' ? 'Une nouvelle offre est disponible.' : 'A new offer is available.'),
          icon: 'pricetags-outline', color: '#E8571A',
        }
      }
      return {
        title: lang === 'fr' ? `${place} : nouveau coupon 🏷️` : `${place}: new coupon 🏷️`,
        body: coupon ?? (lang === 'fr' ? 'Une nouvelle offre vous attend.' : 'A new offer is waiting for you.'),
        icon: 'pricetags-outline', color: '#E8571A',
      }
    }
    case 'place_activated':
      return {
        title: lang === 'fr' ? 'Votre établissement est en ligne 🎉' : 'Your place is live 🎉',
        body: lang === 'fr'
          ? `${place} est maintenant visible par tous les utilisateurs d'O'Kili.`
          : `${place} is now visible to all O'Kili users.`,
        icon: 'storefront-outline', color: '#34C759',
      }
    default:
      // Forward compatibility: a build that predates a notification type must
      // render something rather than crash the inbox.
      return {
        title: "O'Kili",
        body: lang === 'fr' ? 'Vous avez une nouvelle notification.' : 'You have a new notification.',
        icon: 'notifications-outline', color: '#8E8E93',
      }
  }
}

export default function NotificationsScreen() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const colors = useThemeColors()
  const { data: items, isLoading, refetch, isRefetching } = useNotifications(50)
  const markAllRead = useMarkAllNotificationsRead()

  const styles = useMemo(() => createStyles(colors), [colors])

  // Opening the inbox clears the unread badge. The already-rendered list keeps
  // its unread dots until the next visit, like most inboxes.
  const hasUnread = (items ?? []).some(n => n.read_at === null)
  useEffect(() => {
    if (hasUnread && !markAllRead.isPending) markAllRead.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnread])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#E8571A" />}
      >
        {isLoading ? (
          <View style={styles.loading}><ActivityIndicator color="#E8571A" /></View>
        ) : (items ?? []).length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={40} color={colors.iconMuted} />
            <Text style={styles.emptyTitle}>
              {lang === 'fr' ? 'Aucune notification' : 'No notifications yet'}
            </Text>
            <Text style={styles.emptyText}>
              {lang === 'fr'
                ? 'Coupons validés, crédit reçu et réponses à vos avis apparaîtront ici.'
                : 'Redeemed coupons, credit you receive and replies to your reviews will appear here.'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {(items ?? []).map(n => {
              const copy = notificationCopy(n, lang)
              return (
                <Pressable
                  key={n.id}
                  style={styles.row}
                  onPress={() => {
                    if (n.type === 'new_review') {
                      router.push('/restaurant-admin/reviews' as any) // owner-facing: jump to the reply screen
                    } else if (n.payload.place_id) {
                      router.push(`/place/${n.payload.place_id}` as any)
                    }
                  }}
                >
                  <View style={[styles.icon, { backgroundColor: copy.color + '1A' }]}>
                    <Ionicons name={copy.icon} size={16} color={copy.color} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{copy.title}</Text>
                    <Text style={styles.rowBody} numberOfLines={3}>{copy.body}</Text>
                    <Text style={styles.rowMeta}>{formatDateTime(n.created_at, lang)}</Text>
                  </View>
                  {n.read_at === null && <View style={styles.unreadDot} />}
                </Pressable>
              )
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function createStyles(c: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bgPrimary },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: c.textPrimary },

    scroll: { paddingHorizontal: 16, paddingBottom: 32 },

    loading: { paddingVertical: 60, alignItems: 'center' },

    empty: { paddingVertical: 60, alignItems: 'center', gap: 10 },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
    emptyText:  { fontSize: 13, color: c.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 18 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 14,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.surfaceBorder,
    },
    icon: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
    },
    rowTitle: { fontSize: 14, fontWeight: '700', color: c.textPrimary },
    rowBody:  { fontSize: 12, color: c.textSecondary, marginTop: 2, lineHeight: 16 },
    rowMeta:  { fontSize: 10, color: c.textSecondary, marginTop: 4 },

    unreadDot: {
      width: 9, height: 9, borderRadius: 5,
      backgroundColor: '#E8571A',
    },
  })
}

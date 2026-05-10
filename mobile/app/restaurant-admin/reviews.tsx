import { Ionicons } from '@expo/vector-icons'
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
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'

import { supabase } from '../../lib/supabase'
import { useSession } from '../../hooks/useSession'
import { useThemeColors } from '../../contexts/ThemeContext'
import { useReviews, useSetOwnerReply, type ReviewWithProfile } from '../../hooks/useReviews'

interface OwnedPlaceLite {
  id: string
  name: string
}

function useOwnedPlaceLite(userId: string | undefined) {
  return useQuery({
    queryKey: ['owned-place-lite', userId],
    queryFn: async () => {
      if (!userId) return null
      const { data } = await supabase
        .from('places')
        .select('id, name')
        .eq('owner_id', userId)
        .eq('is_deleted', false)
        .single()
      return data as OwnedPlaceLite | null
    },
    enabled: !!userId,
  })
}

function StarRow({ value }: { value: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= value ? 'star' : 'star-outline'}
          size={13}
          color={i <= value ? '#FF9500' : '#C7C7CC'}
        />
      ))}
    </View>
  )
}

function formatDate(iso: string, lang: 'fr' | 'en') {
  const d = new Date(iso)
  return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

interface ReviewCardProps {
  review: ReviewWithProfile
  placeId: string
  lang: 'fr' | 'en'
}

function ReviewCard({ review, placeId, lang }: ReviewCardProps) {
  const colors = useThemeColors()
  const setOwnerReply = useSetOwnerReply(placeId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(review.owner_reply ?? '')
  const [saving, setSaving] = useState(false)

  const reviewer = review.profiles?.full_name ?? (lang === 'fr' ? 'Utilisateur' : 'User')

  async function handleSave() {
    setSaving(true)
    try {
      await setOwnerReply.mutateAsync({ reviewId: review.id, reply: draft })
      setEditing(false)
    } catch (e: any) {
      Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', e?.message ?? 'Could not save reply')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    Alert.alert(
      lang === 'fr' ? 'Supprimer la réponse ?' : 'Delete the reply?',
      lang === 'fr' ? 'Cette action est irréversible.' : 'This cannot be undone.',
      [
        { text: lang === 'fr' ? 'Annuler' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'fr' ? 'Supprimer' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true)
            try {
              await setOwnerReply.mutateAsync({ reviewId: review.id, reply: '' })
              setDraft('')
              setEditing(false)
            } catch (e: any) {
              Alert.alert(lang === 'fr' ? 'Erreur' : 'Error', e?.message ?? 'Could not clear reply')
            } finally {
              setSaving(false)
            }
          },
        },
      ]
    )
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.reviewerName, { color: colors.textPrimary }]}>{reviewer}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <StarRow value={review.rating} />
            <Text style={[styles.metaDate, { color: colors.textSecondary }]}>
              {formatDate(review.created_at, lang)}
            </Text>
          </View>
        </View>
      </View>

      {review.comment && (
        <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
          {review.comment}
        </Text>
      )}

      {/* Existing reply, not editing */}
      {!editing && review.owner_reply && (
        <View style={[styles.replyBox, { backgroundColor: colors.surface, borderColor: colors.separator }]}>
          <View style={styles.replyHeader}>
            <Ionicons name="arrow-undo" size={13} color="#E8571A" />
            <Text style={styles.replyLabel}>
              {lang === 'fr' ? 'Votre réponse' : 'Your reply'}
            </Text>
            {review.owner_reply_at && (
              <Text style={[styles.metaDate, { color: colors.textSecondary }]}>
                · {formatDate(review.owner_reply_at, lang)}
              </Text>
            )}
            <Pressable onPress={() => setEditing(true)} style={styles.editBtn}>
              <Text style={styles.editBtnText}>{lang === 'fr' ? 'Modifier' : 'Edit'}</Text>
            </Pressable>
          </View>
          <Text style={[styles.replyText, { color: colors.textPrimary }]}>{review.owner_reply}</Text>
        </View>
      )}

      {/* No reply yet, not editing */}
      {!editing && !review.owner_reply && (
        <Pressable
          onPress={() => setEditing(true)}
          style={[styles.replyCta, { borderColor: colors.separator }]}
        >
          <Ionicons name="arrow-undo-outline" size={14} color="#E8571A" />
          <Text style={styles.replyCtaText}>
            {lang === 'fr' ? 'Répondre à cet avis' : 'Reply to this review'}
          </Text>
        </Pressable>
      )}

      {/* Editing */}
      {editing && (
        <View style={{ gap: 10 }}>
          <TextInput
            style={[
              styles.replyInput,
              { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.separator },
            ]}
            value={draft}
            onChangeText={setDraft}
            multiline
            numberOfLines={4}
            autoFocus
            placeholder={
              lang === 'fr'
                ? 'Répondez avec respect et professionnalisme…'
                : 'Reply respectfully and professionally…'
            }
            placeholderTextColor={colors.textPlaceholder}
          />
          <View style={styles.replyActions}>
            {review.owner_reply && (
              <Pressable onPress={handleClear} disabled={saving} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>
                  {lang === 'fr' ? 'Supprimer' : 'Delete'}
                </Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => {
                setDraft(review.owner_reply ?? '')
                setEditing(false)
              }}
              disabled={saving}
              style={styles.cancelBtn}
            >
              <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving || !draft.trim()}
              style={[styles.saveBtn, (!draft.trim() || saving) && styles.saveBtnDisabled]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {lang === 'fr' ? 'Publier' : 'Publish'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  )
}

export default function RestaurantAdminReviews() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const colors = useThemeColors()
  const { session } = useSession()
  const { data: place, isLoading: placeLoading } = useOwnedPlaceLite(session?.user.id)
  const { data, isLoading: reviewsLoading } = useReviews(place?.id ?? '')

  const loading = placeLoading || reviewsLoading

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {lang === 'fr' ? 'Avis & réponses' : 'Reviews & replies'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading && (
            <View style={styles.center}>
              <ActivityIndicator color="#E8571A" />
            </View>
          )}

          {!loading && !place && (
            <View style={styles.center}>
              <Ionicons name="storefront-outline" size={40} color={colors.iconMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {lang === 'fr' ? 'Aucun restaurant lié à votre compte.' : 'No restaurant linked to your account.'}
              </Text>
            </View>
          )}

          {!loading && place && (data?.reviews?.length ?? 0) === 0 && (
            <View style={styles.center}>
              <Ionicons name="chatbubbles-outline" size={40} color={colors.iconMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                {lang === 'fr' ? 'Pas encore d’avis' : 'No reviews yet'}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {lang === 'fr'
                  ? 'Quand vos clients laisseront des avis, vous pourrez répondre ici.'
                  : 'When customers leave reviews you’ll be able to reply here.'}
              </Text>
            </View>
          )}

          {!loading && place && (data?.reviews?.length ?? 0) > 0 && (
            <>
              <View style={styles.summary}>
                <Text style={[styles.summaryAvg, { color: colors.textPrimary }]}>
                  {data!.average!.toFixed(1)}
                </Text>
                <View style={{ gap: 4 }}>
                  <StarRow value={Math.round(data!.average!)} />
                  <Text style={[styles.summaryCount, { color: colors.textSecondary }]}>
                    {data!.count} {data!.count === 1 ? (lang === 'fr' ? 'avis' : 'review') : (lang === 'fr' ? 'avis' : 'reviews')}
                  </Text>
                </View>
              </View>
              <View style={{ gap: 12 }}>
                {data!.reviews.map(r => (
                  <ReviewCard key={r.id} review={r} placeId={place.id} lang={lang} />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  center: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 18 },

  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 4,
    paddingVertical: 12,
    marginBottom: 16,
  },
  summaryAvg: { fontSize: 32, fontWeight: '700' },
  summaryCount: { fontSize: 12 },

  card: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  reviewerName: { fontSize: 14, fontWeight: '700' },
  metaDate: { fontSize: 11 },
  reviewText: { fontSize: 14, lineHeight: 20 },

  replyBox: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 6,
    marginTop: 4,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  replyLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E8571A',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  replyText: { fontSize: 13, lineHeight: 18 },

  replyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  replyCtaText: { fontSize: 13, fontWeight: '600', color: '#E8571A' },

  replyInput: {
    minHeight: 90,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  replyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  editBtnText: { fontSize: 12, color: '#E8571A', fontWeight: '600' },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  clearBtnText: { fontSize: 13, color: '#FF3B30', fontWeight: '600' },
  cancelBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  cancelBtnText: { fontSize: 13, fontWeight: '500' },
  saveBtn: {
    backgroundColor: '#E8571A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 84,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
})

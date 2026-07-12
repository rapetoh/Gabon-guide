/**
 * ReviewsBottomSheet — slides up from the bottom of the video feed card.
 *
 * Shows:
 *   - Average rating + review count
 *   - List of all reviews (avatar initial, name, stars, date, comment)
 *   - Inline review form (star picker + text input) for logged-in users
 *   - Login prompt for logged-out users
 *
 * Implemented with React Native Modal + Animated — no third-party libs needed.
 */
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  useReviews,
  useUserReview,
  useSubmitReview,
  useDeleteReview,
} from '../hooks/useReviews'
import { useSession } from '../hooks/useSession'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.72

interface Props {
  placeId: string
  placeName: string
  visible: boolean
  onClose: () => void
  lang: 'fr' | 'en'
}

export default function ReviewsBottomSheet({ placeId, placeName, visible, onClose, lang }: Props) {
  const insets = useSafeAreaInsets()
  const { session } = useSession()
  const { data: reviewsData, isLoading } = useReviews(placeId)
  const { data: userReview } = useUserReview(placeId)
  const submitReview = useSubmitReview(placeId)
  const deleteReview = useDeleteReview(placeId)

  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewFormOpen, setReviewFormOpen] = useState(false)

  // Reset form when sheet opens
  useEffect(() => {
    if (visible) {
      setReviewFormOpen(false)
      setReviewRating(0)
      setReviewComment('')
    }
  }, [visible])

  // Slide animation
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start()
    } else {
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }).start()
    }
  }, [visible, slideAnim])

  function handleSubmit() {
    if (reviewRating === 0) return
    submitReview.mutate(
      { rating: reviewRating, comment: reviewComment.trim() || undefined },
      { onSuccess: () => { setReviewFormOpen(false) } }
    )
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 8 },
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle} numberOfLines={1}>{placeName}</Text>
            {reviewsData && reviewsData.count > 0 && (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={13} color="#FF9500" />
                <Text style={styles.ratingValue}>{reviewsData.average!.toFixed(1)}</Text>
                <Text style={styles.ratingCount}>
                  · {reviewsData.count} {lang === 'fr' ? 'avis' : 'reviews'}
                </Text>
              </View>
            )}
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#8E8E93" />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Login prompt ── */}
            {!session && (
              <Pressable style={styles.loginPrompt} onPress={() => { onClose(); router.push('/auth/login') }}>
                <Ionicons name="star-outline" size={18} color="#E8571A" />
                <Text style={styles.loginPromptText}>
                  {lang === 'fr' ? 'Connectez-vous pour laisser un avis' : 'Log in to leave a review'}
                </Text>
              </Pressable>
            )}

            {/* ── Add review button (logged in, no existing review, form closed) ── */}
            {session && !userReview && !reviewFormOpen && (
              <Pressable
                style={styles.addReviewBtn}
                onPress={() => { setReviewRating(0); setReviewComment(''); setReviewFormOpen(true) }}
              >
                <Ionicons name="star-outline" size={16} color="#E8571A" />
                <Text style={styles.addReviewBtnText}>
                  {lang === 'fr' ? 'Laisser un avis' : 'Leave a review'}
                </Text>
              </Pressable>
            )}

            {/* ── Review form ── */}
            {session && (reviewFormOpen || userReview) && (
              <View style={styles.reviewForm}>
                <Text style={styles.reviewFormLabel}>
                  {userReview && !reviewFormOpen
                    ? (lang === 'fr' ? 'Votre avis' : 'Your review')
                    : (lang === 'fr' ? 'Laisser un avis' : 'Leave a review')}
                </Text>

                {/* Stars */}
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <Pressable
                      key={star}
                      onPress={() => reviewFormOpen && setReviewRating(star)}
                      hitSlop={6}
                    >
                      <Ionicons
                        name={star <= (reviewFormOpen ? reviewRating : (userReview?.rating ?? 0)) ? 'star' : 'star-outline'}
                        size={32}
                        color="#FF9500"
                      />
                    </Pressable>
                  ))}
                </View>

                {/* Text input (only when form is open) */}
                {reviewFormOpen && (
                  <TextInput
                    style={styles.reviewInput}
                    placeholder={lang === 'fr' ? 'Commentaire (optionnel)' : 'Comment (optional)'}
                    placeholderTextColor="#C7C7CC"
                    value={reviewComment}
                    onChangeText={setReviewComment}
                    multiline
                    numberOfLines={3}
                  />
                )}

                {/* Submit / Cancel */}
                {reviewFormOpen && (
                  <View style={styles.formButtons}>
                    <Pressable style={styles.cancelBtn} onPress={() => setReviewFormOpen(false)}>
                      <Text style={styles.cancelBtnText}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.submitBtn, reviewRating === 0 && { opacity: 0.4 }]}
                      disabled={reviewRating === 0 || submitReview.isPending}
                      onPress={handleSubmit}
                    >
                      {submitReview.isPending
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.submitBtnText}>{lang === 'fr' ? 'Publier' : 'Submit'}</Text>}
                    </Pressable>
                  </View>
                )}

                {/* Edit / Delete when not in edit mode */}
                {!reviewFormOpen && userReview && (
                  <View style={styles.formButtons}>
                    <Pressable style={styles.cancelBtn} onPress={() => {
                      setReviewRating(userReview.rating)
                      setReviewComment(userReview.comment ?? '')
                      setReviewFormOpen(true)
                    }}>
                      <Text style={styles.cancelBtnText}>{lang === 'fr' ? 'Modifier' : 'Edit'}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.cancelBtn, { borderColor: '#FF3B30' }]}
                      onPress={() => deleteReview.mutate()}
                      disabled={deleteReview.isPending}
                    >
                      {deleteReview.isPending
                        ? <ActivityIndicator size="small" color="#FF3B30" />
                        : <Text style={[styles.cancelBtnText, { color: '#FF3B30' }]}>
                            {lang === 'fr' ? 'Supprimer' : 'Delete'}
                          </Text>}
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            {/* ── Reviews list ── */}
            {isLoading ? (
              <ActivityIndicator color="#E8571A" style={{ marginTop: 24 }} />
            ) : reviewsData?.count === 0 ? (
              <Text style={styles.emptyText}>
                {lang === 'fr' ? 'Soyez le premier à laisser un avis.' : 'Be the first to leave a review.'}
              </Text>
            ) : (
              (reviewsData?.reviews ?? []).map(review => {
                const isOwn = review.profiles?.id === session?.user.id
                const name = review.profiles?.full_name ?? (lang === 'fr' ? 'Utilisateur' : 'User')
                const initial = name.charAt(0).toUpperCase()
                const date = new Date(review.created_at).toLocaleDateString(
                  lang === 'fr' ? 'fr-FR' : 'en-US',
                  { month: 'short', year: 'numeric' }
                )
                return (
                  <View key={review.id} style={[styles.reviewCard, isOwn && styles.reviewCardOwn]}>
                    <View style={styles.reviewHeader}>
                      {review.profiles?.avatar_url ? (
                        <Image
                          source={{ uri: review.profiles.avatar_url }}
                          style={styles.avatar}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>{initial}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reviewName}>
                          {isOwn ? (lang === 'fr' ? 'Vous' : 'You') : name}
                        </Text>
                        <Text style={styles.reviewDate}>{date}</Text>
                      </View>
                      <View style={styles.reviewStars}>
                        {[1, 2, 3, 4, 5].map(s => (
                          <Ionicons
                            key={s}
                            name={s <= review.rating ? 'star' : 'star-outline'}
                            size={12}
                            color="#FF9500"
                          />
                        ))}
                      </View>
                    </View>
                    {review.comment ? (
                      <Text style={styles.reviewComment}>{review.comment}</Text>
                    ) : null}
                  </View>
                )
              })
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    maxWidth: 260,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  ratingValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  ratingCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
  },
  loginPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(232,87,26,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(232,87,26,0.2)',
  },
  loginPromptText: {
    color: '#E8571A',
    fontSize: 14,
    fontWeight: '600',
  },
  addReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(232,87,26,0.4)',
    alignSelf: 'flex-start',
  },
  addReviewBtnText: {
    color: '#E8571A',
    fontSize: 14,
    fontWeight: '600',
  },
  reviewForm: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  reviewFormLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  starRow: {
    flexDirection: 'row',
    gap: 6,
  },
  reviewInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#fff',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  submitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#E8571A',
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  emptyText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    marginTop: 12,
  },
  reviewCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  reviewCardOwn: {
    borderWidth: 1,
    borderColor: 'rgba(232,87,26,0.3)',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E8571A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  reviewName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  reviewDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 1,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 1,
  },
  reviewComment: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 20,
  },
})

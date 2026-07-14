import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert } from 'react-native'

import i18n from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

// Shows a French/English alert when a review mutation fails. RLS refusals
// (e.g. blocked accounts) get a specific message; everything else gets a
// generic "check your connection" hint.
export function showMutationErrorAlert(err: unknown) {
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const e = err as { code?: string; message?: string }
  const isRlsRefusal =
    e?.code === '42501' || (e?.message ?? '').toLowerCase().includes('row-level security')
  Alert.alert(
    lang === 'fr' ? 'Erreur' : 'Error',
    isRlsRefusal
      ? (lang === 'fr'
          ? 'Votre compte ne permet pas cette action.'
          : 'Your account is not allowed to do this.')
      : (lang === 'fr'
          ? 'Échec — vérifiez votre connexion et réessayez.'
          : 'Failed — check your connection and try again.'),
  )
}

// Explicit type for review rows returned with a profiles join.
// Supabase's type inference for nested selects requires Relationships metadata
// that our hand-written types don't include, so we declare the shape manually.
export interface ReviewWithProfile {
  id: string
  rating: number
  comment: string | null
  owner_reply: string | null
  owner_reply_at: string | null
  created_at: string
  // Snapshot of the author's name taken at account deletion (migration 027) —
  // used as the display fallback when the profiles join is null.
  author_display_name: string | null
  profiles: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

// Fetches all reviews for a place and computes the average rating.
//
// Reviews and reviewer-display info are fetched in two queries instead of one
// PostgREST embed. The base `profiles` table is no longer publicly readable
// (migration 025 — privacy fix), so we read names/avatars from the safe
// `profiles_public` view and stitch them in client-side.
export function useReviews(placeId: string) {
  return useQuery({
    queryKey: ['reviews', placeId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('reviews')
        .select('id, user_id, rating, comment, owner_reply, owner_reply_at, created_at, author_display_name')
        .eq('place_id', placeId)
        .order('created_at', { ascending: false })
      if (error) throw error

      const reviewRows = (rows ?? []) as unknown as Array<{
        id: string
        user_id: string
        rating: number
        comment: string | null
        owner_reply: string | null
        owner_reply_at: string | null
        created_at: string
        author_display_name: string | null
      }>

      const userIds = Array.from(new Set(reviewRows.map(r => r.user_id).filter(Boolean)))
      const profileById = new Map<string, { id: string; full_name: string | null; avatar_url: string | null }>()
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('id, full_name, avatar_url')
          .in('id', userIds)
        for (const p of (profiles ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>) {
          profileById.set(p.id, p)
        }
      }

      const reviews: ReviewWithProfile[] = reviewRows.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        owner_reply: r.owner_reply,
        owner_reply_at: r.owner_reply_at,
        created_at: r.created_at,
        author_display_name: r.author_display_name,
        profiles: profileById.get(r.user_id) ?? null,
      }))

      const average =
        reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : null

      return { reviews, average, count: reviews.length }
    },
    enabled: !!placeId,
  })
}

// Owner-only mutation: set/update/clear the public reply on a review.
// Hits the SECURITY DEFINER RPC which checks that the caller is the place
// owner or an admin server-side. Pass an empty string to clear.
export function useSetOwnerReply(placeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ reviewId, reply }: { reviewId: string; reply: string }) => {
      const { error } = await supabase.rpc('set_review_owner_reply', {
        p_review_id: reviewId,
        p_reply: reply,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', placeId] })
    },
  })
}

// Fetches the current user's review for a place (used to pre-fill the edit form).
export function useUserReview(placeId: string) {
  const { session } = useSession()

  return useQuery({
    queryKey: ['userReview', placeId, session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('place_id', placeId)
        .eq('user_id', session!.user.id)
        .maybeSingle()
      if (error) throw error
      return data as { id: string; rating: number; comment: string | null } | null
    },
    enabled: !!placeId && !!session,
  })
}

// Upserts (create or update) the current user's review for a place.
export function useSubmitReview(placeId: string) {
  const { session } = useSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ rating, comment }: { rating: number; comment?: string }) => {
      if (!session) throw new Error('Not logged in')

      const { error } = await supabase.from('reviews').upsert(
        {
          place_id: placeId,
          user_id: session.user.id,
          rating,
          comment: comment ?? null,
        },
        { onConflict: 'place_id,user_id' }
      )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', placeId] })
      queryClient.invalidateQueries({ queryKey: ['userReview', placeId, session?.user.id] })
    },
    onError: showMutationErrorAlert,
  })
}

// Deletes the current user's review for a place.
export function useDeleteReview(placeId: string) {
  const { session } = useSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Not logged in')

      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('place_id', placeId)
        .eq('user_id', session.user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', placeId] })
      queryClient.invalidateQueries({ queryKey: ['userReview', placeId, session?.user.id] })
    },
    onError: showMutationErrorAlert,
  })
}

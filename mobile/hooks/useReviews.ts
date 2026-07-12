import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

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
        .select('id, user_id, rating, comment, owner_reply, owner_reply_at, created_at')
        .eq('place_id', placeId)
        .order('created_at', { ascending: false })
      if (error) throw error

      const reviewRows = (rows ?? []) as Array<{
        id: string
        user_id: string
        rating: number
        comment: string | null
        owner_reply: string | null
        owner_reply_at: string | null
        created_at: string
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
  })
}

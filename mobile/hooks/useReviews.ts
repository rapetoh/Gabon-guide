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
  created_at: string
  profiles: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

// Fetches all reviews for a place and computes the average rating.
export function useReviews(placeId: string) {
  return useQuery({
    queryKey: ['reviews', placeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id, rating, comment, created_at,
          profiles ( id, full_name, avatar_url )
        `)
        .eq('place_id', placeId)
        .order('created_at', { ascending: false })
      if (error) throw error

      const reviews = (data ?? []) as unknown as ReviewWithProfile[]
      const average =
        reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : null

      return { reviews, average, count: reviews.length }
    },
    enabled: !!placeId,
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

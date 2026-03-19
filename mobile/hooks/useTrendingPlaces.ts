import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface TrendingPlace {
  id: string
  name: string
  is_promoted: boolean
  promoted_label_fr: string | null
  promoted_label_en: string | null
  price_range: number | null
  hours: any
  photos: { storage_path: string; is_primary: boolean }[]
  categories: { name_fr: string; name_en: string } | null
  zones: { name: string } | null
  _avgRating: number | null
  _reviewCount: number
}

/**
 * Fetches places for the "Trending Now" home screen section.
 *
 * Sort order:
 *   1. Promoted places (is_promoted = true) — appear first, carry a badge
 *   2. Top-rated places (highest average review rating)
 *   3. Remaining active places (fallback when reviews are scarce)
 *
 * Returns up to 8 places total.
 */
export function useTrendingPlaces() {
  return useQuery({
    queryKey: ['trendingPlaces'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('places')
        .select(`
          id, name, is_promoted, promoted_label_fr, promoted_label_en,
          price_range, hours,
          photos ( storage_path, is_primary ),
          categories ( name_fr, name_en ),
          zones ( name ),
          reviews ( rating )
        `)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .limit(30) // fetch a pool large enough to rank from
      if (error) throw error

      const places = (data ?? []) as any[]

      // Compute average rating and review count for each place
      const ranked = places.map(p => {
        const reviews: { rating: number }[] = p.reviews ?? []
        const avgRating = reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : null
        return {
          ...p,
          _avgRating: avgRating,
          _reviewCount: reviews.length,
        } as TrendingPlace
      })

      // Sort: promoted first, then by average rating descending, then by review count
      ranked.sort((a, b) => {
        if (a.is_promoted && !b.is_promoted) return -1
        if (!a.is_promoted && b.is_promoted) return 1
        // Both in the same tier — sort by rating
        if (a._avgRating !== null && b._avgRating !== null) return b._avgRating - a._avgRating
        if (a._avgRating !== null) return -1
        if (b._avgRating !== null) return 1
        return b._reviewCount - a._reviewCount
      })

      return ranked.slice(0, 8)
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — trending doesn't change by the second
  })
}

import { useQuery } from '@tanstack/react-query'
import { getFeedSeed, rankFeed } from '../lib/feedRanking'
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
 * Ranking: average rating drives the score, with a seeded jitter so the
 * section doesn't show the identical list on every open. Promoted places
 * get a rotating slot within the top 3 (guaranteed early, never welded
 * to #1) and carry a badge.
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

      // Rating dominates the score; the seeded jitter (noiseWeight 0.4)
      // varies the order between sessions without letting a 3-star place
      // outrank a 5-star one. rankFeed slots promoted places into the top 3.
      const shuffled = rankFeed(
        ranked,
        getFeedSeed(),
        p =>
          (p._avgRating !== null ? (p._avgRating / 5) * 1.0 : 0.3) +
          Math.min(p._reviewCount, 10) * 0.01,
        0.4
      )

      return shuffled.slice(0, 8)
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — trending doesn't change by the second
  })
}

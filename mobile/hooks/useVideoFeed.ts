import { useInfiniteQuery } from '@tanstack/react-query'
import { getFeedSeed, rankFeed } from '../lib/feedRanking'
import { supabase } from '../lib/supabase'
import { isOpenNow } from '../utils/isOpenNow'

export interface FeedItem {
  id: string
  name: string
  description_fr: string | null
  description_en: string | null
  is_promoted: boolean
  hours: any
  price_range: number | null
  categories: { name_fr: string; name_en: string } | null
  zones: { name: string } | null
  /** Primary video for this place (lowest position). Null when place has no video. */
  video: { id: string; storage_path: string; thumbnail_url: string | null } | null
  /** Gallery photos (not menu, not deleted), sorted primary first */
  photos: { storage_path: string; is_primary: boolean }[]
  /** True when the place has at least one menu photo */
  hasMenuPhotos: boolean
}

export interface FeedFilters {
  categoryId?: string | null
  zoneId?: string | null
  priceRange?: 1 | 2 | 3 | null
  openNow?: boolean
}

export interface FeedPage {
  items: FeedItem[]
  /** Row count BEFORE the client-side openNow filter. Pagination must be
   *  based on this — a page can be full server-side yet filter to zero
   *  items, and ending pagination there would falsely show "no places". */
  rawCount: number
}

const PAGE_SIZE = 15

/** Days during which a newly added place gets a discovery boost in the feed */
const NEW_PLACE_BOOST_DAYS = 14

export function useVideoFeed(filters: FeedFilters = {}) {
  const { categoryId, zoneId, priceRange, openNow } = filters

  return useInfiniteQuery({
    queryKey: ['video-feed', categoryId, zoneId, priceRange, openNow],
    queryFn: async ({ pageParam }): Promise<FeedPage> => {
      const from = (pageParam as number) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      // Step 1 — rank the whole catalog (lightweight query: ids + signals).
      // Ordering happens here, not in SQL: a seeded shuffle with a quality
      // boost, so the feed order changes between sessions/refreshes while
      // staying stable across pages within one session.
      let rankQuery = supabase
        .from('places')
        .select(`
          id, is_promoted, created_at,
          videos ( id ),
          reviews ( rating )
        `)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .limit(500)

      if (categoryId) rankQuery = rankQuery.eq('category_id', categoryId)
      if (zoneId) rankQuery = rankQuery.eq('zone_id', zoneId)
      if (priceRange) rankQuery = rankQuery.eq('price_range', priceRange)

      const { data: pool, error: rankError } = await rankQuery
      if (rankError) throw rankError

      const nowMs = Date.now()
      const ranked = rankFeed(
        (pool ?? []) as any[],
        getFeedSeed(),
        (p: any) => {
          const ratings: { rating: number }[] = p.reviews ?? []
          const avgRating =
            ratings.length > 0
              ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
              : null
          const ageDays = (nowMs - new Date(p.created_at).getTime()) / 86400000
          return (
            ((p.videos ?? []).length > 0 ? 0.25 : 0) +
            (avgRating !== null ? (avgRating / 5) * 0.25 : 0) +
            (ageDays <= NEW_PLACE_BOOST_DAYS ? 0.2 : 0)
          )
        }
      )

      const pageIds = ranked.slice(from, to + 1).map(p => p.id)
      if (pageIds.length === 0) return { items: [], rawCount: 0 }

      // Step 2 — fetch full details for just this page's places.
      const { data, error } = await supabase
        .from('places')
        .select(`
          id, name, description_fr, description_en, is_promoted, hours, price_range,
          categories ( name_fr, name_en ),
          zones ( name ),
          photos ( storage_path, is_primary, is_menu, is_deleted ),
          videos ( id, storage_path, thumbnail_url, position )
        `)
        .in('id', pageIds)
      if (error) throw error

      // .in() does not preserve order — restore the ranked order
      const orderIndex = new Map(pageIds.map((id, i) => [id, i]))
      const orderedData = [...(data ?? [])].sort(
        (a: any, b: any) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0)
      )

      let items = orderedData.map((p: any): FeedItem => {
        const allPhotos: any[] = p.photos ?? []
        const gallery = allPhotos
          .filter((ph: any) => !ph.is_deleted && !ph.is_menu)
          .sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
        const hasMenuPhotos = allPhotos.some((ph: any) => !ph.is_deleted && ph.is_menu)

        const sortedVideos: any[] = [...(p.videos ?? [])].sort(
          (a: any, b: any) => a.position - b.position
        )

        return {
          id: p.id,
          name: p.name,
          description_fr: p.description_fr,
          description_en: p.description_en,
          is_promoted: p.is_promoted ?? false,
          hours: p.hours,
          price_range: p.price_range,
          categories: p.categories ?? null,
          zones: p.zones ?? null,
          video: sortedVideos[0]
            ? {
                id: sortedVideos[0].id,
                storage_path: sortedVideos[0].storage_path,
                thumbnail_url: sortedVideos[0].thumbnail_url ?? null,
              }
            : null,
          photos: gallery.map((ph: any) => ({
            storage_path: ph.storage_path,
            is_primary: ph.is_primary,
          })),
          hasMenuPhotos,
        }
      })

      const rawCount = pageIds.length

      // Open now is client-side (hours is JSON, can't filter in SQL efficiently)
      if (openNow) {
        items = items.filter(item => isOpenNow(item.hours))
      }

      return { items, rawCount }
    },
    initialPageParam: 0,
    // Based on the pre-filter row count: a page can be full server-side yet
    // filter down to zero items, and there may still be more rows after it.
    getNextPageParam: (lastPage, allPages) =>
      lastPage.rawCount === PAGE_SIZE ? allPages.length : undefined,
  })
}

import { useInfiniteQuery } from '@tanstack/react-query'
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

const PAGE_SIZE = 15

export function useVideoFeed(filters: FeedFilters = {}) {
  const { categoryId, zoneId, priceRange, openNow } = filters

  return useInfiniteQuery({
    queryKey: ['video-feed', categoryId, zoneId, priceRange, openNow],
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('places')
        .select(`
          id, name, description_fr, description_en, is_promoted, hours, price_range,
          categories ( name_fr, name_en ),
          zones ( name ),
          photos ( storage_path, is_primary, is_menu, is_deleted ),
          videos ( id, storage_path, thumbnail_url, position )
        `)
        .eq('is_active', true)
        .eq('is_deleted', false)

      if (categoryId) query = query.eq('category_id', categoryId)
      if (zoneId) query = query.eq('zone_id', zoneId)
      if (priceRange) query = query.eq('price_range', priceRange)

      query = query
        .order('is_promoted', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

      const { data, error } = await query
      if (error) throw error

      let items = (data ?? []).map((p: any): FeedItem => {
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

      // Open now is client-side (hours is JSON, can't filter in SQL efficiently)
      if (openNow) {
        items = items.filter(item => isOpenNow(item.hours))
      }

      return items
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length > 0 ? allPages.length : undefined,
  })
}

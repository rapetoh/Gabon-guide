import { useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface FeedItem {
  id: string
  name: string
  description_fr: string | null
  description_en: string | null
  is_promoted: boolean
  categories: { name_fr: string; name_en: string } | null
  zones: { name: string } | null
  /** Primary video for this place (lowest position). Null when place has no video. */
  video: { id: string; storage_path: string; thumbnail_url: string | null } | null
  /** Gallery photos (not menu, not deleted), sorted primary first */
  photos: { storage_path: string; is_primary: boolean }[]
  /** True when the place has at least one menu photo */
  hasMenuPhotos: boolean
}

const PAGE_SIZE = 10

export function useVideoFeed() {
  return useInfiniteQuery({
    queryKey: ['video-feed'],
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data, error } = await supabase
        .from('places')
        .select(`
          id, name, description_fr, description_en, is_promoted,
          categories ( name_fr, name_en ),
          zones ( name ),
          photos ( storage_path, is_primary, is_menu, is_deleted ),
          videos ( id, storage_path, thumbnail_url, position )
        `)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('is_promoted', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error

      return (data ?? []).map((p: any): FeedItem => {
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
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
  })
}

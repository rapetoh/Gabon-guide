import { useInfiniteQuery } from '@tanstack/react-query'

import type { Database } from '../lib/database.types'
import { supabase } from '../lib/supabase'

export type Place = Database['public']['Tables']['places']['Row']

export interface PlaceFilters {
  categoryId?: string
  subcategoryId?: string
  zoneId?: string
  priceRange?: 1 | 2 | 3
  openNow?: boolean
}

const PAGE_SIZE = 20

// Fetches paginated active places with optional filters.
// Uses infinite query so the Explore screen can load more as the user scrolls.
export function usePlaces(filters: PlaceFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['places', filters],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from('places')
        .select(`
          *,
          categories ( id, name_fr, name_en, slug ),
          zones ( id, name ),
          subcategories ( id, name_fr, name_en ),
          photos ( id, storage_path, is_primary, position )
        `)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1)

      if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
      if (filters.subcategoryId) query = query.eq('subcategory_id', filters.subcategoryId)
      if (filters.zoneId) query = query.eq('zone_id', filters.zoneId)
      if (filters.priceRange) query = query.eq('price_range', filters.priceRange)

      const { data, error } = await query
      if (error) throw error
      // Cast needed: Supabase's type inference returns `never` for nested selects
      // when using hand-written types without Relationships metadata.
      return (data ?? []) as unknown as Place[]
    },
    getNextPageParam: (lastPage, allPages) => {
      // If we got a full page, there might be more
      if (lastPage.length === PAGE_SIZE) {
        return allPages.length * PAGE_SIZE
      }
      return undefined // No more pages
    },
  })
}

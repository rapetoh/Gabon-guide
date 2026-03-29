import { useQuery } from '@tanstack/react-query'

import type { Database } from '../lib/database.types'
import { supabase } from '../lib/supabase'

type PlaceRow = Database['public']['Tables']['places']['Row']

// Expanded place type — includes joined relations returned by the select query.
export interface PlaceDetail extends PlaceRow {
  categories: { id: string; name_fr: string; name_en: string; slug: string } | null
  zones: { id: string; name: string } | null
  subcategories: { id: string; name_fr: string; name_en: string } | null
  photos: { id: string; storage_path: string; is_primary: boolean; position: number; is_deleted: boolean; is_menu: boolean }[]
}

// Fetches a single place with all related data for the detail page.
export function usePlace(id: string) {
  return useQuery({
    queryKey: ['place', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('places')
        .select(`
          *,
          categories ( id, name_fr, name_en, slug ),
          zones ( id, name ),
          subcategories ( id, name_fr, name_en ),
          photos ( id, storage_path, is_primary, position, is_deleted, is_menu )
        `)
        .eq('id', id)
        .eq('is_deleted', false)
        .single()
      if (error) throw error
      // Cast needed: Supabase returns `never` for nested selects with hand-written types
      return data as unknown as PlaceDetail
    },
    enabled: !!id,
  })
}

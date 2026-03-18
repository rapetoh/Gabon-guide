import { useQuery } from '@tanstack/react-query'

import type { Database } from '../lib/database.types'
import { supabase } from '../lib/supabase'

export type Subcategory = Database['public']['Tables']['subcategories']['Row']

// Fetches subcategories for a specific category.
// Used to populate the cuisine/type filter chips (e.g., Local, French, Asian for Dining).
export function useSubcategories(categoryId: string | null) {
  return useQuery({
    queryKey: ['subcategories', categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subcategories')
        .select('*')
        .eq('category_id', categoryId!)
        .order('name_fr')
      if (error) throw error
      return data as Subcategory[]
    },
    enabled: !!categoryId, // Only run when a category is selected
    staleTime: Infinity,
  })
}

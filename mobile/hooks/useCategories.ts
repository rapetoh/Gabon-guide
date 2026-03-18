import { useQuery } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

export type Category = Database['public']['Tables']['categories']['Row']

// Fetches all categories (Restaurant, Bar, Cafés, Activities).
// Categories are stable data — cached for the lifetime of the app session.
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name_fr')
      if (error) throw error
      return data as Category[]
    },
    staleTime: Infinity, // Categories never change during a session
  })
}

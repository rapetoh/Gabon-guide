import { useQuery } from '@tanstack/react-query'

import type { Database } from '../lib/database.types'
import { supabase } from '../lib/supabase'

export type Zone = Database['public']['Tables']['zones']['Row']

// Fetches all Libreville zones/neighborhoods.
// Used for the zone filter chips on the Explore screen.
export function useZones() {
  return useQuery({
    queryKey: ['zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zones')
        .select('*')
        .order('name')
      if (error) throw error
      return data as Zone[]
    },
    staleTime: Infinity, // Zones are stable reference data
  })
}

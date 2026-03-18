import { useQuery } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'

// Returns this week's curated feed entries.
// Falls back to the 10 most recently added places if no feed exists for the current week.
// This ensures the home screen is never empty.
export function useWeeklyFeed() {
  return useQuery({
    queryKey: ['weeklyFeed'],
    queryFn: async () => {
      // Get Monday of the current week (Libreville time UTC+1)
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Libreville' }))
      const day = now.getDay()
      const monday = new Date(now)
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
      const weekOf = monday.toISOString().split('T')[0]

      const { data: feedData, error } = await supabase
        .from('weekly_feed')
        .select(`
          id, rank, label_fr, label_en,
          places (
            *,
            categories ( id, name_fr, name_en ),
            zones ( id, name ),
            photos ( id, storage_path, is_primary, position )
          )
        `)
        .eq('week_of', weekOf)
        .order('rank')

      if (error) throw error

      // If there's a curated feed this week, return it
      if (feedData && feedData.length > 0) {
        return { type: 'curated' as const, entries: feedData }
      }

      // Fallback: return the 10 most recent active places
      const { data: recentData, error: recentError } = await supabase
        .from('places')
        .select(`
          *,
          categories ( id, name_fr, name_en ),
          zones ( id, name ),
          photos ( id, storage_path, is_primary, position )
        `)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(10)

      if (recentError) throw recentError

      return { type: 'fallback' as const, entries: recentData ?? [] }
    },
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

// Manages the current user's saved/favorite places.
export function useFavorites() {
  const { session } = useSession()
  const queryClient = useQueryClient()

  // Fetch all favorite place IDs for the current user
  const { data: favoriteIds = [] } = useQuery({
    queryKey: ['favorites', session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('favorites')
        .select('place_id')
        .eq('user_id', session!.user.id)
      if (error) throw error
      return data.map((f) => f.place_id)
    },
    enabled: !!session,
  })

  const isFavorite = (placeId: string) => favoriteIds.includes(placeId)

  // Toggle: add if not saved, remove if already saved
  const toggleFavorite = useMutation({
    mutationFn: async (placeId: string) => {
      if (!session) throw new Error('Not logged in')

      if (isFavorite(placeId)) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', session.user.id)
          .eq('place_id', placeId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({ user_id: session.user.id, place_id: placeId })
        if (error) throw error
      }
    },
    onSuccess: () => {
      // Refresh favorites list after toggle
      queryClient.invalidateQueries({ queryKey: ['favorites', session?.user.id] })
    },
  })

  return { favoriteIds, isFavorite, toggleFavorite }
}

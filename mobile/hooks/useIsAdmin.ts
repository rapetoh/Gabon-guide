import { useQuery } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

interface UseIsAdminResult {
  isAdmin: boolean
  loading: boolean
}

// Queries the profiles table to check if the current user is an admin.
// Returns false immediately if the user is not logged in.
export function useIsAdmin(): UseIsAdminResult {
  const { session } = useSession()

  const { data, isLoading } = useQuery({
    queryKey: ['isAdmin', session?.user.id],
    queryFn: async () => {
      if (!session) return false
      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single()
      return data?.is_admin ?? false
    },
    enabled: !!session, // Only run this query when the user is logged in
  })

  return {
    isAdmin: data ?? false,
    loading: isLoading,
  }
}

import { useQuery } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

interface UseIsAdminResult {
  isAdmin: boolean
  role: 'user' | 'restaurant_owner' | 'admin' | null
  loading: boolean
}

// Queries the profiles table to check if the current user is an admin.
// Also exposes the user's role for restaurant owner gating.
// Returns false/null immediately if the user is not logged in.
export function useIsAdmin(): UseIsAdminResult {
  const { session } = useSession()

  const { data, isLoading } = useQuery({
    queryKey: ['isAdmin', session?.user.id],
    queryFn: async () => {
      if (!session) return null
      const { data } = await supabase
        .from('profiles')
        .select('is_admin, role')
        .eq('id', session.user.id)
        .single()
      return data ?? null
    },
    enabled: !!session,
  })

  return {
    isAdmin: data?.is_admin ?? false,
    role: (data?.role as 'user' | 'restaurant_owner' | 'admin' | null) ?? null,
    loading: isLoading,
  }
}

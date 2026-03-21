import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

export function useProfile() {
  const { session } = useSession()

  const { data } = useQuery({
    queryKey: ['profile', session?.user.id],
    queryFn: async () => {
      if (!session) return null
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', session.user.id)
        .single()
      return data
    },
    enabled: !!session,
  })

  // Name resolution: DB full_name → Google/Apple metadata → email prefix
  const displayName = (() => {
    if (data?.full_name) return data.full_name
    const meta = session?.user.user_metadata
    if (meta?.full_name) return meta.full_name
    if (meta?.name) return meta.name
    const email = session?.user.email ?? ''
    return email.split('@')[0] ?? 'User'
  })()

  return {
    displayName,
    avatarUrl: data?.avatar_url ?? session?.user.user_metadata?.avatar_url ?? null,
  }
}

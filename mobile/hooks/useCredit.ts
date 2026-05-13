import { useQuery } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

export interface CreditBalance {
  balance_fcfa: number
  lifetime_earned: number
  updated_at: string
}

export interface CreditTransaction {
  id: string
  delta_fcfa: number
  reason: 'referral_signup' | 'referral_invite' | 'redemption_session' | 'admin_adjust'
  ref_id: string | null
  created_at: string
}

// Per-user credit balance. The handle_new_user trigger seeds a 0-row for
// every signup, so this should always return a row for an authenticated user.
export function useCreditBalance() {
  const { session } = useSession()
  return useQuery({
    queryKey: ['credit-balance', session?.user.id],
    queryFn: async (): Promise<CreditBalance | null> => {
      if (!session) return null
      const { data, error } = await supabase
        .from('credit_balances')
        .select('balance_fcfa, lifetime_earned, updated_at')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (error) throw error
      return (data as CreditBalance | null) ?? { balance_fcfa: 0, lifetime_earned: 0, updated_at: '' }
    },
    enabled: !!session,
    staleTime: 5_000,
  })
}

// Append-only log of earnings + spends. Used on a "credit history" view —
// not surfaced in the main profile, but available for transparency.
export function useCreditTransactions(limit = 20) {
  const { session } = useSession()
  return useQuery({
    queryKey: ['credit-transactions', session?.user.id, limit],
    queryFn: async (): Promise<CreditTransaction[]> => {
      if (!session) return []
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('id, delta_fcfa, reason, ref_id, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as CreditTransaction[]
    },
    enabled: !!session,
  })
}

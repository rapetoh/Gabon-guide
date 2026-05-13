import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

export interface ReferralSettings {
  id: number
  reward_type: 'welcome_credit' | 'coupon' | 'points' | 'none'
  referrer_reward_value: number
  referee_reward_value: number
  reward_coupon_id: string | null
  reward_credit_fcfa: number | null
  is_active: boolean
  updated_at: string
}

// Single-row settings table (id = 1). Admin reads/writes this.
export function useReferralSettings() {
  return useQuery({
    queryKey: ['referral-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referral_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle()
      if (error) throw error
      return (data as ReferralSettings | null) ?? null
    },
  })
}

export function useUpdateReferralSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<Omit<ReferralSettings, 'id' | 'updated_at'>>) => {
      const { error } = await supabase
        .from('referral_settings')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referral-settings'] })
    },
  })
}

// Current user's referral code + count of people they've referred so far.
export function useMyReferral() {
  const { session } = useSession()
  return useQuery({
    queryKey: ['my-referral', session?.user.id],
    queryFn: async () => {
      if (!session) return null

      const [{ data: me, error: meErr }, { count, error: countErr }] = await Promise.all([
        supabase
          .from('profiles')
          .select('referral_code, referred_by')
          .eq('id', session.user.id)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('referred_by', session.user.id),
      ])

      if (meErr) throw meErr
      if (countErr) throw countErr

      return {
        code: (me?.referral_code ?? null) as string | null,
        referredBy: (me?.referred_by ?? null) as string | null,
        invitedCount: count ?? 0,
      }
    },
    enabled: !!session,
  })
}

// Light-weight validity check used by the signup form before submission.
// Returns true if the code matches an existing profile, false otherwise.
// We can't call this *after* signUp without auth, so we check before.
export async function checkReferralCodeExists(code: string): Promise<boolean> {
  const trimmed = code.trim().toUpperCase()
  if (!trimmed) return false
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('referral_code', trimmed)
    .maybeSingle()
  if (error) return false
  return !!data
}

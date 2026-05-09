import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import type { SubscriptionTier } from '../lib/database.types'

export type TierLimitsMap = Record<SubscriptionTier, { maxPhotos: number }>

const DEFAULTS: TierLimitsMap = {
  free:     { maxPhotos: 5 },
  standard: { maxPhotos: 9999 },
  premium:  { maxPhotos: 9999 },
}

const QUERY_KEY = ['tierLimits'] as const

export function useTierLimits() {
  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<TierLimitsMap> => {
      const { data, error } = await supabase
        .from('tier_limits')
        .select('tier, max_photos')
      if (error) throw error
      const map: TierLimitsMap = { ...DEFAULTS }
      for (const row of data ?? []) {
        if (row.tier === 'free' || row.tier === 'standard' || row.tier === 'premium') {
          map[row.tier] = { maxPhotos: row.max_photos }
        }
      }
      return map
    },
    staleTime: 60_000,
  })

  return {
    limits: data ?? DEFAULTS,
    loading: isLoading,
    error: isError,
  }
}

export function useUpdateTierLimit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { tier: SubscriptionTier; maxPhotos: number }) => {
      const { error } = await supabase
        .from('tier_limits')
        .upsert({ tier: args.tier, max_photos: args.maxPhotos }, { onConflict: 'tier' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

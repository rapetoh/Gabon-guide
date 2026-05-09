import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import { FEATURE_KEYS, FeatureKey } from '../lib/feature-keys'
import type { SubscriptionTier } from '../lib/database.types'

export type TierFeatureMatrix = Record<FeatureKey, Record<SubscriptionTier, boolean>>

interface TierFeatureRow {
  feature_key: string
  tier: SubscriptionTier
  enabled: boolean
}

const QUERY_KEY = ['tierFeatures'] as const

function emptyMatrix(): TierFeatureMatrix {
  const m = {} as TierFeatureMatrix
  for (const key of FEATURE_KEYS) {
    m[key] = { free: false, standard: false, premium: false }
  }
  return m
}

// Fetches the tier_features table and returns it as a typed matrix:
//   matrix.video.premium === true
// Unknown feature_keys (e.g. legacy rows) are ignored.
export function useTierFeatures() {
  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<TierFeatureMatrix> => {
      const { data, error } = await supabase
        .from('tier_features')
        .select('feature_key, tier, enabled')
      if (error) throw error
      const matrix = emptyMatrix()
      for (const row of (data ?? []) as TierFeatureRow[]) {
        if ((FEATURE_KEYS as readonly string[]).includes(row.feature_key)) {
          matrix[row.feature_key as FeatureKey][row.tier] = row.enabled
        }
      }
      return matrix
    },
    staleTime: 60_000,
  })

  return {
    matrix: data ?? emptyMatrix(),
    loading: isLoading,
    error: isError,
  }
}

// Admin-only: toggle a single (feature, tier) cell.
export function useUpdateTierFeature() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { featureKey: FeatureKey; tier: SubscriptionTier; enabled: boolean }) => {
      const { error } = await supabase
        .from('tier_features')
        .upsert(
          { feature_key: args.featureKey, tier: args.tier, enabled: args.enabled, updated_at: new Date().toISOString() },
          { onConflict: 'feature_key,tier' }
        )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

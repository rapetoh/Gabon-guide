import { useMemo } from 'react'

import type { Database, SubscriptionTier } from '../lib/database.types'
import { FeatureKey } from '../lib/feature-keys'
import { useTierFeatures } from './useTierFeatures'
import { useTierLimits } from './useTierLimits'

type PlaceLike =
  | Pick<Database['public']['Tables']['places']['Row'], 'subscription_tier' | 'subscription_expires_at'>
  | null
  | undefined

export interface PlaceTier {
  tier: SubscriptionTier
  expiresAt: string | null
  isExpired: boolean
  isVerified: boolean
  photoLimit: number
  loading: boolean
  /** Returns true when the given feature is enabled for this place's tier. */
  can: (feature: FeatureKey) => boolean
}

// Resolves a place's effective tier and what it can do.
// Reads tier_features + tier_limits from the DB (cached) so admin toggles
// take effect across the app without a code deploy.
export function usePlaceTier(place: PlaceLike): PlaceTier {
  const { matrix, loading: featLoading } = useTierFeatures()
  const { limits, loading: limLoading } = useTierLimits()

  return useMemo<PlaceTier>(() => {
    const tier = (place?.subscription_tier ?? 'free') as SubscriptionTier
    const expiresAt = place?.subscription_expires_at ?? null
    const isExpired = expiresAt !== null && new Date(expiresAt).getTime() < Date.now()
    return {
      tier,
      expiresAt,
      isExpired,
      isVerified: matrix.verified_badge[tier],
      photoLimit: limits[tier].maxPhotos,
      loading: featLoading || limLoading,
      can: (feature) => matrix[feature][tier],
    }
  }, [place, matrix, limits, featLoading, limLoading])
}

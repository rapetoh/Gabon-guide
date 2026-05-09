import { createClient } from '../../../lib/supabase-server'
import { FEATURE_KEYS, FeatureKey, FEATURE_LABELS } from '../../../lib/feature-keys'
import type { SubscriptionTier } from '../../../lib/database.types'
import TierSettingsClient, { type TierFeatureMatrix, type TierLimitsMap } from './TierSettingsClient'

export const dynamic = 'force-dynamic'

const EMPTY_MATRIX: TierFeatureMatrix = FEATURE_KEYS.reduce((acc, key) => {
  acc[key] = { free: false, standard: false, premium: false }
  return acc
}, {} as TierFeatureMatrix)

const DEFAULT_LIMITS: TierLimitsMap = {
  free: 5,
  standard: 9999,
  premium: 9999,
}

export default async function TierSettingsPage() {
  const supabase = await createClient()

  const [{ data: featureRows }, { data: limitRows }] = await Promise.all([
    supabase.from('tier_features').select('feature_key, tier, enabled'),
    supabase.from('tier_limits').select('tier, max_photos'),
  ])

  const matrix: TierFeatureMatrix = JSON.parse(JSON.stringify(EMPTY_MATRIX))
  for (const row of (featureRows ?? [])) {
    if ((FEATURE_KEYS as readonly string[]).includes(row.feature_key)) {
      matrix[row.feature_key as FeatureKey][row.tier as SubscriptionTier] = row.enabled
    }
  }

  const limits: TierLimitsMap = { ...DEFAULT_LIMITS }
  for (const row of (limitRows ?? [])) {
    if (row.tier === 'free' || row.tier === 'standard' || row.tier === 'premium') {
      limits[row.tier] = row.max_photos
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tier settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          What each subscription tier includes. Changes take effect immediately across mobile + web.
        </p>
      </div>

      <TierSettingsClient
        initialMatrix={matrix}
        initialLimits={limits}
        labels={FEATURE_LABELS}
      />
    </div>
  )
}

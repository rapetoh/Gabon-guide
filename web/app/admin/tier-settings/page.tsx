import { createClient } from '../../../lib/supabase-server'
import { FEATURE_KEYS, FeatureKey, FEATURE_LABELS } from '../../../lib/feature-keys'
import type { SubscriptionTier } from '../../../lib/database.types'
import Topbar from '../../../components/admin/Topbar'
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
      <Topbar
        title="Tier settings"
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Tier settings' }]}
      />
      <div className="p-8">
        <p className="text-sm text-gray-500 mb-5 max-w-2xl">
          What each subscription tier includes. Changes take effect immediately across mobile + web.
        </p>
        <TierSettingsClient
          initialMatrix={matrix}
          initialLimits={limits}
          labels={FEATURE_LABELS}
        />
      </div>
    </div>
  )
}

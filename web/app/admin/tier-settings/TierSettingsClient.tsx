'use client'

import { useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { FEATURE_KEYS, FeatureKey } from '../../../lib/feature-keys'
import type { SubscriptionTier } from '../../../lib/database.types'

export type TierFeatureMatrix = Record<FeatureKey, Record<SubscriptionTier, boolean>>
export type TierLimitsMap = Record<SubscriptionTier, number>

const TIERS: SubscriptionTier[] = ['free', 'standard', 'premium']
const TIER_LABEL: Record<SubscriptionTier, string> = {
  free: 'Free',
  standard: 'Standard',
  premium: 'Premium',
}

interface Props {
  initialMatrix: TierFeatureMatrix
  initialLimits: TierLimitsMap
  labels: Record<FeatureKey, { fr: string; en: string }>
}

export default function TierSettingsClient({ initialMatrix, initialLimits, labels }: Props) {
  const supabase = createClient()
  const [matrix, setMatrix] = useState<TierFeatureMatrix>(initialMatrix)
  const [limits, setLimits] = useState<TierLimitsMap>(initialLimits)
  const [savingCell, setSavingCell] = useState<string | null>(null)
  const [savingLimit, setSavingLimit] = useState<SubscriptionTier | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const toggleCell = async (feature: FeatureKey, tier: SubscriptionTier) => {
    const cellKey = `${feature}.${tier}`
    setSavingCell(cellKey)
    setErrorMsg(null)
    const next = !matrix[feature][tier]

    setMatrix(prev => ({
      ...prev,
      [feature]: { ...prev[feature], [tier]: next },
    }))

    const { error } = await supabase
      .from('tier_features')
      .upsert(
        { feature_key: feature, tier, enabled: next, updated_at: new Date().toISOString() },
        { onConflict: 'feature_key,tier' }
      )

    if (error) {
      setMatrix(prev => ({
        ...prev,
        [feature]: { ...prev[feature], [tier]: !next },
      }))
      setErrorMsg(error.message)
    }
    setSavingCell(null)
  }

  const saveLimit = async (tier: SubscriptionTier, value: number) => {
    if (Number.isNaN(value) || value < 0) return
    setSavingLimit(tier)
    setErrorMsg(null)
    const prev = limits[tier]
    setLimits(p => ({ ...p, [tier]: value }))

    const { error } = await supabase
      .from('tier_limits')
      .upsert({ tier, max_photos: value }, { onConflict: 'tier' })

    if (error) {
      setLimits(p => ({ ...p, [tier]: prev }))
      setErrorMsg(error.message)
    }
    setSavingLimit(null)
  }

  return (
    <div className="space-y-8">
      {errorMsg && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-4 py-3">
          {errorMsg}
        </div>
      )}

      {/* Feature matrix */}
      <section className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Features per tier</h2>
          <p className="text-xs text-gray-500 mt-0.5">Click any cell to toggle.</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Feature</th>
              {TIERS.map(t => (
                <th key={t} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32 text-center">
                  {TIER_LABEL[t]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {FEATURE_KEYS.map(feature => (
              <tr key={feature} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <div className="font-medium text-gray-900">{labels[feature].fr}</div>
                  <div className="text-xs text-gray-400">{labels[feature].en} <span className="text-gray-300">· {feature}</span></div>
                </td>
                {TIERS.map(tier => {
                  const cellKey = `${feature}.${tier}`
                  const isOn = matrix[feature][tier]
                  const saving = savingCell === cellKey
                  return (
                    <td key={tier} className="px-5 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleCell(feature, tier)}
                        disabled={saving}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
                          isOn
                            ? 'bg-orange-500 hover:bg-orange-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-400'
                        } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                        aria-label={`${labels[feature].en} for ${TIER_LABEL[tier]}: ${isOn ? 'enabled' : 'disabled'}`}
                      >
                        {isOn ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="block w-2 h-2 rounded-full bg-gray-300" />
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Photo limits */}
      <section className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Photo limits per tier</h2>
          <p className="text-xs text-gray-500 mt-0.5">Use 9999 for &quot;unlimited&quot;.</p>
        </div>
        <div className="px-5 py-4 grid grid-cols-3 gap-4">
          {TIERS.map(tier => (
            <div key={tier}>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{TIER_LABEL[tier]}</label>
              <input
                type="number"
                min={0}
                value={limits[tier]}
                disabled={savingLimit === tier}
                onChange={e => setLimits(p => ({ ...p, [tier]: Number(e.target.value) }))}
                onBlur={e => {
                  const v = Number(e.target.value)
                  if (v !== initialLimits[tier]) saveLimit(tier, v)
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

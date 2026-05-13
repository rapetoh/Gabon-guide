'use client'

import { useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'

export type RewardType = 'welcome_credit' | 'coupon' | 'points' | 'none'

export interface ReferralSettings {
  id: number
  reward_type: RewardType
  referrer_reward_value: number
  referee_reward_value: number
  reward_coupon_id: string | null
  reward_credit_fcfa: number | null
  is_active: boolean
  updated_at: string
}

export interface CouponOption {
  id: string
  title: string
  placeName: string
  expiresAt: string
}

interface Props {
  initialSettings: ReferralSettings
  coupons: CouponOption[]
}

export default function ReferralsClient({ initialSettings, coupons }: Props) {
  const supabase = createClient()
  const [settings, setSettings] = useState<ReferralSettings>(initialSettings)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function save(patch: Partial<ReferralSettings>) {
    setSaving(true)
    setErrorMsg(null)
    const previous = settings
    const next: ReferralSettings = { ...settings, ...patch, updated_at: new Date().toISOString() }
    setSettings(next)

    const { error } = await supabase
      .from('referral_settings')
      .update({
        reward_type: next.reward_type,
        referrer_reward_value: next.referrer_reward_value,
        referee_reward_value: next.referee_reward_value,
        reward_coupon_id: next.reward_coupon_id,
        reward_credit_fcfa: next.reward_credit_fcfa,
        is_active: next.is_active,
        updated_at: next.updated_at,
      })
      .eq('id', 1)

    if (error) {
      setSettings(previous)
      setErrorMsg(error.message)
    } else {
      setSavedAt(Date.now())
    }
    setSaving(false)
  }

  const isCouponReward = settings.reward_type === 'coupon'
  const isCreditReward = settings.reward_type === 'welcome_credit'
  const [creditDraft, setCreditDraft] = useState<string>(
    settings.reward_credit_fcfa != null ? String(settings.reward_credit_fcfa) : '1000',
  )

  return (
    <div className="space-y-5">
      {/* Active toggle */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center justify-between">
        <div>
          <div className="font-semibold text-gray-900">Referral program active</div>
          <div className="text-xs text-gray-500 mt-0.5">
            When off, new signups with a referral code still record the link but no reward is issued.
          </div>
        </div>
        <button
          onClick={() => save({ is_active: !settings.is_active })}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.is_active ? 'bg-orange-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              settings.is_active ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Reward type */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <div>
          <div className="font-semibold text-gray-900">Reward type</div>
          <div className="text-xs text-gray-500 mt-0.5">
            What both the referrer and the new user receive when a code links them.
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['welcome_credit', 'coupon', 'none'] as RewardType[]).map(t => (
            <button
              key={t}
              onClick={() => save({
                reward_type: t,
                reward_coupon_id: t === 'coupon' ? settings.reward_coupon_id : null,
                reward_credit_fcfa: t === 'welcome_credit'
                  ? (settings.reward_credit_fcfa ?? 1000)
                  : null,
              })}
              disabled={saving}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                settings.reward_type === t
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {t === 'welcome_credit' ? 'Welcome credit (FCFA)' : t === 'coupon' ? 'Coupon at a place' : 'No reward (track only)'}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400">
          <span className="font-semibold">Welcome credit</span> (recommended) gives both users FCFA credit spendable at any restaurant.
          <span className="font-semibold"> Coupon</span> issues a specific place's coupon to both — useful if you have a partner promo.
          Points-based rewards are post-MVP.
        </p>
      </div>

      {/* Credit amount */}
      {isCreditReward && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
          <div>
            <div className="font-semibold text-gray-900">Credit amount per side (FCFA)</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Both the referrer and the new user receive this amount on signup. They can spend it at any restaurant, applied during owner checkout.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={100}
              step={100}
              value={creditDraft}
              onChange={(e) => setCreditDraft(e.target.value.replace(/[^0-9]/g, ''))}
              onBlur={() => {
                const n = parseInt(creditDraft, 10)
                if (Number.isFinite(n) && n > 0 && n !== settings.reward_credit_fcfa) {
                  void save({ reward_credit_fcfa: n })
                } else if (!Number.isFinite(n) || n <= 0) {
                  setCreditDraft(String(settings.reward_credit_fcfa ?? 1000))
                }
              }}
              disabled={saving}
              className="w-40 bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none"
            />
            <span className="text-sm text-gray-500 font-medium">FCFA</span>
          </div>
          <p className="text-[11px] text-gray-400">
            Tip: a number that buys something concrete (e.g. 1 000 = a coffee, 5 000 = a meal) converts better than a small token amount.
          </p>
        </div>
      )}

      {/* Coupon picker */}
      {isCouponReward && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
          <div>
            <div className="font-semibold text-gray-900">Reward coupon</div>
            <div className="text-xs text-gray-500 mt-0.5">
              When a new user signs up with a valid referral code, we issue this coupon to both the referrer and the new user.
              Both can redeem it once. Only currently-active coupons are listed.
            </div>
          </div>
          {coupons.length === 0 ? (
            <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
              No active coupons in the system. Create one from <span className="font-semibold">Coupons</span> first.
            </div>
          ) : (
            <select
              value={settings.reward_coupon_id ?? ''}
              onChange={(e) => save({ reward_coupon_id: e.target.value || null })}
              disabled={saving}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none"
            >
              <option value="">— Select a coupon —</option>
              {coupons.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title} · {c.placeName} (until {new Date(c.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Save indicator */}
      <div className="h-5 flex items-center text-xs">
        {errorMsg && <span className="text-red-600">{errorMsg}</span>}
        {!errorMsg && saving && <span className="text-gray-400">Saving…</span>}
        {!errorMsg && !saving && savedAt && Date.now() - savedAt < 3000 && (
          <span className="text-green-600">Saved</span>
        )}
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase-browser'

const DAY_MS = 24 * 60 * 60 * 1000

export type SubscriptionRow = {
  id: string
  name: string
  subscription_tier: string
  subscription_expires_at: string
}

/**
 * "Abonnements" panel: places whose paid subscription is expired or expires
 * within 7 days. Admins confirm an offline payment with +30/+90 jours, which
 * pushes subscription_expires_at forward from max(now, current expiry).
 * Admin RLS allows places updates.
 */
export default function SubscriptionsPanel({ places }: { places: SubscriptionRow[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  // id → new expiry ISO string, so the row shows its new date until refresh removes it
  const [renewed, setRenewed] = useState<Record<string, string>>({})

  async function renew(place: SubscriptionRow, days: 30 | 90) {
    const ok = window.confirm(`Confirmer le paiement de ${place.name} — prolonger de ${days} jours ?`)
    if (!ok) return
    const now = Date.now()
    const current = new Date(place.subscription_expires_at).getTime()
    const base = Math.max(now, current)
    const newExpiry = new Date(base + days * DAY_MS).toISOString()

    setBusyId(place.id)
    const { error } = await supabase
      .from('places')
      .update({ subscription_expires_at: newExpiry })
      .eq('id', place.id)
    setBusyId(null)
    if (error) {
      alert(error.message)
      return
    }
    setRenewed(prev => ({ ...prev, [place.id]: newExpiry }))
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900">Abonnements</h2>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Les alertes quotidiennes s&apos;arrêtent automatiquement après renouvellement.
        </p>
      </div>
      {places.length === 0 ? (
        <p className="px-5 py-4 text-sm text-green-600">Tous les abonnements sont à jour ✓</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-5 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Place</th>
              <th className="text-left px-5 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Tier</th>
              <th className="text-left px-5 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Échéance</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {places.map(place => {
              const newExpiry = renewed[place.id]
              return (
                <tr key={place.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/places/${place.id}`}
                      className="font-semibold text-gray-900 hover:text-orange-600 transition-colors"
                    >
                      {place.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <TierPill tier={place.subscription_tier} />
                  </td>
                  <td className="px-5 py-3">
                    {newExpiry ? (
                      <span className="text-xs font-semibold text-green-600">
                        Renouvelé jusqu&apos;au {formatDate(newExpiry)}
                      </span>
                    ) : (
                      <ExpiryStatus expiresAt={place.subscription_expires_at} />
                    )}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {!newExpiry && (
                      <div className="inline-flex items-center gap-2">
                        <RenewButton
                          label="+30 jours"
                          disabled={busyId === place.id}
                          onClick={() => renew(place, 30)}
                        />
                        <RenewButton
                          label="+90 jours"
                          disabled={busyId === place.id}
                          onClick={() => renew(place, 90)}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function RenewButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-7 px-2.5 text-xs font-semibold rounded-lg border border-orange-200 text-orange-600 hover:bg-orange-50 transition-colors disabled:opacity-40"
    >
      {disabled ? '…' : label}
    </button>
  )
}

function ExpiryStatus({ expiresAt }: { expiresAt: string }) {
  const diffMs = new Date(expiresAt).getTime() - Date.now()
  if (diffMs < 0) {
    const days = Math.floor(-diffMs / DAY_MS)
    return (
      <span className="text-xs font-semibold text-red-600">
        {days === 0 ? 'Expiré aujourd’hui' : `Expiré depuis ${days} jour${days > 1 ? 's' : ''}`}
      </span>
    )
  }
  const days = Math.floor(diffMs / DAY_MS)
  return (
    <span className="text-xs font-semibold text-orange-500">
      {days === 0 ? 'Expire aujourd’hui' : `Expire dans ${days} jour${days > 1 ? 's' : ''}`}
    </span>
  )
}

function TierPill({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    free: 'bg-gray-100 text-gray-600',
    standard: 'bg-orange-50 text-orange-600 border border-orange-100',
    premium: 'bg-orange-500 text-white',
  }
  const label = tier.charAt(0).toUpperCase() + tier.slice(1)
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${styles[tier] ?? styles.free}`}>
      {label}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

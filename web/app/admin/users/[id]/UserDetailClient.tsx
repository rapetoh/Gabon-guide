'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase-browser'

export interface UserDetail {
  id: string
  full_name: string | null
  avatar_url: string | null
  email: string | null
  role: 'user' | 'restaurant_owner' | 'admin'
  is_admin: boolean
  is_blocked: boolean
  referral_code: string | null
  created_at: string
}

export interface PlaceOption {
  id: string
  name: string
  owner_id: string | null
}

interface Stats {
  reviews: number
  redemptions: number
  balanceFcfa: number
  lifetimeEarned: number
}

type Role = UserDetail['role']

const ROLES: { value: Role; label: string; desc: string }[] = [
  {
    value: 'user',
    label: 'Utilisateur',
    desc: 'Compte standard — peut sauvegarder des lieux et laisser des avis.',
  },
  {
    value: 'restaurant_owner',
    label: 'Propriétaire',
    desc: 'Peut modifier les infos, photos et coupons de son propre restaurant.',
  },
  {
    value: 'admin',
    label: 'Administrateur',
    desc: 'Accès complet à toutes les fonctions d’administration.',
  },
]

function fmtFcfa(n: number): string {
  return `${n.toLocaleString('fr-FR')} FCFA`
}

export default function UserDetailClient({
  user, ownedPlace, places, stats,
}: {
  user: UserDetail
  ownedPlace: { id: string; name: string } | null
  places: PlaceOption[]
  stats: Stats
}) {
  const supabase = createClient()
  const router = useRouter()

  const [role, setRole] = useState<Role>(user.role)
  const [placeId, setPlaceId] = useState<string>(ownedPlace?.id ?? '')
  const [blocked, setBlocked] = useState<boolean>(user.is_blocked)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const dirty =
    role !== user.role ||
    blocked !== user.is_blocked ||
    (role === 'restaurant_owner' && placeId !== (ownedPlace?.id ?? ''))

  async function handleSave() {
    if (role === 'restaurant_owner' && !placeId) {
      setMessage({ kind: 'error', text: 'Sélectionnez un restaurant à associer à ce propriétaire.' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      // 1. Role + admin flag + blocked flag on the profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role,
          is_admin: role === 'admin',
          is_blocked: blocked,
        })
        .eq('id', user.id)
      if (profileError) throw profileError

      // 2. Leaving the owner role → unlink their place
      if (user.role === 'restaurant_owner' && role !== 'restaurant_owner' && ownedPlace) {
        const { error } = await supabase
          .from('places')
          .update({ owner_id: null })
          .eq('id', ownedPlace.id)
        if (error) throw error
      }

      // 3. Owner role → clear any previous link, then set the chosen place
      if (role === 'restaurant_owner' && placeId) {
        const { error: clearErr } = await supabase
          .from('places')
          .update({ owner_id: null })
          .eq('owner_id', user.id)
        if (clearErr) throw clearErr
        const { error: setErr } = await supabase
          .from('places')
          .update({ owner_id: user.id })
          .eq('id', placeId)
        if (setErr) throw setErr
      }

      setMessage({ kind: 'ok', text: 'Enregistré ✓' })
      router.refresh()
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Échec de l’enregistrement.'
      setMessage({ kind: 'error', text })
    } finally {
      setSaving(false)
    }
  }

  const displayName = user.full_name?.trim() || 'Sans nom'

  return (
    <div className="space-y-6">
      {/* Identity card */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xl font-bold flex-shrink-0 overflow-hidden">
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <div className="font-bold text-gray-900">{displayName}</div>
          <div className="text-sm text-gray-500">{user.email ?? '—'}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            Inscrit le {new Date(user.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            {user.referral_code ? ` · Code parrainage : ${user.referral_code}` : ''}
          </div>
        </div>
        {blocked && (
          <span className="ml-auto rounded-full px-3 py-1 text-xs font-bold bg-red-100 text-red-600 flex-shrink-0">
            Bloqué
          </span>
        )}
      </div>

      {/* Activity stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Avis laissés', value: String(stats.reviews) },
          { label: 'Coupons utilisés', value: String(stats.redemptions) },
          { label: 'Crédit actuel', value: fmtFcfa(stats.balanceFcfa) },
          { label: 'Crédit gagné (total)', value: fmtFcfa(stats.lifetimeEarned) },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="text-lg font-bold text-gray-900">{s.value}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Role editor */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Rôle</div>
        {ROLES.map(r => (
          <label
            key={r.value}
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
              role === r.value ? 'border-orange-400 bg-orange-50/50' : 'border-gray-150 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="role"
              checked={role === r.value}
              onChange={() => setRole(r.value)}
              className="mt-1 accent-orange-500"
            />
            <span>
              <span className="block text-sm font-semibold text-gray-900">{r.label}</span>
              <span className="block text-xs text-gray-500 mt-0.5">{r.desc}</span>
            </span>
          </label>
        ))}

        {/* Place picker, only for owner role */}
        {role === 'restaurant_owner' && (
          <div className="pt-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Restaurant associé
            </div>
            <select
              value={placeId}
              onChange={e => setPlaceId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
            >
              <option value="">— Choisir un restaurant —</option>
              {places.map(p => {
                const ownedByOther = p.owner_id !== null && p.owner_id !== user.id
                return (
                  <option key={p.id} value={p.id}>
                    {p.name}{ownedByOther ? ' (déjà attribué)' : ''}
                  </option>
                )
              })}
            </select>
            <p className="text-xs text-gray-400 mt-1.5">
              Choisir un restaurant déjà attribué le réattribuera à cet utilisateur.
            </p>
          </div>
        )}
      </div>

      {/* Block toggle */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">Bloquer cet utilisateur</div>
          <p className="text-xs text-gray-500 mt-0.5 max-w-md">
            Un utilisateur bloqué peut toujours naviguer, mais ne peut plus laisser d&apos;avis,
            ajouter de favoris ni réclamer de coupons.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={blocked}
          onClick={() => setBlocked(b => !b)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
            blocked ? 'bg-red-500' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transform transition-transform ${
              blocked ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {message && (
          <span className={`text-sm font-medium ${message.kind === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  )
}

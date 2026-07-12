'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

export interface AdminUserRow {
  id: string
  full_name: string | null
  role: 'user' | 'restaurant_owner' | 'admin'
  is_admin: boolean
  is_blocked: boolean
  email: string | null
  joined_at: string
}

const ROLE_META: Record<AdminUserRow['role'], { label: string; classes: string }> = {
  admin:            { label: 'Admin', classes: 'bg-orange-500 text-white' },
  restaurant_owner: { label: 'Propriétaire', classes: 'bg-blue-500 text-white' },
  user:             { label: 'Utilisateur', classes: 'bg-gray-100 text-gray-500' },
}

const AVATAR_CLASSES: Record<AdminUserRow['role'], string> = {
  admin: 'bg-orange-500 text-white',
  restaurant_owner: 'bg-blue-500 text-white',
  user: 'bg-gray-200 text-gray-500',
}

function fmtJoined(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

type RoleFilter = 'all' | AdminUserRow['role'] | 'blocked'

export default function UsersClient({ users }: { users: AdminUserRow[] }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<RoleFilter>('all')

  const counts = useMemo(() => ({
    all: users.length,
    admin: users.filter(u => u.role === 'admin').length,
    restaurant_owner: users.filter(u => u.role === 'restaurant_owner').length,
    user: users.filter(u => u.role === 'user').length,
    blocked: users.filter(u => u.is_blocked).length,
  }), [users])

  const filtered = useMemo(() => {
    let list = users
    if (filter === 'blocked') list = list.filter(u => u.is_blocked)
    else if (filter !== 'all') list = list.filter(u => u.role === filter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(u =>
        (u.full_name ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [users, search, filter])

  const FILTERS: { key: RoleFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Tous', count: counts.all },
    { key: 'user', label: 'Utilisateurs', count: counts.user },
    { key: 'restaurant_owner', label: 'Propriétaires', count: counts.restaurant_owner },
    { key: 'admin', label: 'Admins', count: counts.admin },
    { key: 'blocked', label: 'Bloqués', count: counts.blocked },
  ]

  return (
    <div className="space-y-4">
      {/* Search + filter chips */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Nom ou email…"
          className="w-72 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === f.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {f.label} <span className="opacity-60">({f.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
              <th className="px-5 py-3 font-semibold">Utilisateur</th>
              <th className="px-5 py-3 font-semibold">Email</th>
              <th className="px-5 py-3 font-semibold">Inscrit</th>
              <th className="px-5 py-3 font-semibold">Rôle</th>
              <th className="px-5 py-3 font-semibold text-right">Statut</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-gray-400">
                  {search.trim() || filter !== 'all' ? 'Aucun résultat' : 'Aucun utilisateur'}
                </td>
              </tr>
            ) : (
              filtered.map(u => {
                const displayName = u.full_name?.trim() || 'Sans nom'
                const meta = ROLE_META[u.role] ?? ROLE_META.user
                return (
                  <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 group">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${AVATAR_CLASSES[u.role] ?? AVATAR_CLASSES.user}`}>
                          {displayName.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-semibold text-gray-900 group-hover:text-orange-600">
                          {displayName}
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{u.email ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtJoined(u.joined_at)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${meta.classes}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {u.is_blocked ? (
                        <span className="inline-block rounded-full px-2.5 py-1 text-[11px] font-bold bg-red-100 text-red-600">
                          Bloqué
                        </span>
                      ) : (
                        <span className="inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold bg-green-50 text-green-600">
                          Actif
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

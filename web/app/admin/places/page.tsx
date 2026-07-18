import Link from 'next/link'
import { createClient } from '../../../lib/supabase-server'
import Topbar from '../../../components/admin/Topbar'
import RestorePlaceButton from './RestorePlaceButton'

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; tier?: string }>
}) {
  const supabase = await createClient()
  const { q: rawQ, filter: rawFilter, tier: rawTier } = await searchParams
  const q = rawQ ?? ''
  const filter = rawFilter ?? 'all'
  const tier = rawTier ?? 'all'

  let query = supabase
    .from('places')
    .select('id, name, is_active, is_promoted, is_deleted, price_range, subscription_tier, created_at, categories(name_fr), zones(name), photos(storage_path, is_primary, is_deleted, is_menu)')
    .eq('is_deleted', filter === 'deleted')
    .order('name', { ascending: true })

  if (filter === 'active') query = query.eq('is_active', true)
  if (filter === 'inactive') query = query.eq('is_active', false)
  if (filter === 'promoted') query = query.eq('is_promoted', true)
  if (tier !== 'all') query = query.eq('subscription_tier', tier as 'free' | 'standard' | 'premium')

  const { data: places } = await query

  // Primary (or first) gallery photo per place → public thumbnail URL
  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/place-photos/`
  const thumbFor = (place: any): string | null => {
    const gallery = (place.photos ?? []).filter((p: any) => !p.is_deleted && !p.is_menu)
    const pick = gallery.find((p: any) => p.is_primary) ?? gallery[0]
    return pick ? storageBase + pick.storage_path : null
  }

  const filtered = ((places ?? []) as any[]).filter((p: any) =>
    q ? p.name.toLowerCase().includes(q.toLowerCase()) : true
  )

  const priceLabel = (n: number | null) => ['—', 'Budget', 'Mid', 'Upscale'][n ?? 0]

  // Counts for the filter chips (against unfiltered set in DB)
  const { data: countSet } = await supabase
    .from('places')
    .select('id, is_active, is_promoted, is_deleted, subscription_tier')
  const live = (countSet ?? []).filter(p => !p.is_deleted)
  const counts = {
    all: live.length,
    active: live.filter(p => p.is_active).length,
    inactive: live.filter(p => !p.is_active).length,
    promoted: live.filter(p => p.is_promoted).length,
    deleted: (countSet ?? []).filter(p => p.is_deleted).length,
  }

  return (
    <div>
      <Topbar
        title="Places"
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Places' }]}
        actions={
          <>
            <form className="relative">
              <input
                name="q"
                defaultValue={q}
                placeholder="Search by name…"
                className="w-72 h-9 pl-9 pr-3 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              />
              <svg className="w-4 h-4 absolute top-2.5 left-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
              </svg>
              {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
              {tier !== 'all' && <input type="hidden" name="tier" value={tier} />}
            </form>
            <Link
              href="/admin/places/new"
              className="h-9 px-4 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New place
            </Link>
          </>
        }
      />

      <div className="p-8 space-y-4">
        {/* Filters row */}
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { key: 'all',       label: 'All',       count: counts.all },
            { key: 'active',    label: 'Active',    count: counts.active },
            { key: 'inactive',  label: 'Inactive',  count: counts.inactive },
            { key: 'promoted',  label: 'Promoted',  count: counts.promoted },
            { key: 'deleted',   label: 'Supprimés', count: counts.deleted },
          ] as const).map(f => {
            const params = new URLSearchParams()
            if (f.key !== 'all') params.set('filter', f.key)
            if (q) params.set('q', q)
            if (tier !== 'all') params.set('tier', tier)
            const href = `/admin/places${params.toString() ? `?${params.toString()}` : ''}`
            const isActive = filter === f.key
            return (
              <Link
                key={f.key}
                href={href}
                className={`h-8 px-3 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {f.label}
                <span className={`text-[10px] font-bold ${isActive ? 'text-orange-100' : 'text-gray-400'}`}>{f.count}</span>
              </Link>
            )
          })}

          <div className="ml-auto flex gap-2">
            {(['all', 'free', 'standard', 'premium'] as const).map(t => {
              const params = new URLSearchParams()
              if (filter !== 'all') params.set('filter', filter)
              if (q) params.set('q', q)
              if (t !== 'all') params.set('tier', t)
              const href = `/admin/places${params.toString() ? `?${params.toString()}` : ''}`
              const isActive = tier === t
              const label = t === 'all' ? 'All tiers' : t.charAt(0).toUpperCase() + t.slice(1)
              return (
                <Link
                  key={t}
                  href={href}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center capitalize ${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Result count */}
        <div className="text-xs text-gray-500">
          {filtered.length} {filtered.length === 1 ? 'place' : 'places'}
          {q && <span> matching <strong className="text-gray-700">{q}</strong></span>}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-gray-500">No places match your filters.</p>
              <Link href="/admin/places/new" className="text-sm text-orange-500 font-semibold mt-1 inline-block">Add a new one →</Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Place</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Category</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Zone</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Price</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Tier</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((place: any) => (
                  <tr key={place.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {thumbFor(place) ? (
                          <img
                            src={thumbFor(place)!}
                            alt=""
                            className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <span className="w-9 h-9 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {place.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{place.name}</span>
                          {place.is_promoted && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-orange-500">● Promoted</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{(place as any).categories?.name_fr ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{(place as any).zones?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{priceLabel(place.price_range)}</td>
                    <td className="px-5 py-3">
                      <TierPill tier={place.subscription_tier ?? 'free'} />
                    </td>
                    <td className="px-5 py-3">
                      {place.is_deleted ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100">Supprimé</span>
                      ) : (
                        <StatusPill status={place.is_active ? 'active' : 'inactive'} />
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        {place.is_deleted ? (
                          <RestorePlaceButton id={place.id} />
                        ) : (
                          <>
                            <Link
                              href={`/admin/places/${place.id}/photos`}
                              className="text-xs text-gray-400 hover:text-gray-700"
                            >
                              Photos
                            </Link>
                            <Link
                              href={`/admin/places/${place.id}`}
                              className="text-xs text-orange-500 hover:text-orange-600 font-semibold"
                            >
                              Edit
                            </Link>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
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

function StatusPill({ status }: { status: 'active' | 'inactive' }) {
  if (status === 'active') {
    return <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100">● Active</span>
  }
  return <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">Inactive</span>
}

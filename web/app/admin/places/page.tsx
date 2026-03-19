import Link from 'next/link'
import { createClient } from '../../../lib/supabase-server'

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>
}) {
  const supabase = await createClient()
  const { q: rawQ, filter: rawFilter } = await searchParams
  const q = rawQ ?? ''
  const filter = rawFilter ?? 'all'

  let query = supabase
    .from('places')
    .select('id, name, is_active, is_promoted, price_range, created_at, categories(name_fr), zones(name)')
    .eq('is_deleted', false)
    .order('name', { ascending: true })

  if (filter === 'active') query = query.eq('is_active', true)
  if (filter === 'inactive') query = query.eq('is_active', false)
  if (filter === 'promoted') query = query.eq('is_promoted', true)

  const { data: places } = await query

  const filtered = ((places ?? []) as any[]).filter((p: any) =>
    q ? p.name.toLowerCase().includes(q.toLowerCase()) : true
  )

  const priceLabel = (n: number | null) => ['—', 'Budget', 'Mid-range', 'Upscale'][n ?? 0]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Places</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/admin/places/new"
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Add place
        </Link>
      </div>

      {/* Filters + Search */}
      <div className="flex items-center gap-3 mb-4">
        {/* Search */}
        <form className="flex-1 max-w-xs">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
          />
          {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
        </form>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {(['all', 'active', 'inactive', 'promoted'] as const).map(f => (
            <Link
              key={f}
              href={`/admin/places?filter=${f}${q ? `&q=${q}` : ''}`}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
                filter === f
                  ? 'bg-orange-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {f}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            No places found.{' '}
            <Link href="/admin/places/new" className="text-orange-500">Add one →</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Zone</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((place: any) => (
                <tr key={place.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{place.name}</span>
                      {place.is_promoted && (
                        <span className="text-xs bg-orange-50 text-orange-600 font-medium px-1.5 py-0.5 rounded border border-orange-100">
                          Promoted
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{(place as any).zones?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500">{(place as any).categories?.name_fr ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500">{priceLabel(place.price_range)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      place.is_active
                        ? 'bg-green-50 text-green-700 border border-green-100'
                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}>
                      {place.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3 justify-end">
                      <Link
                        href={`/admin/places/${place.id}/photos`}
                        className="text-xs text-gray-400 hover:text-gray-700"
                      >
                        Photos
                      </Link>
                      <Link
                        href={`/admin/places/${place.id}`}
                        className="text-xs text-orange-500 hover:text-orange-700 font-medium"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

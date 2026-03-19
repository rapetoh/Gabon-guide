import Link from 'next/link'
import { createClient } from '../../lib/supabase-server'

export default async function AdminOverviewPage() {
  const supabase = await createClient()

  const { data: places } = await supabase
    .from('places')
    .select('id, is_active, is_promoted, created_at')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  const all = places ?? []
  const total = all.length
  const active = all.filter(p => p.is_active).length
  const inactive = all.filter(p => !p.is_active).length
  const promoted = all.filter(p => p.is_promoted).length
  const recent = all.slice(0, 5)

  const { data: recentFull } = await supabase
    .from('places')
    .select('id, name, is_active, is_promoted, created_at, categories(name_fr), zones(name)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">O&apos;Kili content dashboard</p>
        </div>
        <Link
          href="/admin/places/new"
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Add place
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total places" value={total} />
        <StatCard label="Active" value={active} color="green" />
        <StatCard label="Inactive" value={inactive} color="gray" />
        <StatCard label="Promoted" value={promoted} color="orange" />
      </div>

      {/* Recent places */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Recently added</h2>
          <Link href="/admin/places" className="text-sm text-orange-500 hover:text-orange-600 font-medium">
            View all →
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {(recentFull ?? []).map((place: any) => (
            <div key={place.id} className="px-6 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{place.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {place.zones?.name ?? '—'} · {place.categories?.name_fr ?? '—'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {place.is_promoted && (
                  <span className="text-xs bg-orange-50 text-orange-600 font-medium px-2 py-0.5 rounded-full border border-orange-100">
                    Promoted
                  </span>
                )}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  place.is_active
                    ? 'bg-green-50 text-green-700 border border-green-100'
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}>
                  {place.is_active ? 'Active' : 'Inactive'}
                </span>
                <Link
                  href={`/admin/places/${place.id}`}
                  className="text-xs text-gray-400 hover:text-gray-700"
                >
                  Edit →
                </Link>
              </div>
            </div>
          ))}
          {(recentFull ?? []).length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-gray-400">
              No places yet. <Link href="/admin/places/new" className="text-orange-500">Add the first one →</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  color = 'default',
}: {
  label: string
  value: number
  color?: 'default' | 'green' | 'orange' | 'gray'
}) {
  const colors = {
    default: 'text-gray-900',
    green: 'text-green-600',
    orange: 'text-orange-500',
    gray: 'text-gray-400',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-5 py-4">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colors[color]}`}>{value}</p>
    </div>
  )
}

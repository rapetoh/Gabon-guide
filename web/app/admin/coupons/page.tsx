import Link from 'next/link'
import { createClient } from '../../../lib/supabase-server'
import Topbar from '../../../components/admin/Topbar'

export const dynamic = 'force-dynamic'

const PER_PAGE = 25

type Filter = 'all' | 'live' | 'inactive' | 'expired' | 'platform'

interface CouponRow {
  id: string
  place_id: string | null
  title_fr: string
  title_en: string | null
  starts_at: string
  expires_at: string
  is_active: boolean
  is_system: boolean
  created_at: string
  max_redemptions_per_user: number
  max_total_redemptions: number | null
  discount_type: 'percentage' | 'amount' | null
  discount_value: number | null
  places: { id: string; name: string; subscription_tier: string } | null
}

function fmtDiscount(c: CouponRow): string | null {
  if (c.discount_type === null || c.discount_value === null) return null
  if (c.discount_type === 'percentage') return `-${c.discount_value}%`
  return `-${c.discount_value.toLocaleString('fr-FR')} FCFA`
}

function statusOf(c: CouponRow): 'live' | 'inactive' | 'expired' | 'scheduled' {
  if (!c.is_active) return 'inactive'
  const now = Date.now()
  if (new Date(c.expires_at).getTime() < now) return 'expired'
  if (new Date(c.starts_at).getTime() > now) return 'scheduled'
  return 'live'
}

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: Filter; q?: string; page?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams
  const filter: Filter = params.filter ?? 'all'
  const search = (params.q ?? '').trim()
  const page = Math.max(0, parseInt(params.page ?? '0', 10) || 0)
  const nowIso = new Date().toISOString()

  // Base query — paginated server-side. Server-side search on title; place
  // names are filtered after we have the joined data (small list).
  let q = supabase
    .from('coupons')
    .select(
      'id, place_id, title_fr, title_en, starts_at, expires_at, is_active, is_system, created_at, max_redemptions_per_user, max_total_redemptions, discount_type, discount_value, places(id, name, subscription_tier)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })

  if (filter === 'live')     q = q.eq('is_active', true).lte('starts_at', nowIso).gt('expires_at', nowIso)
  if (filter === 'expired')  q = q.lt('expires_at', nowIso)
  if (filter === 'inactive') q = q.eq('is_active', false)
  if (filter === 'platform') q = q.is('place_id', null)

  if (search) q = q.or(`title_fr.ilike.%${search}%,title_en.ilike.%${search}%`)

  q = q.range(page * PER_PAGE, page * PER_PAGE + PER_PAGE - 1)

  const { data, count } = await q
  const totalCount = count ?? 0
  const hasMore = totalCount > (page + 1) * PER_PAGE
  let coupons = (data ?? []) as unknown as CouponRow[]

  // Optional place-name filter (only matters when the user searched)
  if (search) {
    const needle = search.toLowerCase()
    coupons = coupons.filter(c => {
      const blob = `${c.title_fr} ${c.title_en ?? ''} ${c.places?.name ?? ''}`.toLowerCase()
      return blob.includes(needle)
    })
  }

  // Aggregate redemption counts per coupon (page-scoped)
  const couponIds = coupons.map(c => c.id)
  const { data: redemptionRows } = couponIds.length
    ? await supabase
        .from('coupon_redemptions')
        .select('coupon_id, redeemed_at')
        .in('coupon_id', couponIds)
    : { data: [] }
  const aggMap = new Map<string, { total: number; redeemed: number }>()
  for (const r of (redemptionRows ?? []) as { coupon_id: string; redeemed_at: string | null }[]) {
    const cur = aggMap.get(r.coupon_id) ?? { total: 0, redeemed: 0 }
    cur.total += 1
    if (r.redeemed_at) cur.redeemed += 1
    aggMap.set(r.coupon_id, cur)
  }

  // Platform-coupon scope sizes
  const platformIds = coupons.filter(c => c.place_id === null).map(c => c.id)
  const scopeMap = new Map<string, number>()
  if (platformIds.length > 0) {
    const { data: scope } = await supabase
      .from('coupon_places')
      .select('coupon_id')
      .in('coupon_id', platformIds)
    for (const r of (scope ?? []) as { coupon_id: string }[]) {
      scopeMap.set(r.coupon_id, (scopeMap.get(r.coupon_id) ?? 0) + 1)
    }
  }

  function buildLink(next: Partial<{ filter: Filter; q: string; page: number }>) {
    const u = new URLSearchParams()
    const f = next.filter ?? filter
    const s = next.q       ?? search
    const p = next.page    ?? page
    if (f !== 'all') u.set('filter', f)
    if (s)           u.set('q', s)
    if (p > 0)       u.set('page', String(p))
    const qs = u.toString()
    return qs ? `/admin/coupons?${qs}` : '/admin/coupons'
  }

  return (
    <div>
      <Topbar
        title="Coupons"
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Coupons' }]}
      />
      <div className="p-8 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {([
              { k: 'all',      label: 'All' },
              { k: 'live',     label: 'Live' },
              { k: 'platform', label: 'Platform' },
              { k: 'inactive', label: 'Inactive' },
              { k: 'expired',  label: 'Expired' },
            ] as const).map(f => (
              <Link
                key={f.k}
                href={buildLink({ filter: f.k, page: 0 })}
                className={`h-8 px-3 rounded-full text-xs font-semibold transition-colors flex items-center ${
                  filter === f.k
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
          <form method="GET" className="flex-1 max-w-md flex items-center gap-2">
            {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
            <input
              name="q"
              defaultValue={search}
              placeholder="Search title or place name…"
              className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none"
            />
            <button type="submit" className="h-8 px-4 rounded-full text-xs font-semibold bg-gray-900 text-white">
              Search
            </button>
          </form>
          <Link
            href="/admin/coupons/new"
            className="ml-auto inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors"
          >
            <span className="text-base leading-none">＋</span>
            New platform coupon
          </Link>
        </div>

        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">
          {totalCount} result{totalCount === 1 ? '' : 's'}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {coupons.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              <p className="text-sm text-gray-500">No coupons match this filter.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Coupon</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Scope</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Discount</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Status</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Expires</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Used</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Quota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {coupons.map(c => {
                  const agg = aggMap.get(c.id) ?? { total: 0, redeemed: 0 }
                  const status = statusOf(c)
                  const isPlatform = c.place_id === null
                  const scopeCount = isPlatform ? (scopeMap.get(c.id) ?? 0) : 0
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-gray-900 max-w-md truncate">{c.title_fr}</div>
                        {c.title_en && (
                          <div className="text-xs text-gray-400 max-w-md truncate">{c.title_en}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {!isPlatform && c.places ? (
                          <Link href={`/admin/places/${c.places.id}`} className="text-orange-500 hover:text-orange-600 font-medium">
                            {c.places.name}
                          </Link>
                        ) : isPlatform && scopeCount === 0 ? (
                          <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                            ◍ All restaurants
                          </span>
                        ) : isPlatform ? (
                          <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                            ◍ {scopeCount} place{scopeCount === 1 ? '' : 's'}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        {fmtDiscount(c) ? (
                          <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
                            {fmtDiscount(c)}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3"><StatusPill status={status} /></td>
                      <td className="px-5 py-3 text-gray-500">
                        {new Date(c.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`font-semibold ${agg.redeemed > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {agg.redeemed}
                        </span>
                        <span className="text-gray-400"> / {agg.total}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">
                        {c.max_total_redemptions !== null ? (
                          <span className={agg.redeemed >= c.max_total_redemptions ? 'text-red-600 font-semibold' : ''}>
                            {agg.redeemed} / {c.max_total_redemptions}
                            {agg.redeemed >= c.max_total_redemptions && ' · Sold out'}
                          </span>
                        ) : (
                          <span className="text-gray-300">Unlimited</span>
                        )}
                        {c.max_redemptions_per_user > 1 && (
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            max {c.max_redemptions_per_user}/customer
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

        {/* Pagination */}
        {totalCount > PER_PAGE && (
          <div className="flex items-center justify-between pt-2">
            <Link
              href={buildLink({ page: Math.max(0, page - 1) })}
              aria-disabled={page === 0}
              className={`inline-flex items-center gap-1 h-9 px-4 rounded-lg text-xs font-semibold transition-colors ${
                page === 0
                  ? 'bg-white text-gray-300 border border-gray-100 pointer-events-none'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
              }`}
            >
              ← Prev
            </Link>
            <span className="text-xs text-gray-500 font-semibold">
              Page {page + 1} · {totalCount} total
            </span>
            <Link
              href={buildLink({ page: page + 1 })}
              aria-disabled={!hasMore}
              className={`inline-flex items-center gap-1 h-9 px-4 rounded-lg text-xs font-semibold transition-colors ${
                !hasMore
                  ? 'bg-white text-gray-300 border border-gray-100 pointer-events-none'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
              }`}
            >
              Next →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: 'live' | 'inactive' | 'expired' | 'scheduled' }) {
  const styles = {
    live:      { bg: 'bg-green-50', fg: 'text-green-700', border: 'border-green-100', label: '● Live' },
    scheduled: { bg: 'bg-blue-50',  fg: 'text-blue-700',  border: 'border-blue-100',  label: 'Scheduled' },
    inactive:  { bg: 'bg-gray-100', fg: 'text-gray-500',  border: 'border-gray-200',  label: 'Inactive' },
    expired:   { bg: 'bg-red-50',   fg: 'text-red-700',   border: 'border-red-100',   label: 'Expired' },
  }[status]
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${styles.bg} ${styles.fg} ${styles.border}`}>
      {styles.label}
    </span>
  )
}

import Link from 'next/link'
import { createClient } from '../../../lib/supabase-server'
import Topbar from '../../../components/admin/Topbar'

interface CouponRow {
  id: string
  place_id: string
  title_fr: string
  title_en: string | null
  starts_at: string
  expires_at: string
  is_active: boolean
  is_system: boolean
  created_at: string
  places: { id: string; name: string; subscription_tier: string } | null
}

interface RedemptionAggregate {
  coupon_id: string
  total: number
  redeemed: number
}

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const supabase = await createClient()
  const { filter: rawFilter } = await searchParams
  const filter = rawFilter ?? 'all'

  let q = supabase
    .from('coupons')
    .select('id, place_id, title_fr, title_en, starts_at, expires_at, is_active, is_system, created_at, places(id, name, subscription_tier)')
    .order('created_at', { ascending: false })

  const nowIso = new Date().toISOString()
  if (filter === 'live') q = q.eq('is_active', true).lte('starts_at', nowIso).gt('expires_at', nowIso)
  if (filter === 'expired') q = q.lt('expires_at', nowIso)
  if (filter === 'inactive') q = q.eq('is_active', false)

  const { data } = await q
  const coupons = (data ?? []) as unknown as CouponRow[]

  // Aggregate redemption counts per coupon
  const couponIds = coupons.map(c => c.id)
  const { data: redemptionRows } = couponIds.length
    ? await supabase
        .from('coupon_redemptions')
        .select('coupon_id, redeemed_at')
        .in('coupon_id', couponIds)
    : { data: [] }

  const aggMap = new Map<string, RedemptionAggregate>()
  for (const r of (redemptionRows ?? []) as { coupon_id: string; redeemed_at: string | null }[]) {
    const cur = aggMap.get(r.coupon_id) ?? { coupon_id: r.coupon_id, total: 0, redeemed: 0 }
    cur.total += 1
    if (r.redeemed_at) cur.redeemed += 1
    aggMap.set(r.coupon_id, cur)
  }

  const counts = {
    all: coupons.length,
    live: coupons.filter(c => c.is_active && new Date(c.starts_at) <= new Date() && new Date(c.expires_at) > new Date()).length,
    inactive: coupons.filter(c => !c.is_active).length,
    expired: coupons.filter(c => new Date(c.expires_at) < new Date()).length,
  }

  function statusOf(c: CouponRow): 'live' | 'inactive' | 'expired' | 'scheduled' {
    if (!c.is_active) return 'inactive'
    const now = Date.now()
    if (new Date(c.expires_at).getTime() < now) return 'expired'
    if (new Date(c.starts_at).getTime() > now) return 'scheduled'
    return 'live'
  }

  return (
    <div>
      <Topbar
        title="Coupons"
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Coupons' }]}
      />
      <div className="p-8 space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { key: 'all',      label: 'All',      count: counts.all },
            { key: 'live',     label: 'Live',     count: counts.live },
            { key: 'inactive', label: 'Inactive', count: counts.inactive },
            { key: 'expired',  label: 'Expired',  count: counts.expired },
          ] as const).map(f => (
            <Link
              key={f.key}
              href={f.key === 'all' ? '/admin/coupons' : `/admin/coupons?filter=${f.key}`}
              className={`h-8 px-3 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                filter === f.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {f.label}
              <span className={`text-[10px] font-bold ${filter === f.key ? 'text-orange-100' : 'text-gray-400'}`}>
                {f.count}
              </span>
            </Link>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {coupons.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              <p className="text-sm text-gray-500">No coupons match this filter.</p>
              <p className="text-xs text-gray-400 mt-1">Owners create coupons from the mobile app (Standard tier and above).</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Coupon</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Place</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Status</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Expires</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Generated</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Redeemed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {coupons.map(c => {
                  const agg = aggMap.get(c.id) ?? { total: 0, redeemed: 0 }
                  const status = statusOf(c)
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-gray-900 max-w-md truncate">{c.title_fr}</div>
                        {c.title_en && (
                          <div className="text-xs text-gray-400 max-w-md truncate">{c.title_en}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {c.places ? (
                          <Link href={`/admin/places/${c.places.id}`} className="text-orange-500 hover:text-orange-600 font-medium">
                            {c.places.name}
                          </Link>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill status={status} />
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {new Date(c.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3 text-gray-500">{agg.total}</td>
                      <td className="px-5 py-3">
                        <span className={`font-semibold ${agg.redeemed > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {agg.redeemed}
                        </span>
                        <span className="text-gray-400"> / {agg.total}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: 'live' | 'inactive' | 'expired' | 'scheduled' }) {
  const styles = {
    live:      { bg: 'bg-green-50',  fg: 'text-green-700', border: 'border-green-100', label: '● Live' },
    scheduled: { bg: 'bg-blue-50',   fg: 'text-blue-700',  border: 'border-blue-100',  label: 'Scheduled' },
    inactive:  { bg: 'bg-gray-100',  fg: 'text-gray-500',  border: 'border-gray-200',  label: 'Inactive' },
    expired:   { bg: 'bg-red-50',    fg: 'text-red-700',   border: 'border-red-100',   label: 'Expired' },
  }[status]
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${styles.bg} ${styles.fg} ${styles.border}`}>
      {styles.label}
    </span>
  )
}

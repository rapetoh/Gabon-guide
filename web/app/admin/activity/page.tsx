import { createClient } from '../../../lib/supabase-server'
import Topbar from '../../../components/admin/Topbar'

export const dynamic = 'force-dynamic'

function fmtFcfa(n: number): string {
  return `${n.toLocaleString('fr-FR')} FCFA`
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case 'referral_signup':    return 'Welcome gift'
    case 'referral_invite':    return 'Invite reward'
    case 'redemption_session': return 'Spent at place'
    case 'admin_adjust':       return 'Admin adjustment'
    default:                   return reason
  }
}

type FilterKey = 'all' | 'credit' | 'coupons'

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: FilterKey; q?: string }>
}) {
  const supabase = await createClient()
  const { filter: rawFilter, q } = await searchParams
  const filter: FilterKey = rawFilter ?? 'all'
  const search = (q ?? '').trim().toLowerCase()

  const [txRes, redRes] = await Promise.all([
    supabase
      .from('credit_transactions')
      .select(`
        id, user_id, delta_fcfa, reason, created_at,
        place:places(name),
        profile:profiles!credit_transactions_user_id_fkey(full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('coupon_redemptions')
      .select(`
        id, user_id, redeemed_at, bill_amount, discount_applied,
        place:places!coupon_redemptions_place_id_fkey(name),
        coupon:coupons!inner ( title_fr ),
        profile:profiles!coupon_redemptions_user_id_fkey(full_name, email)
      `)
      .not('redeemed_at', 'is', null)
      .order('redeemed_at', { ascending: false })
      .limit(200),
  ])

  type Row = {
    id: string
    ts: string
    kind: 'credit' | 'coupon'
    userName: string
    placeName: string
    label: string
    amountText: string
    amountClass: string
  }

  const txRows: Row[] = ((txRes.data ?? []) as any[]).map(r => ({
    id: `tx:${r.id}`,
    ts: r.created_at,
    kind: 'credit',
    userName: r.profile?.full_name?.trim() || r.profile?.email || '—',
    placeName: r.place?.name ?? '—',
    label: reasonLabel(r.reason),
    amountText: `${r.delta_fcfa >= 0 ? '+' : '−'}${fmtFcfa(Math.abs(r.delta_fcfa))}`,
    amountClass: r.delta_fcfa >= 0 ? 'text-green-600' : 'text-orange-600',
  }))

  const redRows: Row[] = ((redRes.data ?? []) as any[]).map(r => ({
    id: `red:${r.id}`,
    ts: r.redeemed_at,
    kind: 'coupon',
    userName: r.profile?.full_name?.trim() || r.profile?.email || '—',
    placeName: r.place?.name ?? '—',
    label: r.coupon?.title_fr ?? 'Coupon',
    amountText: r.discount_applied != null
      ? `−${fmtFcfa(r.discount_applied)}`
      : (r.bill_amount != null ? fmtFcfa(r.bill_amount) : '—'),
    amountClass: 'text-orange-600',
  }))

  let rows: Row[] = [...txRows, ...redRows]
    .sort((a, b) => b.ts.localeCompare(a.ts))

  if (filter === 'credit')  rows = rows.filter(r => r.kind === 'credit')
  if (filter === 'coupons') rows = rows.filter(r => r.kind === 'coupon')

  if (search) {
    rows = rows.filter(r =>
      r.userName.toLowerCase().includes(search)
      || r.placeName.toLowerCase().includes(search)
      || r.label.toLowerCase().includes(search),
    )
  }

  return (
    <div>
      <Topbar
        title="Activity"
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Activity' }]}
      />
      <div className="p-8 space-y-4">
        <p className="text-sm text-gray-500 max-w-2xl">
          Full timeline of credit movements and coupon redemptions, newest first.
          Limited to the most recent 200 of each.
        </p>

        {/* Filters + search */}
        <form className="flex items-center gap-3 flex-wrap" method="GET">
          <div className="flex items-center gap-1.5">
            {([
              { k: 'all',     label: 'All' },
              { k: 'credit',  label: 'Credit movements' },
              { k: 'coupons', label: 'Coupon redemptions' },
            ] as const).map(f => (
              <a
                key={f.k}
                href={f.k === 'all'
                  ? (search ? `/admin/activity?q=${encodeURIComponent(search)}` : '/admin/activity')
                  : `/admin/activity?filter=${f.k}${search ? `&q=${encodeURIComponent(search)}` : ''}`}
                className={`h-8 px-3 rounded-full text-xs font-semibold transition-colors flex items-center ${
                  filter === f.k
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {f.label}
              </a>
            ))}
          </div>
          <input
            name="q"
            defaultValue={search}
            placeholder="Search by user, place, or coupon…"
            className="flex-1 max-w-md bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none"
          />
          {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
          <button type="submit" className="h-8 px-4 rounded-full text-xs font-semibold bg-gray-900 text-white">Search</button>
        </form>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {rows.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-400 italic">No matching activity.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Kind</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">User</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Event</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Place</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Amount</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="px-5 py-2.5">
                      <span className={`inline-block text-[10px] font-bold uppercase tracking-[0.08em] px-2 py-0.5 rounded-full ${
                        r.kind === 'credit' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
                      }`}>
                        {r.kind}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-gray-900 font-medium">{r.userName}</td>
                    <td className="px-5 py-2.5 text-gray-600">{r.label}</td>
                    <td className="px-5 py-2.5 text-gray-500">{r.placeName}</td>
                    <td className={`px-5 py-2.5 text-right font-bold ${r.amountClass}`}>{r.amountText}</td>
                    <td className="px-5 py-2.5 text-right text-xs text-gray-400">{fmtDateTime(r.ts)}</td>
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

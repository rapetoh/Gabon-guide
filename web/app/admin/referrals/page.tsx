import Link from 'next/link'
import { createClient } from '../../../lib/supabase-server'
import Topbar from '../../../components/admin/Topbar'
import ReferralsClient, { type ReferralSettings, type CouponOption } from './ReferralsClient'

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

export default async function ReferralsPage() {
  const supabase = await createClient()

  const nowIso = new Date().toISOString()

  // Settings + coupons (for the form), plus analytics (sums + top referrers
  // + recent activity). Everything in parallel.
  const [
    { data: settingsRow },
    { data: couponsRows },
    { count: totalLinks },
    { data: issuedRows },
    { data: spentRows },
    { data: balanceRows },
    { data: referrerRows },
    { data: recentTxRows },
  ] = await Promise.all([
    supabase.from('referral_settings').select('*').eq('id', 1).maybeSingle(),
    supabase
      .from('coupons')
      .select('id, title_fr, title_en, expires_at, place_id, places!coupons_place_id_fkey(name)')
      .eq('is_active', true)
      .gt('expires_at', nowIso)
      .order('expires_at', { ascending: true }),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('referred_by', 'is', null),
    supabase.from('credit_transactions').select('delta_fcfa').gt('delta_fcfa', 0),
    supabase.from('credit_transactions').select('delta_fcfa').lt('delta_fcfa', 0),
    supabase.from('credit_balances').select('balance_fcfa'),
    supabase
      .from('profiles')
      .select('referred_by, referrer:profiles!profiles_referred_by_fkey(id, full_name, email, referral_code)')
      .not('referred_by', 'is', null),
    supabase
      .from('credit_transactions')
      .select('id, user_id, delta_fcfa, reason, created_at, place_id, place:places(name), profile:profiles!credit_transactions_user_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  const settings: ReferralSettings = (settingsRow as ReferralSettings | null) ?? {
    id: 1,
    reward_type: 'none',
    referrer_reward_value: 0,
    referee_reward_value: 0,
    reward_coupon_id: null,
    reward_credit_fcfa: null,
    is_active: true,
    updated_at: new Date().toISOString(),
  }

  const coupons: CouponOption[] = ((couponsRows ?? []) as unknown as Array<{
    id: string
    title_fr: string
    title_en: string | null
    expires_at: string
    place_id: string
    places: { name: string } | null
  }>).map(c => ({
    id: c.id,
    title: c.title_fr,
    placeName: c.places?.name ?? '—',
    expiresAt: c.expires_at,
  }))

  // Analytics
  const totalIssued  = (issuedRows  ?? []).reduce((s, r: any) => s + (r.delta_fcfa ?? 0), 0)
  const totalSpent   = (spentRows   ?? []).reduce((s, r: any) => s + Math.abs(r.delta_fcfa ?? 0), 0)
  const outstanding  = (balanceRows ?? []).reduce((s, r: any) => s + (r.balance_fcfa ?? 0), 0)

  // Top referrers — aggregate client-side from the joined rows
  const counts = new Map<string, { id: string; name: string | null; email: string | null; code: string | null; count: number }>()
  for (const row of (referrerRows ?? []) as any[]) {
    const r = row.referrer
    if (!r?.id) continue
    const cur = counts.get(r.id) ?? { id: r.id, name: r.full_name ?? null, email: r.email ?? null, code: r.referral_code ?? null, count: 0 }
    cur.count += 1
    counts.set(r.id, cur)
  }
  const topReferrers = Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 10)

  return (
    <div>
      <Topbar
        title="Referrals"
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Referrals' }]}
      />
      <div className="p-8 space-y-6 max-w-5xl">
        {/* Hero stats row */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Referral links" value={String(totalLinks ?? 0)} />
          <StatCard label="Credit issued"  value={fmtFcfa(totalIssued)}  tint="green" />
          <StatCard label="Credit spent"   value={fmtFcfa(totalSpent)}   tint="orange" />
          <StatCard label="Outstanding"    value={fmtFcfa(outstanding)} />
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Settings (2/3) */}
          <div className="col-span-2">
            <ReferralsClient initialSettings={settings} coupons={coupons} />
          </div>

          {/* Top referrers (1/3) */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-baseline justify-between mb-3">
              <div className="font-semibold text-gray-900">Top referrers</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">Top 10</div>
            </div>
            {topReferrers.length === 0 ? (
              <div className="text-sm text-gray-400 italic">No referrals yet.</div>
            ) : (
              <ol className="space-y-2">
                {topReferrers.map((r, idx) => (
                  <li key={r.id} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-orange-50 text-orange-500 text-[11px] font-bold flex items-center justify-center">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-gray-900 truncate">{r.name?.trim() || r.email || '—'}</div>
                      {r.email && r.name && r.email !== r.name && (
                        <div className="text-[11px] text-gray-400 truncate">{r.email}</div>
                      )}
                    </div>
                    <span className="text-sm font-bold text-gray-900">{r.count}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Recent activity (last 15 credit movements) */}
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="flex items-baseline justify-between px-5 py-3 border-b border-gray-100">
            <div className="font-semibold text-gray-900">Recent credit activity</div>
            <Link href="/admin/activity" className="text-xs font-semibold text-orange-500 hover:text-orange-600">View all →</Link>
          </div>
          {(recentTxRows ?? []).length === 0 ? (
            <div className="px-5 py-8 text-sm text-gray-400 italic">No credit movements yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">User</th>
                  <th className="text-left px-5 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Reason</th>
                  <th className="text-left px-5 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Place</th>
                  <th className="text-right px-5 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Amount</th>
                  <th className="text-right px-5 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(recentTxRows as any[]).map(r => (
                  <tr key={r.id}>
                    <td className="px-5 py-2 text-gray-900 font-medium">
                      {r.profile?.full_name?.trim() || r.profile?.email || '—'}
                    </td>
                    <td className="px-5 py-2 text-gray-600">{reasonLabel(r.reason)}</td>
                    <td className="px-5 py-2 text-gray-500">{r.place?.name ?? '—'}</td>
                    <td className={`px-5 py-2 text-right font-bold ${r.delta_fcfa >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                      {r.delta_fcfa >= 0 ? '+' : '−'}{fmtFcfa(Math.abs(r.delta_fcfa))}
                    </td>
                    <td className="px-5 py-2 text-right text-xs text-gray-400">{fmtDateTime(r.created_at)}</td>
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

function StatCard({ label, value, tint }: { label: string; value: string; tint?: 'green' | 'orange' }) {
  const tintCls = tint === 'green'  ? 'text-green-600'
               :  tint === 'orange' ? 'text-orange-600'
               :                       'text-gray-900'
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tintCls}`}>{value}</div>
    </div>
  )
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

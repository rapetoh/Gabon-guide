import Link from 'next/link'
import { createClient } from '../../lib/supabase-server'
import Topbar from '../../components/admin/Topbar'
import SubscriptionsPanel, { type SubscriptionRow } from './SubscriptionsPanel'

export default async function AdminOverviewPage() {
  const supabase = await createClient()

  const [{ data: places }, { data: recentFull }, { data: subscribers }, { data: expiring }] = await Promise.all([
    supabase
      .from('places')
      .select('id, is_active, is_promoted, subscription_tier, subscription_expires_at, created_at')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('places')
      .select('id, name, is_active, is_promoted, subscription_tier, created_at, categories(name_fr), zones(name)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('places')
      .select('id, subscription_tier')
      .eq('is_deleted', false),
    // Paid subscriptions expired or expiring within 7 days, most overdue first
    supabase
      .from('places')
      .select('id, name, subscription_tier, subscription_expires_at')
      .eq('is_deleted', false)
      .neq('subscription_tier', 'free')
      .not('subscription_expires_at', 'is', null)
      .lt('subscription_expires_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('subscription_expires_at', { ascending: true }),
  ])

  const all = places ?? []
  const total = all.length
  const active = all.filter(p => p.is_active).length
  const inactive = all.filter(p => !p.is_active).length
  const promoted = all.filter(p => p.is_promoted).length

  const subs = subscribers ?? []
  const free = subs.filter(p => p.subscription_tier === 'free').length
  const standard = subs.filter(p => p.subscription_tier === 'standard').length
  const premium = subs.filter(p => p.subscription_tier === 'premium').length

  // Expiring within 30 days
  const now = Date.now()
  const monthMs = 30 * 24 * 60 * 60 * 1000
  const expiringSoon = all.filter(p => {
    if (!p.subscription_expires_at) return false
    const t = new Date(p.subscription_expires_at).getTime()
    return t > now && t < now + monthMs
  }).length

  return (
    <div>
      <Topbar
        title="Overview"
        breadcrumb={[{ label: 'Admin' }, { label: 'Overview' }]}
        actions={
          <Link
            href="/admin/places/new"
            className="h-9 px-4 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add place
          </Link>
        }
      />

      <div className="p-8 space-y-6">
        {/* Hero stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Total places" value={total} hint={`${active} active · ${inactive} inactive`} />
          <StatCard label="Promoted" value={promoted} hint="Trending Now eligible" tone="orange" />
          <StatCard label="Premium" value={premium} hint={`${standard} Standard · ${free} Free`} tone="orange" />
          <StatCard label="Expiring ≤ 30d" value={expiringSoon} hint="Subscriptions ending soon" tone={expiringSoon > 0 ? 'orange' : 'muted'} />
        </div>

        {/* Abonnements: expired / expiring soon, with renewal actions */}
        <SubscriptionsPanel places={(expiring ?? []) as SubscriptionRow[]} />

        {/* 2-col: tier distribution + recent activity */}
        <div className="grid grid-cols-[1.4fr_1fr] gap-4">
          {/* Tier distribution */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold text-gray-900">Tier distribution</h2>
              <Link href="/admin/tier-settings" className="text-xs font-semibold text-orange-500 hover:text-orange-600">
                Configure →
              </Link>
            </div>
            <div className="space-y-3">
              <TierBar label="Free" count={free} total={total} color="bg-gray-300" />
              <TierBar label="Standard" count={standard} total={total} color="bg-orange-300" />
              <TierBar label="Premium" count={premium} total={total} color="bg-orange-500" />
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Quick actions</h2>
            <div className="space-y-2">
              <QuickLink href="/admin/places/new" label="Create new place" hint="Add a venue to the directory" icon="plus" />
              <QuickLink href="/admin/places?filter=promoted" label="Manage promoted" hint={`${promoted} place(s) currently featured`} icon="star" />
              <QuickLink href="/admin/tier-settings" label="Tier settings" hint="Edit feature matrix and limits" icon="cog" />
            </div>
          </div>
        </div>

        {/* Recent places */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Recently added</h2>
            <Link href="/admin/places" className="text-xs font-semibold text-orange-500 hover:text-orange-600">
              View all →
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-5 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Place</th>
                <th className="text-left px-5 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Zone</th>
                <th className="text-left px-5 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Category</th>
                <th className="text-left px-5 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Tier</th>
                <th className="text-left px-5 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-[0.08em]">Status</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(recentFull ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                    No places yet. <Link href="/admin/places/new" className="text-orange-500 font-semibold">Add the first one →</Link>
                  </td>
                </tr>
              ) : (
                (recentFull ?? []).map((place: any) => (
                  <tr key={place.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{place.name}</span>
                        {place.is_promoted && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-orange-500">● Promoted</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{(place as any).zones?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{(place as any).categories?.name_fr ?? '—'}</td>
                    <td className="px-5 py-3">
                      <TierPill tier={place.subscription_tier ?? 'free'} />
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill status={place.is_active ? 'active' : 'inactive'} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/admin/places/${place.id}`}
                        className="text-xs font-semibold text-orange-500 hover:text-orange-600"
                      >
                        Edit →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: number
  hint?: string
  tone?: 'default' | 'orange' | 'muted'
}) {
  const valueColor = tone === 'orange' ? 'text-orange-500' : tone === 'muted' ? 'text-gray-400' : 'text-gray-900'
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.08em]">{label}</p>
      <p className={`text-3xl font-bold mt-1.5 tracking-tight ${valueColor}`}>{value.toLocaleString('fr-FR')}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function TierBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100)
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <span className="text-xs text-gray-400">{count} <span className="text-gray-300">·</span> {pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
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

function QuickLink({ href, label, hint, icon }: { href: string; label: string; hint: string; icon: 'plus' | 'star' | 'cog' }) {
  const icons = {
    plus: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />,
    star: <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.539 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />,
    cog: <><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>,
  }
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
    >
      <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {icons[icon]}
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900">{label}</div>
        <div className="text-xs text-gray-500 truncate">{hint}</div>
      </div>
      <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

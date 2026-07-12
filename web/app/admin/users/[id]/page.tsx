import { notFound } from 'next/navigation'
import { createClient } from '../../../../lib/supabase-server'
import Topbar from '../../../../components/admin/Topbar'
import UserDetailClient, { type UserDetail, type PlaceOption } from './UserDetailClient'

export const dynamic = 'force-dynamic'

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Profile + owned place + place picker options + activity stats, in parallel.
  // Admin RLS: profiles_admin_read_all, places_admin_read_all,
  // coupon_redemptions_owner_admin_read, credit_balances_admin_read (migration 029).
  const [
    { data: profile },
    { data: ownedPlace },
    { data: places },
    { count: reviewCount },
    { count: redemptionCount },
    { data: balance },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url, email, role, is_admin, is_blocked, referral_code, created_at')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('places')
      .select('id, name')
      .eq('owner_id', id)
      .eq('is_deleted', false)
      .maybeSingle(),
    supabase
      .from('places')
      .select('id, name, owner_id')
      .eq('is_deleted', false)
      .order('name', { ascending: true }),
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', id),
    supabase
      .from('coupon_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', id)
      .not('redeemed_at', 'is', null),
    supabase
      .from('credit_balances')
      .select('balance_fcfa, lifetime_earned')
      .eq('user_id', id)
      .maybeSingle(),
  ])

  if (!profile) notFound()

  const displayName = profile.full_name?.trim() || 'Sans nom'

  return (
    <div className="min-h-screen">
      <Topbar
        title={displayName}
        breadcrumb={[
          { label: 'Admin', href: '/admin' },
          { label: 'Users', href: '/admin/users' },
          { label: displayName },
        ]}
      />
      <div className="p-8 max-w-3xl">
        <UserDetailClient
          user={profile as UserDetail}
          ownedPlace={ownedPlace ?? null}
          places={(places ?? []) as PlaceOption[]}
          stats={{
            reviews: reviewCount ?? 0,
            redemptions: redemptionCount ?? 0,
            balanceFcfa: balance?.balance_fcfa ?? 0,
            lifetimeEarned: balance?.lifetime_earned ?? 0,
          }}
        />
      </div>
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

// ─── User activity feed ─────────────────────────────────────────────
// Unified chronological feed of every credit movement + every redeemed
// coupon for the current user. Powers the "Activity" screen on Profile so
// users can see what they've earned and spent, where, and when.
export type UserActivityKind =
  | 'credit_earn_signup'   // welcome gift on signup
  | 'credit_earn_invite'   // someone signed up with my code
  | 'credit_earn_adjust'   // admin manually added credit
  | 'credit_spend'         // used credit at a place
  | 'coupon_redemption'    // redeemed a coupon at a place

export interface UserActivityItem {
  id: string
  ts: string                   // ISO timestamp for sorting / display
  kind: UserActivityKind
  amountFcfa: number            // positive = inflow, negative = outflow / 0 for coupon
  placeName: string | null
  placeId: string | null
  couponTitleFr: string | null
  couponTitleEn: string | null
  billAmount: number | null
  discountApplied: number | null
  // For referral_invite: the friend who signed up. Currently we look up the
  // profile via ref_id (set to the referee's id by handle_new_user).
  refUserName: string | null
}

export function useUserActivity(limit = 50) {
  const { session } = useSession()
  return useQuery({
    queryKey: ['user-activity', session?.user.id, limit],
    queryFn: async (): Promise<UserActivityItem[]> => {
      if (!session) return []

      // Pull both streams in parallel — they live in separate tables so we
      // merge client-side. Cap each at `limit` rows; the union is sorted +
      // truncated below.
      const [txRes, redRes] = await Promise.all([
        supabase
          .from('credit_transactions')
          .select(`
            id,
            delta_fcfa,
            reason,
            ref_id,
            place_id,
            created_at,
            place:places ( id, name )
          `)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('coupon_redemptions')
          .select(`
            id,
            redeemed_at,
            bill_amount,
            discount_applied,
            place:places!coupon_redemptions_place_id_fkey ( id, name ),
            coupon:coupons!inner (
              id,
              title_fr,
              title_en
            )
          `)
          .eq('user_id', session.user.id)
          .not('redeemed_at', 'is', null)
          .order('redeemed_at', { ascending: false })
          .limit(limit),
      ])

      if (txRes.error) throw txRes.error
      if (redRes.error) throw redRes.error

      // Look up referrer/referee names for ref_id (referee for 'referral_invite')
      type Tx = {
        id: string
        delta_fcfa: number
        reason: UserActivityItem['kind'] extends infer K ? K : never
        ref_id: string | null
        place_id: string | null
        created_at: string
        place: { id: string; name: string } | null
      }
      const txRows = (txRes.data ?? []) as unknown as Array<{
        id: string
        delta_fcfa: number
        reason: 'referral_signup' | 'referral_invite' | 'redemption_session' | 'admin_adjust'
        ref_id: string | null
        place_id: string | null
        created_at: string
        place: { id: string; name: string } | null
      }>

      const refIds = Array.from(new Set(
        txRows.filter(r => r.reason === 'referral_invite' && r.ref_id).map(r => r.ref_id!),
      ))
      let refUsers: Record<string, string | null> = {}
      if (refIds.length > 0) {
        // Read referee display name through the safe view (migration 025).
        // The base `profiles` table is no longer publicly readable, so we
        // no longer pull email here either — name is what the activity row
        // actually renders.
        const { data: refProfiles } = await supabase
          .from('profiles_public')
          .select('id, full_name')
          .in('id', refIds)
        for (const p of refProfiles ?? []) {
          if (p.id) refUsers[p.id] = (p as any).full_name?.trim() || null
        }
      }

      const txItems: UserActivityItem[] = txRows.map(r => ({
        id: `tx:${r.id}`,
        ts: r.created_at,
        kind:
          r.reason === 'referral_signup' ? 'credit_earn_signup' :
          r.reason === 'referral_invite' ? 'credit_earn_invite' :
          r.reason === 'admin_adjust'    ? 'credit_earn_adjust' :
          'credit_spend',
        amountFcfa: r.delta_fcfa,
        placeName: r.place?.name ?? null,
        placeId:   r.place?.id ?? null,
        couponTitleFr: null,
        couponTitleEn: null,
        billAmount: null,
        discountApplied: null,
        refUserName: r.ref_id ? refUsers[r.ref_id] ?? null : null,
      }))

      type RedRow = {
        id: string
        redeemed_at: string
        bill_amount: number | null
        discount_applied: number | null
        place: { id: string; name: string } | null
        coupon: {
          id: string
          title_fr: string
          title_en: string | null
        } | null
      }
      const redItems: UserActivityItem[] = ((redRes.data ?? []) as unknown as RedRow[])
        .filter(r => r.coupon && r.redeemed_at)
        .map(r => ({
          id: `red:${r.id}`,
          ts: r.redeemed_at!,
          kind: 'coupon_redemption' as const,
          amountFcfa: 0,
          placeName: r.place?.name ?? null,
          placeId:   r.place?.id ?? null,
          couponTitleFr: r.coupon!.title_fr,
          couponTitleEn: r.coupon!.title_en,
          billAmount:      r.bill_amount,
          discountApplied: r.discount_applied,
          refUserName: null,
        }))

      const merged = [...txItems, ...redItems].sort(
        (a, b) => b.ts.localeCompare(a.ts),
      )
      return merged.slice(0, limit)
    },
    enabled: !!session,
    staleTime: 5_000,
  })
}

// ─── Owner activity feed (per place) ────────────────────────────────
// Every redeemed coupon at the owner's place + every credit spent at the
// place. Joined with customer profile so the owner sees who used what.
export type OwnerActivityKind = 'coupon_redemption' | 'credit_spend'

export interface OwnerActivityItem {
  id: string
  ts: string
  kind: OwnerActivityKind
  customerName: string | null
  customerEmail: string | null
  // Coupon-specific
  couponTitleFr: string | null
  couponTitleEn: string | null
  billAmount: number | null
  discountApplied: number | null
  // Credit-specific
  creditUsedFcfa: number | null
}

export function useOwnerActivity(placeId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ['owner-activity', placeId, limit],
    queryFn: async (): Promise<OwnerActivityItem[]> => {
      if (!placeId) return []

      const [redRes, txRes] = await Promise.all([
        supabase
          .from('coupon_redemptions')
          .select(`
            id,
            user_id,
            redeemed_at,
            bill_amount,
            discount_applied,
            coupon:coupons!inner ( id, title_fr, title_en )
          `)
          .eq('place_id', placeId)
          .not('redeemed_at', 'is', null)
          .order('redeemed_at', { ascending: false })
          .limit(limit),
        supabase
          .from('credit_transactions')
          .select('id, user_id, delta_fcfa, reason, created_at')
          .eq('place_id', placeId)
          .eq('reason', 'redemption_session')
          .order('created_at', { ascending: false })
          .limit(limit),
      ])

      if (redRes.error) throw redRes.error
      if (txRes.error) throw txRes.error

      type RedRow = {
        id: string
        user_id: string | null
        redeemed_at: string
        bill_amount: number | null
        discount_applied: number | null
        coupon: { id: string; title_fr: string; title_en: string | null } | null
      }
      const redRows = ((redRes.data ?? []) as unknown as RedRow[])
        .filter(r => r.coupon)

      const txRows = (txRes.data ?? []) as Array<{
        id: string
        user_id: string
        delta_fcfa: number
        reason: string
        created_at: string
      }>

      const userIds = Array.from(new Set([
        ...redRows.filter(r => r.user_id).map(r => r.user_id!),
        ...txRows.map(t => t.user_id),
      ]))
      let profiles: Record<string, { name: string | null; email: string | null }> = {}
      if (userIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds)
        for (const p of data ?? []) {
          profiles[p.id] = {
            name:  (p as any).full_name ?? null,
            email: (p as any).email ?? null,
          }
        }
      }

      const items: OwnerActivityItem[] = [
        ...redRows.map<OwnerActivityItem>(r => ({
          id: `red:${r.id}`,
          ts: r.redeemed_at,
          kind: 'coupon_redemption',
          customerName:  r.user_id ? profiles[r.user_id]?.name  ?? null : null,
          customerEmail: r.user_id ? profiles[r.user_id]?.email ?? null : null,
          couponTitleFr: r.coupon!.title_fr,
          couponTitleEn: r.coupon!.title_en,
          billAmount: r.bill_amount,
          discountApplied: r.discount_applied,
          creditUsedFcfa: null,
        })),
        ...txRows.map<OwnerActivityItem>(t => ({
          id: `tx:${t.id}`,
          ts: t.created_at,
          kind: 'credit_spend',
          customerName:  profiles[t.user_id]?.name  ?? null,
          customerEmail: profiles[t.user_id]?.email ?? null,
          couponTitleFr: null,
          couponTitleEn: null,
          billAmount: null,
          discountApplied: null,
          // delta_fcfa is negative for spend; flip to a positive "credit used" amount
          creditUsedFcfa: Math.abs(t.delta_fcfa),
        })),
      ].sort((a, b) => b.ts.localeCompare(a.ts))

      return items.slice(0, limit)
    },
    enabled: !!placeId,
    staleTime: 5_000,
  })
}

// ─── Admin analytics ────────────────────────────────────────────────
export interface ReferralAnalytics {
  totalIssued: number      // sum of positive credit_transactions
  totalSpent: number       // absolute sum of negative credit_transactions
  outstanding: number      // sum of credit_balances.balance_fcfa
  totalReferrals: number   // profiles with referred_by NOT NULL
  topReferrers: Array<{
    userId: string
    name: string | null
    email: string | null
    referralCode: string | null
    count: number
  }>
}

export function useReferralAnalytics() {
  return useQuery({
    queryKey: ['referral-analytics'],
    queryFn: async (): Promise<ReferralAnalytics> => {
      // Sums via dedicated queries. We use head:true to keep payload small.
      const [issuedRes, spentRes, outstandingRes, totalRefsRes, referrersRes] = await Promise.all([
        // Sum of positive deltas (earnings)
        supabase
          .from('credit_transactions')
          .select('delta_fcfa')
          .gt('delta_fcfa', 0),
        supabase
          .from('credit_transactions')
          .select('delta_fcfa')
          .lt('delta_fcfa', 0),
        supabase
          .from('credit_balances')
          .select('balance_fcfa'),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .not('referred_by', 'is', null),
        // Group referrals by referrer_id client-side (Supabase JS doesn't
        // expose GROUP BY directly without an RPC). Bounded volume in MVP.
        supabase
          .from('profiles')
          .select(`
            referred_by,
            referrer:profiles!profiles_referred_by_fkey ( id, full_name, email, referral_code )
          `)
          .not('referred_by', 'is', null),
      ])

      const totalIssued = (issuedRes.data ?? []).reduce((s, r: any) => s + (r.delta_fcfa ?? 0), 0)
      const totalSpent  = (spentRes.data ?? []).reduce((s, r: any) => s + Math.abs(r.delta_fcfa ?? 0), 0)
      const outstanding = (outstandingRes.data ?? []).reduce((s, r: any) => s + (r.balance_fcfa ?? 0), 0)
      const totalReferrals = totalRefsRes.count ?? 0

      const counts = new Map<string, { userId: string; name: string | null; email: string | null; referralCode: string | null; count: number }>()
      for (const row of (referrersRes.data ?? []) as any[]) {
        const r = row.referrer
        if (!r?.id) continue
        const cur = counts.get(r.id) ?? {
          userId: r.id,
          name: r.full_name ?? null,
          email: r.email ?? null,
          referralCode: r.referral_code ?? null,
          count: 0,
        }
        cur.count += 1
        counts.set(r.id, cur)
      }
      const topReferrers = Array.from(counts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      return { totalIssued, totalSpent, outstanding, totalReferrals, topReferrers }
    },
    staleTime: 30_000,
  })
}

// ─── Admin global activity feed ─────────────────────────────────────
// Last N credit transactions + coupon redemptions across the whole platform,
// joined with profile + place info. Used by /admin/activity.
export interface AdminActivityItem {
  id: string
  ts: string
  kind: UserActivityKind
  userName: string | null
  userEmail: string | null
  amountFcfa: number
  placeName: string | null
  couponTitle: string | null
  billAmount: number | null
  discountApplied: number | null
}

export function useAdminActivity(limit = 50) {
  return useQuery({
    queryKey: ['admin-activity', limit],
    queryFn: async (): Promise<AdminActivityItem[]> => {
      const [txRes, redRes] = await Promise.all([
        supabase
          .from('credit_transactions')
          .select(`
            id,
            user_id,
            delta_fcfa,
            reason,
            created_at,
            place:places ( name )
          `)
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('coupon_redemptions')
          .select(`
            id,
            user_id,
            redeemed_at,
            bill_amount,
            discount_applied,
            place:places!coupon_redemptions_place_id_fkey ( name ),
            coupon:coupons!inner ( title_fr )
          `)
          .not('redeemed_at', 'is', null)
          .order('redeemed_at', { ascending: false })
          .limit(limit),
      ])
      if (txRes.error) throw txRes.error
      if (redRes.error) throw redRes.error

      const userIds = Array.from(new Set([
        ...((txRes.data ?? []) as any[]).map(r => r.user_id),
        ...((redRes.data ?? []) as any[]).map(r => r.user_id).filter(Boolean),
      ]))
      let profiles: Record<string, { name: string | null; email: string | null }> = {}
      if (userIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds)
        for (const p of data ?? []) {
          profiles[p.id] = {
            name:  (p as any).full_name ?? null,
            email: (p as any).email ?? null,
          }
        }
      }

      const txItems: AdminActivityItem[] = ((txRes.data ?? []) as any[]).map(r => ({
        id: `tx:${r.id}`,
        ts: r.created_at,
        kind:
          r.reason === 'referral_signup' ? 'credit_earn_signup' :
          r.reason === 'referral_invite' ? 'credit_earn_invite' :
          r.reason === 'admin_adjust'    ? 'credit_earn_adjust' :
          'credit_spend',
        userName:  r.user_id ? profiles[r.user_id]?.name  ?? null : null,
        userEmail: r.user_id ? profiles[r.user_id]?.email ?? null : null,
        amountFcfa: r.delta_fcfa,
        placeName: r.place?.name ?? null,
        couponTitle: null,
        billAmount: null,
        discountApplied: null,
      }))

      const redItems: AdminActivityItem[] = ((redRes.data ?? []) as any[]).map(r => ({
        id: `red:${r.id}`,
        ts: r.redeemed_at,
        kind: 'coupon_redemption',
        userName:  r.user_id ? profiles[r.user_id]?.name  ?? null : null,
        userEmail: r.user_id ? profiles[r.user_id]?.email ?? null : null,
        amountFcfa: 0,
        placeName: r.place?.name ?? null,
        couponTitle: r.coupon?.title_fr ?? null,
        billAmount: r.bill_amount,
        discountApplied: r.discount_applied,
      }))

      return [...txItems, ...redItems]
        .sort((a, b) => b.ts.localeCompare(a.ts))
        .slice(0, limit)
    },
    staleTime: 10_000,
  })
}

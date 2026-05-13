import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

export interface Coupon {
  id: string
  // NULL = platform coupon (admin-issued, see coupon_places for scope)
  place_id: string | null
  title_fr: string
  title_en: string | null
  description_fr: string | null
  description_en: string | null
  starts_at: string
  expires_at: string
  max_redemptions_per_user: number
  max_total_redemptions: number | null
  discount_type: 'percentage' | 'amount' | null
  discount_value: number | null
  is_active: boolean
  is_system: boolean
  created_at: string
}

// All coupons (any state) for a place — used by the owner UI.
export function useCouponsForPlace(placeId: string | undefined) {
  return useQuery({
    queryKey: ['coupons', 'place', placeId],
    queryFn: async () => {
      if (!placeId) return [] as Coupon[]
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('place_id', placeId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Coupon[]
    },
    enabled: !!placeId,
  })
}

// Active coupons (started, not expired, is_active) for a place's detail
// page. Merges the place's own coupons with platform coupons that apply
// at this place — a platform coupon applies when either:
//   - it has zero coupon_places rows (= valid everywhere), or
//   - it has a coupon_places row referencing this place.
export function useActiveCouponsForPlace(placeId: string | undefined) {
  return useQuery({
    queryKey: ['coupons', 'place-active', placeId],
    queryFn: async () => {
      if (!placeId) return [] as Coupon[]
      const nowIso = new Date().toISOString()

      // Run the two queries in parallel: this place's own coupons + all
      // active platform coupons (place_id IS NULL). We filter the platform
      // results by scope below since Supabase doesn't expose a clean way
      // to express "no coupon_places rows OR matching row" server-side.
      const ownPromise = supabase
        .from('coupons')
        .select('*')
        .eq('place_id', placeId)
        .eq('is_active', true)
        .lte('starts_at', nowIso)
        .gt('expires_at', nowIso)
        .order('expires_at', { ascending: true })

      const platformPromise = supabase
        .from('coupons')
        .select('*')
        .is('place_id', null)
        .eq('is_active', true)
        .lte('starts_at', nowIso)
        .gt('expires_at', nowIso)
        .order('expires_at', { ascending: true })

      const [ownRes, platformRes] = await Promise.all([ownPromise, platformPromise])
      if (ownRes.error) throw ownRes.error
      if (platformRes.error) throw platformRes.error

      const platformIds = ((platformRes.data ?? []) as Coupon[]).map(c => c.id)
      let allowedPlatform: Coupon[] = []
      if (platformIds.length > 0) {
        // For each platform coupon, determine whether it's "everywhere" or
        // scoped. One query against the join table is plenty here.
        const { data: scopeRows } = await supabase
          .from('coupon_places')
          .select('coupon_id, place_id')
          .in('coupon_id', platformIds)
        type Scope = { coupon_id: string; place_id: string }
        const scopeMap = new Map<string, Set<string>>()
        for (const r of (scopeRows ?? []) as Scope[]) {
          if (!scopeMap.has(r.coupon_id)) scopeMap.set(r.coupon_id, new Set())
          scopeMap.get(r.coupon_id)!.add(r.place_id)
        }
        allowedPlatform = (platformRes.data as Coupon[]).filter(c => {
          const scope = scopeMap.get(c.id)
          if (!scope || scope.size === 0) return true  // valid everywhere
          return scope.has(placeId)
        })
      }

      return [
        ...((ownRes.data ?? []) as Coupon[]),
        ...allowedPlatform,
      ]
    },
    enabled: !!placeId,
    staleTime: 30_000,
  })
}

interface CouponInput {
  place_id: string
  title_fr: string
  title_en?: string | null
  description_fr?: string | null
  description_en?: string | null
  starts_at?: string  // ISO; defaults to now() server-side
  expires_at: string  // ISO
  max_redemptions_per_user?: number
  max_total_redemptions?: number | null
  discount_type?: 'percentage' | 'amount' | null
  discount_value?: number | null
  is_active?: boolean
}

export function useCreateCoupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CouponInput) => {
      const { error } = await supabase.from('coupons').insert({
        place_id: input.place_id,
        title_fr: input.title_fr,
        title_en: input.title_en ?? null,
        description_fr: input.description_fr ?? null,
        description_en: input.description_en ?? null,
        starts_at: input.starts_at,
        expires_at: input.expires_at,
        max_redemptions_per_user: input.max_redemptions_per_user ?? 1,
        max_total_redemptions: input.max_total_redemptions ?? null,
        discount_type: input.discount_type ?? null,
        discount_value: input.discount_value ?? null,
        is_active: input.is_active ?? true,
        is_system: false,
      })
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['coupons', 'place', vars.place_id] })
      qc.invalidateQueries({ queryKey: ['coupons', 'place-active', vars.place_id] })
    },
  })
}

export function useUpdateCoupon(placeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { id: string; patch: Partial<CouponInput> & { is_active?: boolean } }) => {
      const { error } = await supabase
        .from('coupons')
        .update(args.patch as any)
        .eq('id', args.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coupons', 'place', placeId] })
      qc.invalidateQueries({ queryKey: ['coupons', 'place-active', placeId] })
    },
  })
}

export function useDeleteCoupon(placeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('coupons').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coupons', 'place', placeId] })
      qc.invalidateQueries({ queryKey: ['coupons', 'place-active', placeId] })
    },
  })
}

// ─── Admin: paginated cross-place coupon list ─────────────────────
export type AdminCouponFilter = 'all' | 'live' | 'inactive' | 'expired' | 'platform'

export interface AdminCouponRow extends Coupon {
  placeName: string | null   // null for platform coupons valid everywhere
  scopeKind: 'single' | 'platform_all' | 'platform_subset'
  scopePlaceCount: number    // 0 for single/all, N for subset
  redeemedCount: number
  generatedCount: number
}

export function useAdminCoupons(args: {
  page: number
  perPage?: number
  search?: string
  filter?: AdminCouponFilter
}) {
  const { page, perPage = 25, search = '', filter = 'all' } = args
  const nowIso = new Date().toISOString()
  return useQuery({
    queryKey: ['admin-coupons', page, perPage, search.trim().toLowerCase(), filter],
    queryFn: async () => {
      let q = supabase
        .from('coupons')
        .select('*, places(name)', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (filter === 'live')     q = q.eq('is_active', true).lte('starts_at', nowIso).gt('expires_at', nowIso)
      if (filter === 'inactive') q = q.eq('is_active', false)
      if (filter === 'expired')  q = q.lt('expires_at', nowIso)
      if (filter === 'platform') q = q.is('place_id', null)

      // Server-side title search; place-name search is post-filter below
      const s = search.trim()
      if (s) q = q.or(`title_fr.ilike.%${s}%,title_en.ilike.%${s}%`)

      const from = page * perPage
      const to   = from + perPage - 1
      q = q.range(from, to)

      const { data, error, count } = await q
      if (error) throw error

      type Row = Coupon & { places: { name: string } | null }
      const rows = (data ?? []) as unknown as Row[]
      const couponIds = rows.map(r => r.id)

      // Aggregate redemption counts in a single query
      let redByCoupon = new Map<string, { generated: number; redeemed: number }>()
      if (couponIds.length > 0) {
        const { data: red } = await supabase
          .from('coupon_redemptions')
          .select('coupon_id, redeemed_at')
          .in('coupon_id', couponIds)
        for (const r of (red ?? []) as { coupon_id: string; redeemed_at: string | null }[]) {
          const cur = redByCoupon.get(r.coupon_id) ?? { generated: 0, redeemed: 0 }
          cur.generated += 1
          if (r.redeemed_at) cur.redeemed += 1
          redByCoupon.set(r.coupon_id, cur)
        }
      }

      // Platform-coupon scope sizes
      const platformIds = rows.filter(r => r.place_id === null).map(r => r.id)
      let scopeCount = new Map<string, number>()
      if (platformIds.length > 0) {
        const { data: scope } = await supabase
          .from('coupon_places')
          .select('coupon_id')
          .in('coupon_id', platformIds)
        for (const r of (scope ?? []) as { coupon_id: string }[]) {
          scopeCount.set(r.coupon_id, (scopeCount.get(r.coupon_id) ?? 0) + 1)
        }
      }

      const mapped: AdminCouponRow[] = rows.map(r => {
        const counts = redByCoupon.get(r.id) ?? { generated: 0, redeemed: 0 }
        const isPlatform = r.place_id === null
        const scopeN = isPlatform ? (scopeCount.get(r.id) ?? 0) : 0
        return {
          ...r,
          placeName: isPlatform ? null : (r.places?.name ?? null),
          scopeKind: isPlatform
            ? (scopeN === 0 ? 'platform_all' : 'platform_subset')
            : 'single',
          scopePlaceCount: scopeN,
          redeemedCount: counts.redeemed,
          generatedCount: counts.generated,
        }
      })

      // Optional client-side place-name substring filter (server query
      // already handled title; restaurant name lives on joined table)
      const filtered = s
        ? mapped.filter(r => {
            const blob = `${r.title_fr} ${r.title_en ?? ''} ${r.placeName ?? ''}`.toLowerCase()
            return blob.includes(s.toLowerCase())
          })
        : mapped

      return {
        rows: filtered,
        totalCount: count ?? 0,
        hasMore: (count ?? 0) > to + 1,
      }
    },
    staleTime: 10_000,
  })
}

// ─── Admin: create a platform coupon (place_id NULL) ──────────────
interface PlatformCouponInput {
  title_fr: string
  title_en?: string | null
  description_fr?: string | null
  description_en?: string | null
  starts_at?: string
  expires_at: string
  max_redemptions_per_user?: number
  max_total_redemptions?: number | null
  discount_type?: 'percentage' | 'amount' | null
  discount_value?: number | null
  is_active?: boolean
  /**
   * Empty array = valid at every place.
   * Non-empty = valid only at the listed places.
   */
  scope_place_ids: string[]
}

export function useCreatePlatformCoupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: PlatformCouponInput) => {
      const { data: created, error } = await supabase
        .from('coupons')
        .insert({
          place_id: null,
          title_fr: input.title_fr,
          title_en: input.title_en ?? null,
          description_fr: input.description_fr ?? null,
          description_en: input.description_en ?? null,
          starts_at: input.starts_at,
          expires_at: input.expires_at,
          max_redemptions_per_user: input.max_redemptions_per_user ?? 1,
          max_total_redemptions: input.max_total_redemptions ?? null,
          discount_type: input.discount_type ?? null,
          discount_value: input.discount_value ?? null,
          is_active: input.is_active ?? true,
          is_system: true,
        })
        .select('id')
        .single()
      if (error) throw error
      const couponId = (created as { id: string }).id

      if (input.scope_place_ids.length > 0) {
        const { error: sErr } = await supabase
          .from('coupon_places')
          .insert(input.scope_place_ids.map(pid => ({ coupon_id: couponId, place_id: pid })))
        if (sErr) {
          // Roll back the parent row so we don't leave an unscoped coupon orphan
          await supabase.from('coupons').delete().eq('id', couponId)
          throw sErr
        }
      }
      return { id: couponId }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] })
      qc.invalidateQueries({ queryKey: ['coupons'] })
    },
  })
}

export function useDeletePlatformCoupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (couponId: string) => {
      const { error } = await supabase.from('coupons').delete().eq('id', couponId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] })
      qc.invalidateQueries({ queryKey: ['coupons'] })
    },
  })
}

// Lightweight list of every place for the scope picker
export function useAllPlacesLite() {
  return useQuery({
    queryKey: ['admin-places-lite'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('places')
        .select('id, name')
        .eq('is_deleted', false)
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []) as Array<{ id: string; name: string }>
    },
    staleTime: 60_000,
  })
}

// Whether the user owns a place (for restaurant-admin gating)
export function useOwnedPlaceId() {
  const { session } = useSession()
  return useQuery({
    queryKey: ['owned-place-id', session?.user.id],
    queryFn: async () => {
      if (!session) return null
      const { data } = await supabase
        .from('places')
        .select('id')
        .eq('owner_id', session.user.id)
        .eq('is_deleted', false)
        .maybeSingle()
      return (data?.id as string | undefined) ?? null
    },
    enabled: !!session,
  })
}

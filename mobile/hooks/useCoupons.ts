import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

export interface Coupon {
  id: string
  place_id: string
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

// Active coupons (started, not expired, is_active) — used on the public detail page.
export function useActiveCouponsForPlace(placeId: string | undefined) {
  return useQuery({
    queryKey: ['coupons', 'place-active', placeId],
    queryFn: async () => {
      if (!placeId) return [] as Coupon[]
      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('place_id', placeId)
        .eq('is_active', true)
        .lte('starts_at', nowIso)
        .gt('expires_at', nowIso)
        .order('expires_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as Coupon[]
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

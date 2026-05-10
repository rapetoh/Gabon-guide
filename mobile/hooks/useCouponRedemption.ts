import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

export interface CouponRedemption {
  id: string
  coupon_id: string
  user_id: string | null
  redemption_code: string
  redeemed_at: string | null
  created_at: string
}

// 8-char alphanumeric code, omitting confusable chars
function generateCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length))
  }
  return out
}

// Encode a redemption as a QR payload. Keeps the format opaque so we can
// evolve it without breaking older app versions: prefix + version + json.
export function encodeQrPayload(args: { couponId: string; code: string }): string {
  return `okili:c:1:${args.couponId}:${args.code}`
}

export function decodeQrPayload(raw: string): { couponId: string; code: string } | null {
  const m = raw.match(/^okili:c:1:([0-9a-f-]{36}):([A-Z0-9]{8})$/)
  if (!m) return null
  return { couponId: m[1], code: m[2] }
}

// User-side: fetch the user's existing redemption for a coupon, if any.
export function useUserRedemption(couponId: string | undefined) {
  const { session } = useSession()
  return useQuery({
    queryKey: ['redemption', couponId, session?.user.id],
    queryFn: async () => {
      if (!couponId || !session) return null
      const { data, error } = await supabase
        .from('coupon_redemptions')
        .select('*')
        .eq('coupon_id', couponId)
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (error) throw error
      return (data as CouponRedemption | null) ?? null
    },
    enabled: !!couponId && !!session,
  })
}

// User-side: lazily generate (or return existing) redemption row + its QR string.
export function useStartRedemption() {
  const { session } = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (couponId: string): Promise<CouponRedemption> => {
      if (!session) throw new Error('Not authenticated')

      // Reuse an existing unredeemed row if it exists
      const { data: existing } = await supabase
        .from('coupon_redemptions')
        .select('*')
        .eq('coupon_id', couponId)
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (existing) return existing as CouponRedemption

      // Otherwise create one
      const code = generateCode()
      const { data, error } = await supabase
        .from('coupon_redemptions')
        .insert({
          coupon_id: couponId,
          user_id: session.user.id,
          redemption_code: code,
        })
        .select('*')
        .single()
      if (error) throw error
      return data as CouponRedemption
    },
    onSuccess: (_, couponId) => {
      qc.invalidateQueries({ queryKey: ['redemption', couponId, session?.user.id] })
    },
  })
}

// Owner-side: mark a redemption as redeemed.
// We look up by (coupon_id, redemption_code) — globally unique enough,
// the user_id+coupon+code triple is enforced by the schema's UNIQUE constraint.
export function useRedeemCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { couponId: string; code: string }) => {
      // Find the redemption row
      const { data: existing, error: findErr } = await supabase
        .from('coupon_redemptions')
        .select('id, redeemed_at, coupon_id, user_id')
        .eq('coupon_id', args.couponId)
        .eq('redemption_code', args.code)
        .maybeSingle()
      if (findErr) throw findErr
      if (!existing) throw new Error('Coupon code not found')
      if (existing.redeemed_at) throw new Error('ALREADY_REDEEMED')

      const { error: updErr } = await supabase
        .from('coupon_redemptions')
        .update({ redeemed_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (updErr) throw updErr

      return { redemptionId: existing.id }
    },
    onSuccess: () => {
      // Owner-side queries will refetch lists with redeemed_at populated
      qc.invalidateQueries({ queryKey: ['coupon-redemptions'] })
    },
  })
}

// Owner-side: list redemptions for a coupon (recent first), used in the dashboard.
export function useCouponRedemptions(couponId: string | undefined) {
  return useQuery({
    queryKey: ['coupon-redemptions', couponId],
    queryFn: async () => {
      if (!couponId) return [] as CouponRedemption[]
      const { data, error } = await supabase
        .from('coupon_redemptions')
        .select('*')
        .eq('coupon_id', couponId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as CouponRedemption[]
    },
    enabled: !!couponId,
  })
}

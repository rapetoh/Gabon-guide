import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

export interface CouponRedemption {
  id: string
  coupon_id: string
  user_id: string | null
  redemption_code: string
  redeemed_at: string | null
  bill_amount: number | null
  discount_applied: number | null
  created_at: string
}

// ─── QR encode / decode ─────────────────────────────────────────────
// Two payload kinds today, both non-URL so iOS native Camera doesn't try to
// deep-link them. Coupon QR = a specific redemption code. Credit QR = the
// user's identity so the scanner can pull their welcome-credit balance into
// the current redemption session.

function generateCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length))
  }
  return out
}

export function encodeQrPayload(args: { couponId: string; code: string }): string {
  return `OKILI|1|${args.couponId}|${args.code}`
}

export function encodeCreditQrPayload(args: { userId: string }): string {
  return `OKILI|CREDIT|1|${args.userId}`
}

export type ScanPayload =
  | { kind: 'coupon'; couponId: string; code: string }
  | { kind: 'credit'; userId: string }

export function decodeScanPayload(raw: string): ScanPayload | null {
  let m = raw.match(/^OKILI\|1\|([0-9a-f-]{36})\|([A-Z0-9]{8})$/)
  if (m) return { kind: 'coupon', couponId: m[1], code: m[2] }
  m = raw.match(/^OKILI\|CREDIT\|1\|([0-9a-f-]{36})$/)
  if (m) return { kind: 'credit', userId: m[1] }
  // Legacy coupon-only format from early Step 7 builds.
  m = raw.match(/^okili:c:1:([0-9a-f-]{36}):([A-Z0-9]{8})$/)
  if (m) return { kind: 'coupon', couponId: m[1], code: m[2] }
  return null
}

// Legacy single-coupon decoder kept for any consumer that still uses it.
export function decodeQrPayload(raw: string): { couponId: string; code: string } | null {
  const p = decodeScanPayload(raw)
  return p && p.kind === 'coupon' ? { couponId: p.couponId, code: p.code } : null
}

// ─── Error keys thrown from the redemption flow ─────────────────────
export const REDEMPTION_ERRORS = {
  COUPON_SOLD_OUT: 'COUPON_SOLD_OUT',
  PER_USER_LIMIT_REACHED: 'PER_USER_LIMIT_REACHED',
  ALREADY_REDEEMED: 'ALREADY_REDEEMED',
  CODE_NOT_FOUND: 'CODE_NOT_FOUND',
  COUPON_INACTIVE_OR_EXPIRED: 'COUPON_INACTIVE_OR_EXPIRED',
  MIXED_CUSTOMERS: 'MIXED_CUSTOMERS',
  WRONG_PLACE: 'WRONG_PLACE',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  INVALID_BILL: 'INVALID_BILL',
} as const

// ─── Per-coupon usage counts (used by owner + user UIs) ─────────────
export function useCouponUsage(couponId: string | undefined) {
  const { session } = useSession()
  return useQuery({
    queryKey: ['coupon-usage', couponId, session?.user.id],
    queryFn: async () => {
      if (!couponId) return null
      const { data: coupon, error: cErr } = await supabase
        .from('coupons')
        .select('max_total_redemptions, max_redemptions_per_user')
        .eq('id', couponId)
        .maybeSingle()
      if (cErr) throw cErr
      if (!coupon) return null

      const totalQ = supabase
        .from('coupon_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('coupon_id', couponId)
        .not('redeemed_at', 'is', null)

      const userQ = session
        ? supabase
            .from('coupon_redemptions')
            .select('id', { count: 'exact', head: true })
            .eq('coupon_id', couponId)
            .eq('user_id', session.user.id)
            .not('redeemed_at', 'is', null)
        : null

      const [totalRes, userRes] = await Promise.all([
        totalQ,
        userQ ?? Promise.resolve({ count: 0, error: null } as const),
      ])
      if (totalRes.error) throw totalRes.error
      if (userRes && 'error' in userRes && userRes.error) throw userRes.error

      const totalRedeemed = totalRes.count ?? 0
      const userRedeemed  = userRes?.count ?? 0
      const maxTotal      = coupon.max_total_redemptions
      const maxPerUser    = coupon.max_redemptions_per_user

      return {
        totalRedeemed,
        userRedeemed,
        maxTotal,
        maxPerUser,
        isSoldOut: maxTotal !== null && totalRedeemed >= maxTotal,
        userLimitReached: userRedeemed >= maxPerUser,
      }
    },
    enabled: !!couponId,
    staleTime: 5_000,
  })
}

// User's most recent unredeemed redemption for a specific coupon — used by
// CouponQrModal to detect whether to surface an existing open QR before
// minting a new one.
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
        .is('redeemed_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return (data as CouponRedemption | null) ?? null
    },
    enabled: !!couponId && !!session,
  })
}

// Most-recently redeemed row for this (user, coupon) — used for "Last used"
// display on the user's coupon card.
export function useLastUserRedemption(couponId: string | undefined) {
  const { session } = useSession()
  return useQuery({
    queryKey: ['redemption-last', couponId, session?.user.id],
    queryFn: async () => {
      if (!couponId || !session) return null
      const { data, error } = await supabase
        .from('coupon_redemptions')
        .select('*')
        .eq('coupon_id', couponId)
        .eq('user_id', session.user.id)
        .not('redeemed_at', 'is', null)
        .order('redeemed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return (data as CouponRedemption | null) ?? null
    },
    enabled: !!couponId && !!session,
  })
}

// User-side: generate or return an existing unredeemed row, enforcing
// quotas up front so we don't mint codes that can never be redeemed.
export function useStartRedemption() {
  const { session } = useSession()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (couponId: string): Promise<CouponRedemption> => {
      if (!session) throw new Error('Not authenticated')

      const { data: openRow } = await supabase
        .from('coupon_redemptions')
        .select('*')
        .eq('coupon_id', couponId)
        .eq('user_id', session.user.id)
        .is('redeemed_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (openRow) return openRow as CouponRedemption

      const { data: coupon, error: cErr } = await supabase
        .from('coupons')
        .select('is_active, expires_at, starts_at, max_total_redemptions, max_redemptions_per_user')
        .eq('id', couponId)
        .maybeSingle()
      if (cErr) throw cErr
      if (!coupon) throw new Error(REDEMPTION_ERRORS.CODE_NOT_FOUND)

      const now = Date.now()
      if (!coupon.is_active
          || new Date(coupon.starts_at).getTime() > now
          || new Date(coupon.expires_at).getTime() <= now) {
        throw new Error(REDEMPTION_ERRORS.COUPON_INACTIVE_OR_EXPIRED)
      }

      if (coupon.max_total_redemptions !== null) {
        const { count, error } = await supabase
          .from('coupon_redemptions')
          .select('id', { count: 'exact', head: true })
          .eq('coupon_id', couponId)
          .not('redeemed_at', 'is', null)
        if (error) throw error
        if ((count ?? 0) >= coupon.max_total_redemptions) {
          throw new Error(REDEMPTION_ERRORS.COUPON_SOLD_OUT)
        }
      }

      const { count: userCount, error: userErr } = await supabase
        .from('coupon_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('coupon_id', couponId)
        .eq('user_id', session.user.id)
        .not('redeemed_at', 'is', null)
      if (userErr) throw userErr
      if ((userCount ?? 0) >= coupon.max_redemptions_per_user) {
        throw new Error(REDEMPTION_ERRORS.PER_USER_LIMIT_REACHED)
      }

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
      qc.invalidateQueries({ queryKey: ['coupon-usage', couponId, session?.user.id] })
      qc.invalidateQueries({ queryKey: ['my-coupons', session?.user.id] })
    },
  })
}

// ─── My coupons (cross-place, user-side) ────────────────────────────
// Every unredeemed coupon the current user holds, joined with coupon +
// place metadata so we can render a list on the profile screen. Closes the
// discoverability gap for any reward that lands in the user's wallet
// without them having opened the place page.
export interface MyCouponEntry {
  redemptionId: string
  redemptionCode: string
  couponId: string
  // null = platform coupon, valid at any place (or any place in its scope)
  placeId: string | null
  placeName: string | null
  titleFr: string
  titleEn: string | null
  descriptionFr: string | null
  descriptionEn: string | null
  discountType: 'percentage' | 'amount' | null
  discountValue: number | null
  expiresAt: string
  isPlatform: boolean
  /** Platform coupons only: names of the places the coupon is scoped to
   *  (via coupon_places). Empty = valid at every restaurant. */
  scopePlaceNames: string[]
  /** Storage path of the place's primary photo (place-photos bucket).
   *  null for platform coupons and places without photos. */
  photoPath: string | null
}

export function useMyCoupons() {
  const { session } = useSession()
  return useQuery({
    queryKey: ['my-coupons', session?.user.id],
    queryFn: async (): Promise<MyCouponEntry[]> => {
      if (!session) return []
      const nowIso = new Date().toISOString()
      // Left-join on places so platform coupons (place_id NULL) are included.
      // The FK name on the embedding is explicit because migration 020
      // introduced a second path coupons ↔ places via coupon_places.
      const { data, error } = await supabase
        .from('coupon_redemptions')
        .select(`
          id,
          redemption_code,
          coupon:coupons!inner (
            id,
            title_fr,
            title_en,
            description_fr,
            description_en,
            discount_type,
            discount_value,
            expires_at,
            is_active,
            starts_at,
            place_id,
            place:places!coupons_place_id_fkey (
              id, name,
              photos ( storage_path, is_primary, is_deleted )
            )
          )
        `)
        .eq('user_id', session.user.id)
        .is('redeemed_at', null)
        .eq('coupon.is_active', true)
        .lte('coupon.starts_at', nowIso)
        .gt('coupon.expires_at', nowIso)
      if (error) throw error

      type Row = {
        id: string
        redemption_code: string
        coupon: {
          id: string
          title_fr: string
          title_en: string | null
          description_fr: string | null
          description_en: string | null
          discount_type: 'percentage' | 'amount' | null
          discount_value: number | null
          expires_at: string
          is_active: boolean
          starts_at: string
          place_id: string | null
          place: {
            id: string
            name: string
            photos: { storage_path: string; is_primary: boolean; is_deleted: boolean }[] | null
          } | null
        } | null
      }
      const rows = (data ?? []) as unknown as Row[]

      // Platform coupons can be scoped to specific places via coupon_places.
      // Fetch the scope rows (joined to place names) in one query so the
      // wallet card can say "Valable chez : X, Y, Z" instead of wrongly
      // claiming the coupon works everywhere.
      const platformIds = rows
        .filter(r => r.coupon && r.coupon.place_id === null)
        .map(r => r.coupon!.id)
      const scopeNames = new Map<string, string[]>()
      if (platformIds.length > 0) {
        const { data: scopeRows, error: scopeErr } = await supabase
          .from('coupon_places')
          .select('coupon_id, place:places ( name )')
          .in('coupon_id', platformIds)
        if (scopeErr) throw scopeErr
        type ScopeRow = { coupon_id: string; place: { name: string } | null }
        for (const s of (scopeRows ?? []) as unknown as ScopeRow[]) {
          if (!s.place?.name) continue
          const list = scopeNames.get(s.coupon_id) ?? []
          list.push(s.place.name)
          scopeNames.set(s.coupon_id, list)
        }
      }

      return rows
        .filter(r => r.coupon)
        .map(r => {
          const isPlatform = r.coupon!.place_id === null
          const gallery = (r.coupon!.place?.photos ?? []).filter(p => !p.is_deleted)
          const photo = gallery.find(p => p.is_primary) ?? gallery[0]
          return {
            redemptionId: r.id,
            redemptionCode: r.redemption_code,
            couponId: r.coupon!.id,
            placeId:   isPlatform ? null : (r.coupon!.place?.id ?? null),
            placeName: isPlatform ? null : (r.coupon!.place?.name ?? null),
            titleFr: r.coupon!.title_fr,
            titleEn: r.coupon!.title_en,
            descriptionFr: r.coupon!.description_fr,
            descriptionEn: r.coupon!.description_en,
            discountType: r.coupon!.discount_type,
            discountValue: r.coupon!.discount_value,
            expiresAt: r.coupon!.expires_at,
            isPlatform,
            scopePlaceNames: isPlatform ? (scopeNames.get(r.coupon!.id) ?? []) : [],
            photoPath: isPlatform ? null : (photo?.storage_path ?? null),
          }
        })
        .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
    },
    enabled: !!session,
    staleTime: 30_000,
  })
}

// ─── Owner-side: scanner session helpers ────────────────────────────
// When the owner scans a coupon QR, look up the redemption + coupon + place
// + customer profile so the session item can render with full context.
export interface ScannedCouponDetails {
  redemptionId: string
  couponId: string
  couponTitleFr: string
  couponTitleEn: string | null
  discountType: 'percentage' | 'amount' | null
  discountValue: number | null
  placeId: string
  userId: string
  customerName: string | null
  customerEmail: string | null
  alreadyRedeemed: boolean
  redeemedAt: string | null
  // Set when the coupon is currently inactive / expired, otherwise null.
  inactiveReason: 'inactive' | 'expired' | 'not_started' | null
}

export async function fetchCouponScanDetails(args: {
  couponId: string
  code: string
}): Promise<ScannedCouponDetails | null> {
  const { data: row, error: rErr } = await supabase
    .from('coupon_redemptions')
    .select(`
      id,
      user_id,
      redeemed_at,
      coupon:coupons!inner (
        id,
        title_fr,
        title_en,
        discount_type,
        discount_value,
        is_active,
        starts_at,
        expires_at,
        place_id
      )
    `)
    .eq('coupon_id', args.couponId)
    .eq('redemption_code', args.code)
    .maybeSingle()
  if (rErr) throw rErr
  if (!row) return null
  type R = typeof row & {
    coupon: {
      id: string
      title_fr: string
      title_en: string | null
      discount_type: 'percentage' | 'amount' | null
      discount_value: number | null
      is_active: boolean
      starts_at: string
      expires_at: string
      place_id: string
    }
  }
  const r = row as unknown as R

  let customerName: string | null = null
  let customerEmail: string | null = null
  if (r.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', r.user_id)
      .maybeSingle()
    customerName  = profile?.full_name ?? null
    customerEmail = profile?.email ?? null
  }

  const now = Date.now()
  let inactiveReason: ScannedCouponDetails['inactiveReason'] = null
  if (!r.coupon.is_active) inactiveReason = 'inactive'
  else if (new Date(r.coupon.starts_at).getTime() > now) inactiveReason = 'not_started'
  else if (new Date(r.coupon.expires_at).getTime() <= now) inactiveReason = 'expired'

  return {
    redemptionId: r.id,
    couponId: r.coupon.id,
    couponTitleFr: r.coupon.title_fr,
    couponTitleEn: r.coupon.title_en,
    discountType: r.coupon.discount_type,
    discountValue: r.coupon.discount_value,
    placeId: r.coupon.place_id,
    userId: r.user_id ?? '',
    customerName,
    customerEmail,
    alreadyRedeemed: !!r.redeemed_at,
    redeemedAt: r.redeemed_at,
    inactiveReason,
  }
}

// Look up the customer's profile + credit balance from a credit QR scan.
export interface ScannedCreditDetails {
  userId: string
  customerName: string | null
  customerEmail: string | null
  creditBalance: number
}

export async function fetchCreditScanDetails(userId: string): Promise<ScannedCreditDetails | null> {
  // RLS blocks owners from reading other users' profiles/balances directly,
  // so the lookup goes through a SECURITY DEFINER RPC (migration 035) that
  // admits admins and place owners only.
  const { data, error } = await supabase.rpc('get_credit_scan_details', { p_user_id: userId })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null

  return {
    userId,
    customerName:  row.full_name ?? null,
    customerEmail: row.email ?? null,
    creditBalance: row.balance_fcfa ?? 0,
  }
}

// Finalize a redemption session: array of coupon redemption rows + optional
// credit deduction against a single bill. The Postgres RPC validates +
// applies everything atomically; we just hand it the inputs.
export interface ApplySessionResult {
  bill_amount: number
  total_discount: number
  credit_used: number
  customer_pays: number
  lines: {
    redemption_id: string
    coupon_id: string
    bill_amount: number
    discount_applied: number
  }[]
}

export function useApplyRedemptionSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      userId: string
      redemptionIds: string[]
      creditToUse: number
      billAmount: number
      placeId: string
      // Stable per counter-session; lets the server reject a duplicate apply
      // when the first one succeeded but the response was lost (migration 036).
      idempotencyKey?: string
    }): Promise<ApplySessionResult> => {
      const { data, error } = await supabase.rpc('apply_redemption_session', {
        p_user_id: args.userId,
        p_redemption_ids: args.redemptionIds,
        p_credit_to_use: args.creditToUse,
        p_bill_amount: args.billAmount,
        p_place_id: args.placeId,
        p_idempotency_key: args.idempotencyKey,
      })
      if (error) throw error
      return data as unknown as ApplySessionResult
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['credit-balance', vars.userId] })
      qc.invalidateQueries({ queryKey: ['my-coupons', vars.userId] })
      qc.invalidateQueries({ queryKey: ['coupon-redemptions'] })
      for (const _id of vars.redemptionIds) {
        qc.invalidateQueries({ queryKey: ['redemption'] })
        qc.invalidateQueries({ queryKey: ['redemption-last'] })
        qc.invalidateQueries({ queryKey: ['coupon-usage'] })
      }
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

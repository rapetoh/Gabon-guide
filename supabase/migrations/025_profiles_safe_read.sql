-- Migration 025: lock down the over-permissive profiles read policy.
--
-- Problem (LOGIC_AUDIT 1.5): the live policy `profiles_public_read` has
-- `USING (true)`, which means any authenticated user could read every
-- column of every profile — email, is_admin, role, referral_code,
-- referred_by, preferred_zones, preferred_vibes, phone. That's a real
-- privacy + admin-enumeration + referral-graph leak.
--
-- Fix: replace the leaky policy with three narrower mechanisms.
--
--   1. A SECURITY DEFINER view `profiles_public(id, full_name, avatar_url)`
--      that anyone can read. App code reads name/avatar through this view
--      from now on. No sensitive columns exposed.
--
--   2. A new RLS policy `profiles_owner_read_customers` on the base
--      table — a restaurant owner can read full profile of any customer
--      who has redeemed a coupon at one of their places (so the owner
--      dashboard / scanner can show "Customer Jane Doe (jane@example.com)
--      redeemed your 10% off coupon").
--
--   3. A SECURITY DEFINER function `referral_code_exists(text)` for the
--      pre-signup code-validation check. Anonymous callers don't need to
--      touch the profiles table at all — they just learn yes/no.
--
-- Existing policies preserved:
--   - profiles_own_read (user reads own row)
--   - profiles_admin_read_all (admin reads everything)
--   - profiles_admin_update (admin writes)
--
-- App code changes paired with this migration:
--   - mobile/hooks/useReviews.ts            — fetch profile names via the view
--   - mobile/hooks/useActivity.ts (line 107) — referee names via the view
--   - mobile/hooks/useReferrals.ts          — code check via RPC
--
-- Owner-context activity reads (useActivity.useOwnerActivity,
-- useCouponRedemption.fetchCouponScanDetails / fetchCreditScanDetails)
-- continue to read the base profiles table — covered by the new
-- profiles_owner_read_customers policy.

-- ─── 1. The safe view ──────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = false) AS
SELECT id, full_name, avatar_url
FROM public.profiles;

COMMENT ON VIEW public.profiles_public IS
  'Safe public projection of profiles. Exposes only id, full_name, avatar_url. Use this from any non-admin, non-owner-of-customer context to display another user''s display name and avatar.';

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- ─── 2. Drop the over-permissive base-table policy ────────────────────

DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;

-- ─── 3. Owners can read profiles of customers who redeemed at their places ─

DROP POLICY IF EXISTS "profiles_owner_read_customers" ON public.profiles;
CREATE POLICY "profiles_owner_read_customers" ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.coupon_redemptions cr
      JOIN public.coupons c ON c.id = cr.coupon_id
      JOIN public.places   p ON p.id = c.place_id
      WHERE cr.user_id = profiles.id
        AND p.owner_id = auth.uid()
    )
  );

-- ─── 4. Public RPC to validate a referral code without exposing data ──

CREATE OR REPLACE FUNCTION public.referral_code_exists(p_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE referral_code = upper(trim(p_code))
  );
$$;

REVOKE ALL ON FUNCTION public.referral_code_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_code_exists(text) TO anon, authenticated;

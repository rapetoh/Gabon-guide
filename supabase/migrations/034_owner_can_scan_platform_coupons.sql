-- Migration 034: owners can scan platform ("Promo O'Kili") coupons.
--
-- Flow verification (2026-07-12) found the counter flow broken for platform
-- coupons: the scanner's first step reads the coupon_redemptions row by
-- (coupon_id, redemption_code). The owner SELECT policy only matched
-- coupons joined to a place the caller owns — platform coupons have
-- place_id NULL, so the lookup returned zero rows and the scanner showed
-- "Code not found" for perfectly valid promos. (Admins were unaffected;
-- real restaurant owners were fully blocked.) Proven by simulation before
-- this fix: owner saw 0 rows for a valid platform redemption code.
--
-- Fix, mirroring the scope rules already enforced by
-- apply_redemption_session():
--   * a platform coupon with NO coupon_places rows is valid everywhere →
--     any place owner may read its redemption rows;
--   * a platform coupon WITH coupon_places rows is valid only at those
--     places → only owners of an in-scope place may read.
--
-- Same treatment for the customer-identity read at scan time:
-- owner_redeemed_customer() (used by the profiles owner-read policy) now
-- also matches when the customer holds a redemption of a platform coupon
-- in scope of the caller's place, or when a past redemption was applied
-- at the caller's place (coupon_redemptions.place_id, migration 021).
-- Rationale: an owner about to apply a discount for the customer standing
-- at their counter needs the same identity view they already get for
-- place-scoped coupons; exposure is limited to owners of in-scope places.

-- ─── A. coupon_redemptions owner read/update: add platform-scope branch ─

CREATE OR REPLACE FUNCTION public.owner_place_in_coupon_scope(p_coupon uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    -- caller owns at least one place...
    SELECT 1 FROM public.places pl
    WHERE pl.owner_id = auth.uid()
      AND pl.is_deleted = false
      AND (
        -- ...and the coupon is platform-wide (no scope rows = everywhere)
        (NOT EXISTS (SELECT 1 FROM public.coupon_places cp WHERE cp.coupon_id = p_coupon))
        -- ...or the caller's place is explicitly in scope
        OR EXISTS (SELECT 1 FROM public.coupon_places cp
                   WHERE cp.coupon_id = p_coupon AND cp.place_id = pl.id)
      )
  )
$$;

REVOKE ALL ON FUNCTION public.owner_place_in_coupon_scope(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_place_in_coupon_scope(uuid) TO authenticated;

DROP POLICY IF EXISTS "coupon_redemptions_owner_admin_read" ON public.coupon_redemptions;
CREATE POLICY "coupon_redemptions_owner_admin_read" ON public.coupon_redemptions
  FOR SELECT
  USING (
    is_admin()
    OR EXISTS (                                   -- place-scoped coupon at caller's place
      SELECT 1 FROM public.coupons c
      JOIN public.places p ON p.id = c.place_id
      WHERE c.id = coupon_redemptions.coupon_id
        AND p.owner_id = auth.uid()
    )
    OR EXISTS (                                   -- platform coupon in caller's scope
      SELECT 1 FROM public.coupons c
      WHERE c.id = coupon_redemptions.coupon_id
        AND c.place_id IS NULL
        AND public.owner_place_in_coupon_scope(c.id)
    )
  );

DROP POLICY IF EXISTS "coupon_redemptions_owner_admin_update" ON public.coupon_redemptions;
CREATE POLICY "coupon_redemptions_owner_admin_update" ON public.coupon_redemptions
  FOR UPDATE
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM public.coupons c
      JOIN public.places p ON p.id = c.place_id
      WHERE c.id = coupon_redemptions.coupon_id
        AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.coupons c
      WHERE c.id = coupon_redemptions.coupon_id
        AND c.place_id IS NULL
        AND public.owner_place_in_coupon_scope(c.id)
    )
  );

-- ─── B. Customer identity at scan time ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_redeemed_customer(p_profile uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    -- place-scoped coupon claims/redemptions at the caller's place
    EXISTS (
      SELECT 1
      FROM public.coupon_redemptions cr
      JOIN public.coupons c ON c.id = cr.coupon_id
      JOIN public.places  p ON p.id = c.place_id
      WHERE cr.user_id = p_profile
        AND p.owner_id = auth.uid()
    )
    -- redemptions APPLIED at the caller's place (incl. platform coupons)
    OR EXISTS (
      SELECT 1
      FROM public.coupon_redemptions cr
      JOIN public.places p ON p.id = cr.place_id
      WHERE cr.user_id = p_profile
        AND p.owner_id = auth.uid()
    )
    -- open platform-coupon claims in scope of the caller's place
    OR EXISTS (
      SELECT 1
      FROM public.coupon_redemptions cr
      JOIN public.coupons c ON c.id = cr.coupon_id
      WHERE cr.user_id = p_profile
        AND c.place_id IS NULL
        AND public.owner_place_in_coupon_scope(c.id)
    )
$$;

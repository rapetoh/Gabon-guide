-- Migration 038: give the admin the operational tools the audit found missing,
-- and stop destructive footguns.
--
-- 1. Admins couldn't delete an abusive/defamatory review — no policy existed.
-- 2. Admins couldn't grant/adjust user credit even though the ledger defines
--    reason='admin_adjust' and both activity feeds already render it.
-- 3. Deleting a coupon CASCADE-deleted its whole claim/redemption history
--    (while the mobile dialog promised the opposite). Now RESTRICT: coupons
--    with history must be deactivated instead; clean coupons still delete.
-- 4. Soft-deleting a place left its live coupons claimable/lingering in user
--    wallets. A trigger now deactivates them.
-- 5. Owners could 5-star review their own restaurant.

-- ─── 1. Admin review moderation ──────────────────────────────────────────

DROP POLICY IF EXISTS "reviews_admin_delete" ON public.reviews;
CREATE POLICY "reviews_admin_delete" ON public.reviews
  FOR DELETE
  USING (public.is_admin());

-- ─── 2. Admin credit adjustment ──────────────────────────────────────────

ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS note text;

CREATE OR REPLACE FUNCTION public.admin_adjust_credit(
  p_user_id uuid,
  p_delta   int,
  p_note    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;
  IF p_delta IS NULL OR p_delta = 0 THEN RAISE EXCEPTION 'INVALID_DELTA'; END IF;

  INSERT INTO public.credit_balances (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance_fcfa INTO v_balance
  FROM public.credit_balances WHERE user_id = p_user_id FOR UPDATE;

  IF v_balance + p_delta < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  UPDATE public.credit_balances
  SET balance_fcfa    = balance_fcfa + p_delta,
      lifetime_earned = lifetime_earned + GREATEST(p_delta, 0),
      updated_at      = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.credit_transactions (user_id, delta_fcfa, reason, note)
  VALUES (p_user_id, p_delta, 'admin_adjust', NULLIF(trim(p_note), ''));

  RETURN jsonb_build_object('ok', true, 'new_balance', v_balance + p_delta);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_credit(uuid, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credit(uuid, int, text) TO authenticated;

-- ─── 3. Coupon history is not deletable ──────────────────────────────────

ALTER TABLE public.coupon_redemptions
  DROP CONSTRAINT IF EXISTS coupon_redemptions_coupon_id_fkey;

ALTER TABLE public.coupon_redemptions
  ADD CONSTRAINT coupon_redemptions_coupon_id_fkey
  FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE RESTRICT;

-- ─── 4. Soft-deleting a place deactivates its coupons ────────────────────

CREATE OR REPLACE FUNCTION public.deactivate_coupons_on_place_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_deleted AND NOT OLD.is_deleted THEN
    UPDATE public.coupons SET is_active = false WHERE place_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS place_delete_deactivates_coupons ON public.places;
CREATE TRIGGER place_delete_deactivates_coupons
  AFTER UPDATE OF is_deleted ON public.places
  FOR EACH ROW
  EXECUTE FUNCTION public.deactivate_coupons_on_place_delete();

-- ─── 5. Owners can't review their own place ──────────────────────────────

DROP POLICY IF EXISTS "reviews_own_insert" ON public.reviews;
CREATE POLICY "reviews_own_insert" ON public.reviews
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND NOT public.is_blocked()
    AND NOT EXISTS (
      SELECT 1 FROM public.places p
      WHERE p.id = reviews.place_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reviews_own_update" ON public.reviews;
CREATE POLICY "reviews_own_update" ON public.reviews
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND NOT public.is_blocked()
    AND NOT EXISTS (
      SELECT 1 FROM public.places p
      WHERE p.id = reviews.place_id AND p.owner_id = auth.uid()
    )
  );

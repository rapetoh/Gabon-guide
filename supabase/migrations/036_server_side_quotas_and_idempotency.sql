-- Migration 036: close the money holes in the redemption path.
--
-- 1. Coupon quotas (max_total_redemptions, max_redemptions_per_user) were only
--    checked client-side at claim time — the RPC happily redeemed past both
--    caps, and a modified client could skip the checks entirely.
-- 2. Credit-only sessions had no idempotency: a lost response + retry deducted
--    the customer's credit twice (coupon sessions were protected by the
--    redeemed_at flip; pure-credit sessions had nothing).
-- 3. A place owner could redeem their own coupons/credit at their own counter
--    (self-dealing loop with referral credit). Admins stay exempt so the
--    founder can still demo/test.
-- 4. A zero bill silently consumed coupons for zero discount.
-- 5. RLS lets clients INSERT claim rows directly, so a hacked client could
--    insert pre-redeemed rows or claim past the per-user cap. A BEFORE INSERT
--    trigger now sanitizes and enforces claims server-side.

-- ─── 1-4. Rewritten apply_redemption_session ────────────────────────────
-- Signature gains p_idempotency_key (DEFAULT NULL keeps TestFlight build #7
-- clients working). The old 5-arg overload must be dropped or PostgREST
-- named-arg calls become ambiguous.

DROP FUNCTION IF EXISTS public.apply_redemption_session(uuid, uuid[], int, int, uuid);

CREATE FUNCTION public.apply_redemption_session(
  p_user_id          uuid,
  p_redemption_ids   uuid[],
  p_credit_to_use    int,
  p_bill_amount      int,
  p_place_id         uuid,
  p_idempotency_key  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller         uuid := auth.uid();
  v_is_admin       boolean;
  v_is_place_owner boolean;
  v_total_discount int := 0;
  v_credit_balance int;
  v_credit_apply   int := COALESCE(p_credit_to_use, 0);
  v_row            record;
  v_coupon         record;
  v_share          int;
  v_remaining      int;
  v_per_row_count  int;
  v_lines          jsonb := '[]'::jsonb;
  v_scope_count    int;
  v_redeemed_total int;
  v_redeemed_user  int;
  v_in_session     int;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_bill_amount IS NULL OR p_bill_amount < 0 THEN RAISE EXCEPTION 'INVALID_BILL'; END IF;

  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = v_caller;
  SELECT EXISTS (
    SELECT 1 FROM public.places
    WHERE id = p_place_id AND owner_id = v_caller AND is_deleted = false
  ) INTO v_is_place_owner;

  IF NOT v_is_place_owner AND NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  -- An owner cannot be their own customer (admins exempt for demos/tests).
  IF p_user_id = v_caller AND NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'SELF_REDEMPTION';
  END IF;

  -- Coupons against a zero bill would be consumed for zero discount.
  IF COALESCE(array_length(p_redemption_ids, 1), 0) > 0 AND p_bill_amount = 0 THEN
    RAISE EXCEPTION 'INVALID_BILL';
  END IF;

  -- Idempotency: the credit-spend transaction stores the key in ref_id, so a
  -- replayed session (response lost, owner retried) is rejected instead of
  -- deducting credit twice.
  IF p_idempotency_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.credit_transactions
    WHERE reason = 'redemption_session' AND ref_id = p_idempotency_key
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_SESSION';
  END IF;

  FOR v_row IN
    SELECT
      r.id           AS redemption_id,
      r.coupon_id,
      r.user_id,
      r.redeemed_at,
      c.discount_type,
      c.discount_value,
      c.is_active,
      c.starts_at,
      c.expires_at,
      c.place_id     AS coupon_place_id
    FROM public.coupon_redemptions r
    JOIN public.coupons c ON c.id = r.coupon_id
    WHERE r.id = ANY (p_redemption_ids)
    ORDER BY r.id
    FOR UPDATE OF r
  LOOP
    IF v_row.user_id IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'MIXED_CUSTOMERS'; END IF;
    IF v_row.redeemed_at IS NOT NULL THEN RAISE EXCEPTION 'ALREADY_REDEEMED'; END IF;
    IF NOT v_row.is_active OR v_row.starts_at > now() OR v_row.expires_at <= now() THEN
      RAISE EXCEPTION 'COUPON_INACTIVE_OR_EXPIRED';
    END IF;

    IF v_row.coupon_place_id IS NOT NULL THEN
      IF v_row.coupon_place_id IS DISTINCT FROM p_place_id THEN
        RAISE EXCEPTION 'WRONG_PLACE';
      END IF;
    ELSE
      SELECT count(*) INTO v_scope_count FROM public.coupon_places WHERE coupon_id = v_row.coupon_id;
      IF v_scope_count > 0 THEN
        IF NOT EXISTS (SELECT 1 FROM public.coupon_places WHERE coupon_id = v_row.coupon_id AND place_id = p_place_id) THEN
          RAISE EXCEPTION 'WRONG_PLACE';
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Quota enforcement, per distinct coupon in the session. Locking the coupon
  -- row serializes concurrent applies of the same coupon so the counts can't
  -- race past the caps.
  FOR v_coupon IN
    SELECT c.id, c.max_total_redemptions, c.max_redemptions_per_user
    FROM public.coupons c
    WHERE c.id IN (
      SELECT DISTINCT r.coupon_id FROM public.coupon_redemptions r
      WHERE r.id = ANY (p_redemption_ids)
    )
    ORDER BY c.id
    FOR UPDATE
  LOOP
    SELECT count(*) INTO v_in_session
    FROM public.coupon_redemptions r
    WHERE r.id = ANY (p_redemption_ids) AND r.coupon_id = v_coupon.id;

    IF v_coupon.max_total_redemptions IS NOT NULL THEN
      SELECT count(*) INTO v_redeemed_total
      FROM public.coupon_redemptions r
      WHERE r.coupon_id = v_coupon.id AND r.redeemed_at IS NOT NULL;
      IF v_redeemed_total + v_in_session > v_coupon.max_total_redemptions THEN
        RAISE EXCEPTION 'COUPON_SOLD_OUT';
      END IF;
    END IF;

    SELECT count(*) INTO v_redeemed_user
    FROM public.coupon_redemptions r
    WHERE r.coupon_id = v_coupon.id AND r.user_id = p_user_id AND r.redeemed_at IS NOT NULL;
    IF v_redeemed_user + v_in_session > COALESCE(v_coupon.max_redemptions_per_user, 1) THEN
      RAISE EXCEPTION 'PER_USER_LIMIT_REACHED';
    END IF;
  END LOOP;

  SELECT count(*) INTO v_per_row_count FROM public.coupon_redemptions WHERE id = ANY (p_redemption_ids);
  IF v_per_row_count <> COALESCE(array_length(p_redemption_ids, 1), 0) THEN
    RAISE EXCEPTION 'CODE_NOT_FOUND';
  END IF;

  IF v_per_row_count > 0 THEN v_share := (p_bill_amount / v_per_row_count);
  ELSE v_share := 0; END IF;

  v_remaining := p_bill_amount;

  FOR v_row IN
    SELECT r.id AS redemption_id, r.coupon_id, c.discount_type, c.discount_value
    FROM public.coupon_redemptions r
    JOIN public.coupons c ON c.id = r.coupon_id
    WHERE r.id = ANY (p_redemption_ids)
    ORDER BY r.id
  LOOP
    DECLARE v_disc int := 0;
    BEGIN
      IF v_row.discount_type = 'percentage' AND v_row.discount_value IS NOT NULL THEN
        v_disc := LEAST(v_share, (v_share * v_row.discount_value) / 100);
      ELSIF v_row.discount_type = 'amount' AND v_row.discount_value IS NOT NULL THEN
        v_disc := LEAST(v_share, v_row.discount_value);
      END IF;
      v_disc := LEAST(v_disc, v_remaining);
      v_remaining := v_remaining - v_disc;
      v_total_discount := v_total_discount + v_disc;
      UPDATE public.coupon_redemptions
      SET redeemed_at = now(),
          bill_amount = v_share,
          discount_applied = v_disc,
          place_id = p_place_id
      WHERE id = v_row.redemption_id;
      v_lines := v_lines || jsonb_build_object(
        'redemption_id', v_row.redemption_id,
        'coupon_id', v_row.coupon_id,
        'bill_amount', v_share,
        'discount_applied', v_disc
      );
    END;
  END LOOP;

  IF v_credit_apply > 0 THEN
    SELECT balance_fcfa INTO v_credit_balance FROM public.credit_balances WHERE user_id = p_user_id FOR UPDATE;
    IF v_credit_balance IS NULL THEN v_credit_balance := 0; END IF;
    v_credit_apply := LEAST(v_credit_apply, v_credit_balance, v_remaining);
    IF v_credit_apply > 0 THEN
      UPDATE public.credit_balances
      SET balance_fcfa = balance_fcfa - v_credit_apply, updated_at = now()
      WHERE user_id = p_user_id;
      INSERT INTO public.credit_transactions (user_id, delta_fcfa, reason, ref_id, place_id)
      VALUES (p_user_id, -v_credit_apply, 'redemption_session', p_idempotency_key, p_place_id);
    END IF;
    v_remaining := v_remaining - v_credit_apply;
  END IF;

  RETURN jsonb_build_object(
    'bill_amount', p_bill_amount,
    'total_discount', v_total_discount,
    'credit_used', v_credit_apply,
    'customer_pays', v_remaining,
    'lines', v_lines
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_redemption_session(uuid, uuid[], int, int, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_redemption_session(uuid, uuid[], int, int, uuid, uuid) TO authenticated;

-- ─── 5. Claim-side protection ────────────────────────────────────────────
-- RLS allows users to INSERT their own claim rows (the app's claim flow).
-- This trigger makes those inserts safe regardless of the client:
--   • state columns are forced clean (no pre-redeemed rows),
--   • per-user claim cap enforced,
--   • sold-out coupons can't be claimed.
-- Server-side contexts (auth triggers granting reward coupons: auth.uid() is
-- NULL) and admins are exempt from the caps but still get sanitized state.

CREATE OR REPLACE FUNCTION public.enforce_coupon_claim_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_coupon         record;
  v_redeemed_total int;
  v_user_claims    int;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- RLS restricts client inserts to user_id = auth.uid(); a row for someone
  -- else can only come from a trusted SECURITY DEFINER path (e.g. the
  -- referral reward-coupon grant) — let it through untouched.
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Client inserts can only ever create a fresh, unredeemed claim.
  NEW.redeemed_at      := NULL;
  NEW.bill_amount      := NULL;
  NEW.discount_applied := NULL;
  NEW.place_id         := NULL;

  SELECT c.max_total_redemptions, c.max_redemptions_per_user, c.is_active, c.expires_at
  INTO v_coupon
  FROM public.coupons c
  WHERE c.id = NEW.coupon_id;

  IF v_coupon IS NULL OR NOT v_coupon.is_active OR v_coupon.expires_at <= now() THEN
    RAISE EXCEPTION 'COUPON_INACTIVE_OR_EXPIRED';
  END IF;

  IF v_coupon.max_total_redemptions IS NOT NULL THEN
    SELECT count(*) INTO v_redeemed_total
    FROM public.coupon_redemptions r
    WHERE r.coupon_id = NEW.coupon_id AND r.redeemed_at IS NOT NULL;
    IF v_redeemed_total >= v_coupon.max_total_redemptions THEN
      RAISE EXCEPTION 'COUPON_SOLD_OUT';
    END IF;
  END IF;

  SELECT count(*) INTO v_user_claims
  FROM public.coupon_redemptions r
  WHERE r.coupon_id = NEW.coupon_id AND r.user_id = NEW.user_id;
  IF v_user_claims >= COALESCE(v_coupon.max_redemptions_per_user, 1) THEN
    RAISE EXCEPTION 'PER_USER_LIMIT_REACHED';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coupon_claim_limits ON public.coupon_redemptions;
CREATE TRIGGER coupon_claim_limits
  BEFORE INSERT ON public.coupon_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_coupon_claim_limits();

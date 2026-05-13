-- Migration 019: tag credit_transactions with the place where credit was spent.
--
-- Lets owner-side history queries cleanly answer "how much credit was used
-- at MY place" without having to derive it from session timestamps. Also
-- enables admin per-place credit reporting later.
--
-- place_id is only set for 'redemption_session' rows; signup/invite earnings
-- have no place context. The RPC is updated to pass p_place_id through.

ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS place_id uuid REFERENCES public.places(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS credit_transactions_place_idx
  ON public.credit_transactions (place_id)
  WHERE place_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_redemption_session(
  p_user_id          uuid,
  p_redemption_ids   uuid[],
  p_credit_to_use    int,
  p_bill_amount      int,
  p_place_id         uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller         uuid := auth.uid();
  v_is_admin       boolean;
  v_is_place_owner boolean;
  v_total_discount int := 0;
  v_credit_balance int;
  v_credit_apply   int := COALESCE(p_credit_to_use, 0);
  v_row            record;
  v_share          int;
  v_remaining      int;
  v_per_row_count  int;
  v_lines          jsonb := '[]'::jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_bill_amount IS NULL OR p_bill_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_BILL';
  END IF;

  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = v_caller;
  SELECT EXISTS (
    SELECT 1 FROM public.places
    WHERE id = p_place_id AND owner_id = v_caller AND is_deleted = false
  ) INTO v_is_place_owner;

  IF NOT v_is_place_owner AND NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
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
    IF v_row.user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'MIXED_CUSTOMERS';
    END IF;
    IF v_row.redeemed_at IS NOT NULL THEN
      RAISE EXCEPTION 'ALREADY_REDEEMED';
    END IF;
    IF NOT v_row.is_active
       OR v_row.starts_at > now()
       OR v_row.expires_at <= now() THEN
      RAISE EXCEPTION 'COUPON_INACTIVE_OR_EXPIRED';
    END IF;
    IF v_row.coupon_place_id IS DISTINCT FROM p_place_id THEN
      RAISE EXCEPTION 'WRONG_PLACE';
    END IF;
  END LOOP;

  SELECT count(*) INTO v_per_row_count
  FROM public.coupon_redemptions WHERE id = ANY (p_redemption_ids);
  IF v_per_row_count <> COALESCE(array_length(p_redemption_ids, 1), 0) THEN
    RAISE EXCEPTION 'CODE_NOT_FOUND';
  END IF;

  IF v_per_row_count > 0 THEN
    v_share := (p_bill_amount / v_per_row_count);
  ELSE
    v_share := 0;
  END IF;

  v_remaining := p_bill_amount;

  FOR v_row IN
    SELECT
      r.id           AS redemption_id,
      r.coupon_id,
      c.discount_type,
      c.discount_value
    FROM public.coupon_redemptions r
    JOIN public.coupons c ON c.id = r.coupon_id
    WHERE r.id = ANY (p_redemption_ids)
    ORDER BY r.id
  LOOP
    DECLARE
      v_disc int := 0;
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
      SET redeemed_at      = now(),
          bill_amount      = v_share,
          discount_applied = v_disc
      WHERE id = v_row.redemption_id;

      v_lines := v_lines || jsonb_build_object(
        'redemption_id',     v_row.redemption_id,
        'coupon_id',         v_row.coupon_id,
        'bill_amount',       v_share,
        'discount_applied',  v_disc
      );
    END;
  END LOOP;

  IF v_credit_apply > 0 THEN
    SELECT balance_fcfa INTO v_credit_balance
    FROM public.credit_balances WHERE user_id = p_user_id FOR UPDATE;

    IF v_credit_balance IS NULL THEN v_credit_balance := 0; END IF;

    v_credit_apply := LEAST(v_credit_apply, v_credit_balance, v_remaining);

    IF v_credit_apply > 0 THEN
      UPDATE public.credit_balances
      SET balance_fcfa = balance_fcfa - v_credit_apply,
          updated_at   = now()
      WHERE user_id = p_user_id;

      INSERT INTO public.credit_transactions (user_id, delta_fcfa, reason, ref_id, place_id)
      VALUES (p_user_id, -v_credit_apply, 'redemption_session', NULL, p_place_id);
    END IF;

    v_remaining := v_remaining - v_credit_apply;
  END IF;

  RETURN jsonb_build_object(
    'bill_amount',     p_bill_amount,
    'total_discount',  v_total_discount,
    'credit_used',     v_credit_apply,
    'customer_pays',   v_remaining,
    'lines',           v_lines
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_redemption_session(uuid, uuid[], int, int, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_redemption_session(uuid, uuid[], int, int, uuid) TO authenticated;

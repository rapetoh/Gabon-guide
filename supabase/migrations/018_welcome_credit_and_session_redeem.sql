-- Migration 018: Welcome credit + multi-item redemption session.
--
-- Replaces the place-specific-coupon referral reward with a platform-wide
-- FCFA credit that the user can spend at any restaurant. Adds an atomic
-- redemption-session RPC so the owner can finalize multiple coupons + a
-- credit deduction against a single bill in one transaction.

-- ─── Credit balances + transactions ─────────────────────────────────
-- One row per user. lifetime_earned tracks total credit ever issued for
-- analytics and to support "Welcome gift" labeling for first-time credit.
CREATE TABLE IF NOT EXISTS public.credit_balances (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_fcfa     int NOT NULL DEFAULT 0 CHECK (balance_fcfa >= 0),
  lifetime_earned  int NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Append-only audit log. delta_fcfa positive = credit earned, negative = spent.
-- reason: 'referral_signup' | 'referral_invite' | 'redemption_session' | 'admin_adjust'
-- ref_id: foreign-id of the originating row (coupon_redemption.id for spends,
--         profiles.id of the new user for referral earns, null for adjusts).
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta_fcfa  int NOT NULL CHECK (delta_fcfa <> 0),
  reason      text NOT NULL CHECK (reason IN ('referral_signup','referral_invite','redemption_session','admin_adjust')),
  ref_id      uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_transactions_user_idx
  ON public.credit_transactions (user_id, created_at DESC);

-- RLS: users read their own balance + transactions only.
ALTER TABLE public.credit_balances     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own balance" ON public.credit_balances;
CREATE POLICY "Users read own balance" ON public.credit_balances
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own credit log" ON public.credit_transactions;
CREATE POLICY "Users read own credit log" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Writes happen only via SECURITY DEFINER triggers/RPCs, so no INSERT/UPDATE
-- policies for direct client writes.

-- ─── referral_settings: add welcome_credit reward type ──────────────
-- The 014 check constraint allowed reward_type in ('coupon','points','none'). We
-- need to extend it to include 'welcome_credit' as a fourth option and add an
-- FCFA amount field.
ALTER TABLE public.referral_settings
  DROP CONSTRAINT IF EXISTS referral_settings_reward_type_check;

ALTER TABLE public.referral_settings
  ADD CONSTRAINT referral_settings_reward_type_check
  CHECK (reward_type IN ('welcome_credit','coupon','points','none'));

ALTER TABLE public.referral_settings
  ADD COLUMN IF NOT EXISTS reward_credit_fcfa int CHECK (reward_credit_fcfa IS NULL OR reward_credit_fcfa > 0);

-- Default the existing row to welcome_credit with a 1 000 FCFA gift, unless
-- the admin has already configured a coupon-based reward.
UPDATE public.referral_settings
SET reward_type = 'welcome_credit',
    reward_credit_fcfa = 1000
WHERE id = 1
  AND reward_coupon_id IS NULL
  AND (reward_type = 'coupon' OR reward_type = 'none');

-- ─── Extended handle_new_user: credit referrer + new user ────────────
-- Same trigger as 017, but now branches on reward_type. For welcome_credit
-- we top up both balances and append two transaction rows.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ref_code     text;
  v_referrer_id  uuid;
  v_settings     record;
  v_coupon_id    uuid;
  v_credit       int;
BEGIN
  v_ref_code := NULLIF(trim(NEW.raw_user_meta_data->>'referral_code'), '');

  IF v_ref_code IS NOT NULL THEN
    SELECT id INTO v_referrer_id
    FROM public.profiles
    WHERE referral_code = upper(v_ref_code)
    LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, email, referred_by)
  VALUES (NEW.id, NEW.email, v_referrer_id)
  ON CONFLICT (id) DO UPDATE
    SET email       = EXCLUDED.email,
        referred_by = COALESCE(public.profiles.referred_by, EXCLUDED.referred_by);

  -- Always seed an empty credit_balances row for the new user — that way the
  -- mobile client's useCreditBalance hook can rely on the row existing.
  INSERT INTO public.credit_balances (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  IF v_referrer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ensure the referrer also has a balance row to update
  INSERT INTO public.credit_balances (user_id) VALUES (v_referrer_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT reward_type, reward_coupon_id, reward_credit_fcfa, is_active
    INTO v_settings
    FROM public.referral_settings
    WHERE id = 1;

  IF NOT v_settings.is_active THEN
    RETURN NEW;
  END IF;

  IF v_settings.reward_type = 'welcome_credit'
     AND v_settings.reward_credit_fcfa IS NOT NULL
     AND v_settings.reward_credit_fcfa > 0 THEN
    v_credit := v_settings.reward_credit_fcfa;

    UPDATE public.credit_balances
      SET balance_fcfa    = balance_fcfa + v_credit,
          lifetime_earned = lifetime_earned + v_credit,
          updated_at      = now()
      WHERE user_id = NEW.id;

    INSERT INTO public.credit_transactions (user_id, delta_fcfa, reason, ref_id)
    VALUES (NEW.id, v_credit, 'referral_signup', v_referrer_id);

    UPDATE public.credit_balances
      SET balance_fcfa    = balance_fcfa + v_credit,
          lifetime_earned = lifetime_earned + v_credit,
          updated_at      = now()
      WHERE user_id = v_referrer_id;

    INSERT INTO public.credit_transactions (user_id, delta_fcfa, reason, ref_id)
    VALUES (v_referrer_id, v_credit, 'referral_invite', NEW.id);

  ELSIF v_settings.reward_type = 'coupon'
        AND v_settings.reward_coupon_id IS NOT NULL THEN
    SELECT id INTO v_coupon_id
    FROM public.coupons
    WHERE id = v_settings.reward_coupon_id
      AND is_active = true
      AND starts_at <= now()
      AND expires_at > now();

    IF FOUND THEN
      INSERT INTO public.coupon_redemptions (coupon_id, user_id, redemption_code)
      VALUES (v_coupon_id, NEW.id, public.generate_coupon_redemption_code());
      INSERT INTO public.coupon_redemptions (coupon_id, user_id, redemption_code)
      VALUES (v_coupon_id, v_referrer_id, public.generate_coupon_redemption_code());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Backfill credit_balances for existing users ────────────────────
-- Every profile gets an empty balance row so client code doesn't have to
-- guard for null. New users hit this via the trigger above.
INSERT INTO public.credit_balances (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- ─── Atomic checkout-session RPC ────────────────────────────────────
-- Owner-side: applies a set of coupon redemptions PLUS an optional credit
-- deduction against a single bill, atomically. Validates that:
--   - all redemption rows belong to p_user_id
--   - none are already redeemed
--   - all are for coupons currently active + within their date window
--   - all are for places the caller is owner of OR the caller is admin
--   - the user has at least p_credit_to_use FCFA available
--   - p_credit_to_use does not exceed (bill - sum of coupon discounts)
--
-- Splits bill_amount across redemption rows proportionally so each row's
-- bill_amount + discount_applied tells a complete story for analytics.
-- Returns a JSON breakdown the client renders on the success screen.
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

  -- Owner / admin gate. We don't care which one — both can redeem.
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = v_caller;
  SELECT EXISTS (
    SELECT 1 FROM public.places
    WHERE id = p_place_id AND owner_id = v_caller AND is_deleted = false
  ) INTO v_is_place_owner;

  IF NOT v_is_place_owner AND NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  -- Validate every redemption row up front; abort if anything is off.
  -- Lock rows FOR UPDATE so two simultaneous sessions can't double-spend.
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

  -- Count + check we found every requested redemption
  SELECT count(*) INTO v_per_row_count
  FROM public.coupon_redemptions WHERE id = ANY (p_redemption_ids);
  IF v_per_row_count <> COALESCE(array_length(p_redemption_ids, 1), 0) THEN
    RAISE EXCEPTION 'CODE_NOT_FOUND';
  END IF;

  -- Compute total discount across coupons. Each coupon's discount is capped
  -- by its share of the bill (split evenly across queued coupons so one
  -- big percentage coupon doesn't eat another coupon's headroom).
  IF v_per_row_count > 0 THEN
    v_share := (p_bill_amount / v_per_row_count);
  ELSE
    v_share := 0;
  END IF;

  v_remaining := p_bill_amount;

  -- Walk again, this time compute + persist
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

  -- Credit deduction: can't exceed user's balance or the remaining bill.
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

      INSERT INTO public.credit_transactions (user_id, delta_fcfa, reason, ref_id)
      VALUES (p_user_id, -v_credit_apply, 'redemption_session', NULL);
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

-- Authenticated owners + admins call this RPC. RLS on the row updates is
-- bypassed by SECURITY DEFINER; explicit permission check is in the function.
REVOKE ALL ON FUNCTION public.apply_redemption_session(uuid, uuid[], int, int, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_redemption_session(uuid, uuid[], int, int, uuid) TO authenticated;

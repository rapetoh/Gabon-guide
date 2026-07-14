-- Migration 037: cap the referral faucet, preserve settlement records, and
-- let OAuth signups claim a referral code after the fact.
--
-- 1. Referral credit was uncapped: every confirmable throwaway email netted
--    ~2×1000 FCFA of real spendable credit, unlimited per referrer. The
--    referrer side is now capped (admin-configurable, default 10 rewarded
--    invites); the new user's welcome credit is unaffected.
-- 2. credit_transactions.user_id was ON DELETE CASCADE: deleting an account
--    destroyed the per-place credit-spend rows the platform needs to settle
--    with restaurants. Now SET NULL, matching coupon_redemptions.
-- 3. Google/Apple signups have no referral-code field at signup; the app adds
--    a one-time "have a code?" prompt backed by claim_referral_code().

-- ─── 1. Referrer-side cap ────────────────────────────────────────────────

ALTER TABLE public.referral_settings
  ADD COLUMN IF NOT EXISTS max_rewarded_invites int NOT NULL DEFAULT 10
  CHECK (max_rewarded_invites >= 0);

CREATE OR REPLACE FUNCTION public.grant_referral_reward(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_referrer_id  uuid;
  v_settings     record;
  v_coupon_id    uuid;
  v_credit       int;
  v_invite_count int;
BEGIN
  -- Already granted? Bail out. Safe to call from any trigger.
  IF EXISTS (
    SELECT 1 FROM public.credit_transactions
    WHERE user_id = p_user_id AND reason = 'referral_signup'
  ) THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.coupon_redemptions cr
    JOIN public.coupons c ON c.id = cr.coupon_id
    JOIN public.referral_settings rs ON rs.reward_coupon_id = c.id
    WHERE cr.user_id = p_user_id AND rs.id = 1
  ) THEN
    RETURN;
  END IF;

  SELECT referred_by INTO v_referrer_id
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_referrer_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.credit_balances (user_id) VALUES (v_referrer_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT reward_type, reward_coupon_id, reward_credit_fcfa, is_active, max_rewarded_invites
    INTO v_settings
    FROM public.referral_settings
    WHERE id = 1;

  IF NOT v_settings.is_active THEN
    RETURN;
  END IF;

  -- How many invites has the referrer already been paid for?
  SELECT count(*) INTO v_invite_count
  FROM public.credit_transactions
  WHERE user_id = v_referrer_id AND reason = 'referral_invite';

  IF v_settings.reward_type = 'welcome_credit'
     AND v_settings.reward_credit_fcfa IS NOT NULL
     AND v_settings.reward_credit_fcfa > 0 THEN
    v_credit := v_settings.reward_credit_fcfa;

    -- New user always gets their welcome credit.
    UPDATE public.credit_balances
      SET balance_fcfa    = balance_fcfa + v_credit,
          lifetime_earned = lifetime_earned + v_credit,
          updated_at      = now()
      WHERE user_id = p_user_id;

    INSERT INTO public.credit_transactions (user_id, delta_fcfa, reason, ref_id)
    VALUES (p_user_id, v_credit, 'referral_signup', v_referrer_id);

    -- Referrer earns only up to the cap.
    IF v_invite_count < v_settings.max_rewarded_invites THEN
      UPDATE public.credit_balances
        SET balance_fcfa    = balance_fcfa + v_credit,
            lifetime_earned = lifetime_earned + v_credit,
            updated_at      = now()
        WHERE user_id = v_referrer_id;

      INSERT INTO public.credit_transactions (user_id, delta_fcfa, reason, ref_id)
      VALUES (v_referrer_id, v_credit, 'referral_invite', p_user_id);
    END IF;

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
      VALUES (v_coupon_id, p_user_id, public.generate_coupon_redemption_code());
      IF v_invite_count < v_settings.max_rewarded_invites THEN
        INSERT INTO public.coupon_redemptions (coupon_id, user_id, redemption_code)
        VALUES (v_coupon_id, v_referrer_id, public.generate_coupon_redemption_code());
      END IF;
    END IF;
  END IF;
END;
$$;

-- ─── 2. Settlement records survive account deletion ─────────────────────

ALTER TABLE public.credit_transactions
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_user_id_fkey;

ALTER TABLE public.credit_transactions
  ADD CONSTRAINT credit_transactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─── 3. Late referral-code claim (OAuth signups) ─────────────────────────
-- Window-limited so it can't become a farming tool for old accounts:
-- only a profile created in the last 7 days, with no referrer yet, can claim.

CREATE OR REPLACE FUNCTION public.claim_referral_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_profile     record;
  v_referrer_id uuid;
  v_confirmed   timestamptz;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT id, referred_by, created_at, referral_code
  INTO v_profile
  FROM public.profiles
  WHERE id = v_caller;

  IF v_profile.referred_by IS NOT NULL THEN
    RAISE EXCEPTION 'ALREADY_REFERRED';
  END IF;
  IF v_profile.created_at < now() - interval '7 days' THEN
    RAISE EXCEPTION 'CLAIM_WINDOW_CLOSED';
  END IF;

  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE referral_code = upper(trim(p_code))
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RAISE EXCEPTION 'CODE_NOT_FOUND';
  END IF;
  IF v_referrer_id = v_caller THEN
    RAISE EXCEPTION 'SELF_REFERRAL';
  END IF;

  UPDATE public.profiles SET referred_by = v_referrer_id WHERE id = v_caller;

  -- Grant now if the email is already confirmed (or confirmation is off, in
  -- which case Supabase confirms instantly); otherwise the existing
  -- email-confirmed trigger will grant later.
  SELECT email_confirmed_at INTO v_confirmed FROM auth.users WHERE id = v_caller;
  IF v_confirmed IS NOT NULL THEN
    PERFORM public.grant_referral_reward(v_caller);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_referral_code(text) TO authenticated;

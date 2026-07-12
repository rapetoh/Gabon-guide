-- Migration 024: gate the welcome credit (and coupon reward) on email
-- confirmation.
--
-- Problem: today, handle_new_user() fires on auth.users INSERT and
-- immediately credits both the new user and (if any) their referrer.
-- A bad actor can sign up with a throwaway email, take the 1000 FCFA
-- credit, never confirm, and repeat. Welcome credit + referral payouts
-- become a faucet.
--
-- Fix: split the work into two triggers.
--
--   * handle_new_user (INSERT on auth.users): create the profile row,
--     seed an empty credit_balances row, store referred_by. If the user
--     came in already-confirmed (e.g. Google / Apple OAuth, where the
--     email is implicitly verified), grant the reward right away.
--
--   * handle_email_confirmed (UPDATE on auth.users): when
--     email_confirmed_at transitions from NULL to not-NULL (email +
--     password path), grant the reward then.
--
-- Both paths funnel through a single grant_referral_reward(user_id)
-- helper that is idempotent — if the user already has a referral_signup
-- credit transaction, it does nothing. That makes double-grant impossible
-- even if both triggers fire for some reason.

-- ─── 1. Idempotent grant helper ────────────────────────────────────────

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
BEGIN
  -- Already granted? Bail out. This makes the function safe to call from
  -- either trigger without risk of double-paying.
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

  -- Who, if anyone, referred this user?
  SELECT referred_by INTO v_referrer_id
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_referrer_id IS NULL THEN
    RETURN; -- no referral, nothing to grant
  END IF;

  -- Make sure the referrer has a credit_balances row to update
  INSERT INTO public.credit_balances (user_id) VALUES (v_referrer_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT reward_type, reward_coupon_id, reward_credit_fcfa, is_active
    INTO v_settings
    FROM public.referral_settings
    WHERE id = 1;

  IF NOT v_settings.is_active THEN
    RETURN;
  END IF;

  IF v_settings.reward_type = 'welcome_credit'
     AND v_settings.reward_credit_fcfa IS NOT NULL
     AND v_settings.reward_credit_fcfa > 0 THEN
    v_credit := v_settings.reward_credit_fcfa;

    UPDATE public.credit_balances
      SET balance_fcfa    = balance_fcfa + v_credit,
          lifetime_earned = lifetime_earned + v_credit,
          updated_at      = now()
      WHERE user_id = p_user_id;

    INSERT INTO public.credit_transactions (user_id, delta_fcfa, reason, ref_id)
    VALUES (p_user_id, v_credit, 'referral_signup', v_referrer_id);

    UPDATE public.credit_balances
      SET balance_fcfa    = balance_fcfa + v_credit,
          lifetime_earned = lifetime_earned + v_credit,
          updated_at      = now()
      WHERE user_id = v_referrer_id;

    INSERT INTO public.credit_transactions (user_id, delta_fcfa, reason, ref_id)
    VALUES (v_referrer_id, v_credit, 'referral_invite', p_user_id);

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
      INSERT INTO public.coupon_redemptions (coupon_id, user_id, redemption_code)
      VALUES (v_coupon_id, v_referrer_id, public.generate_coupon_redemption_code());
    END IF;
  END IF;
END;
$$;

-- ─── 2. Rewrite handle_new_user — store referral, defer the grant ─────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ref_code     text;
  v_referrer_id  uuid;
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

  -- Always seed an empty credit_balances row so the mobile client's
  -- useCreditBalance hook can rely on the row existing.
  INSERT INTO public.credit_balances (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- If the email is already confirmed at INSERT time (OAuth flows), grant
  -- the reward right away. Otherwise the second trigger will handle it
  -- when the user clicks the confirmation link.
  IF NEW.email_confirmed_at IS NOT NULL THEN
    PERFORM public.grant_referral_reward(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- ─── 3. New trigger that fires when the email gets confirmed ──────────

CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only act on the NULL → not-NULL transition. Subsequent updates to
  -- the row should not re-trigger the grant.
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    PERFORM public.grant_referral_reward(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_email_confirmed();

-- ─── 4. One-shot reconciliation: grant rewards to existing users who
--        confirmed their email but never received credit (because they
--        signed up before this migration). Safe because the grant helper
--        is idempotent.

DO $$
DECLARE
  v_row record;
BEGIN
  FOR v_row IN
    SELECT u.id
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE u.email_confirmed_at IS NOT NULL
      AND p.referred_by IS NOT NULL
  LOOP
    PERFORM public.grant_referral_reward(v_row.id);
  END LOOP;
END $$;

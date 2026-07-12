-- Migration 024: gate the welcome / referral credit on the user's email
-- actually being confirmed.
--
-- Before this migration: the moment any auth.users row was inserted, both the
-- new user and (if there was a referral code) the referrer were immediately
-- credited 1000 FCFA. That meant a bad actor could sign up with a throwaway
-- email + referral code, never confirm, take the credit, and repeat.
--
-- After this migration:
--   * profile + empty credit_balance row are still created at INSERT time
--     (those are harmless and other code relies on the row existing)
--   * the *credit-granting* part runs only when email_confirmed_at is set
--   * for email/password signups, that happens later (when the user clicks
--     the confirmation link) — handled by a new on-confirm trigger
--   * for OAuth signups (Google / Apple), email_confirmed_at is typically
--     set on the same INSERT row, so the credits are still granted at INSERT
--   * the grant is idempotent — profiles.referral_processed_at is set after
--     a successful run, and the function returns early if it's already set
--
-- Existing users: their referral_processed_at is back-filled to now() so the
-- on-confirm trigger does not retroactively credit users who already went
-- through the old (pre-confirm) flow.

-- ---------------------------------------------------------------
-- 1. Idempotency flag column on profiles
-- ---------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_processed_at timestamptz;

COMMENT ON COLUMN public.profiles.referral_processed_at IS
  'Set when grant_referral_credits has run for this profile. Used to make the credit grant idempotent across the INSERT trigger and the on-confirm trigger.';

-- Back-fill: every profile that exists today has already been processed
-- under the old logic. Mark them so they are never retroactively re-credited.
UPDATE public.profiles
SET referral_processed_at = COALESCE(referral_processed_at, now());

-- ---------------------------------------------------------------
-- 2. The shared credit-granting routine
-- ---------------------------------------------------------------
-- This is the heart of the credit logic, extracted from handle_new_user so
-- it can be called from both the INSERT-trigger path (OAuth) and the
-- email-confirmed-trigger path (email/password).
CREATE OR REPLACE FUNCTION public.grant_referral_credits(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_referrer_id  uuid;
  v_processed    timestamptz;
  v_settings     record;
  v_credit       int;
  v_coupon_id    uuid;
BEGIN
  -- Idempotency guard — never run twice for the same profile.
  SELECT referred_by, referral_processed_at
    INTO v_referrer_id, v_processed
    FROM public.profiles
    WHERE id = p_user_id;

  IF v_processed IS NOT NULL THEN
    RETURN;
  END IF;

  -- No referrer = nothing to grant, but still mark processed so we don't
  -- keep retrying on future email updates.
  IF v_referrer_id IS NULL THEN
    UPDATE public.profiles SET referral_processed_at = now() WHERE id = p_user_id;
    RETURN;
  END IF;

  SELECT reward_type, reward_coupon_id, reward_credit_fcfa, is_active
    INTO v_settings
    FROM public.referral_settings
    WHERE id = 1;

  -- Referrals disabled? Mark processed and bail.
  IF NOT v_settings.is_active THEN
    UPDATE public.profiles SET referral_processed_at = now() WHERE id = p_user_id;
    RETURN;
  END IF;

  IF v_settings.reward_type = 'welcome_credit'
     AND v_settings.reward_credit_fcfa IS NOT NULL
     AND v_settings.reward_credit_fcfa > 0 THEN

    v_credit := v_settings.reward_credit_fcfa;

    -- Ensure both balance rows exist before updating.
    INSERT INTO public.credit_balances (user_id) VALUES (p_user_id)
      ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.credit_balances (user_id) VALUES (v_referrer_id)
      ON CONFLICT (user_id) DO NOTHING;

    -- Credit the new user
    UPDATE public.credit_balances
      SET balance_fcfa    = balance_fcfa + v_credit,
          lifetime_earned = lifetime_earned + v_credit,
          updated_at      = now()
      WHERE user_id = p_user_id;

    INSERT INTO public.credit_transactions (user_id, delta_fcfa, reason, ref_id)
    VALUES (p_user_id, v_credit, 'referral_signup', v_referrer_id);

    -- Credit the referrer
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

  UPDATE public.profiles SET referral_processed_at = now() WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_referral_credits(uuid) FROM PUBLIC;
-- This function is only invoked from triggers, not directly from the app,
-- so no GRANT to authenticated is needed.

-- ---------------------------------------------------------------
-- 3. Slim handle_new_user: profile + balance row always, credit only if confirmed
-- ---------------------------------------------------------------
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

  -- Always create the profile + empty balance row. These are harmless to
  -- have even for unconfirmed users.
  INSERT INTO public.profiles (id, email, referred_by)
  VALUES (NEW.id, NEW.email, v_referrer_id)
  ON CONFLICT (id) DO UPDATE
    SET email       = EXCLUDED.email,
        referred_by = COALESCE(public.profiles.referred_by, EXCLUDED.referred_by);

  INSERT INTO public.credit_balances (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Only grant credits if the email is already confirmed at insert time.
  -- This is normally true for OAuth signups (Google/Apple) and false for
  -- email/password signups, which trigger the on-confirm trigger below
  -- when the user clicks the confirmation link.
  IF NEW.email_confirmed_at IS NOT NULL THEN
    PERFORM public.grant_referral_credits(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------
-- 4. New trigger: grant credits when email_confirmed_at goes NULL → set
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.email_confirmed_at IS NULL
     AND NEW.email_confirmed_at IS NOT NULL THEN
    PERFORM public.grant_referral_credits(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_confirmed();

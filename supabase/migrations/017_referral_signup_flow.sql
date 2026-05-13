-- Migration 017: wire the referral flow through signup.
--
-- - handle_new_user() (AFTER INSERT on auth.users) now reads
--   raw_user_meta_data->>'referral_code', looks up the referrer's profile,
--   and writes referred_by on the new profile row.
-- - If referral_settings.is_active AND reward_type='coupon' AND
--   reward_coupon_id points to a currently active coupon, we issue an
--   unredeemed coupon_redemptions row to BOTH the referrer and referee.
--   Those rows are later picked up by useStartRedemption on the user side
--   and surface as a ready-to-show QR — no separate "redeem your reward"
--   flow needed.
-- - Self-referral is naturally impossible: at the moment we look up the
--   referrer, the new user's own profile (and therefore their referral
--   code) does not yet exist.
--
-- The migration is idempotent: CREATE OR REPLACE FUNCTION rebinds the
-- existing trigger function without touching the trigger itself.

-- 8-char alphanumeric code generator that mirrors the client-side
-- generateCode() in useCouponRedemption.ts. Used to mint the redemption
-- codes for reward rows issued by the trigger below.
CREATE OR REPLACE FUNCTION public.generate_coupon_redemption_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

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
BEGIN
  -- Optional referral code passed via auth metadata at signUp time
  v_ref_code := NULLIF(trim(NEW.raw_user_meta_data->>'referral_code'), '');

  IF v_ref_code IS NOT NULL THEN
    SELECT id INTO v_referrer_id
    FROM public.profiles
    WHERE referral_code = upper(v_ref_code)
    LIMIT 1;
  END IF;

  -- Create / update the profile row. The BEFORE INSERT trigger from
  -- migration 014 generates a fresh referral_code for the new user.
  INSERT INTO public.profiles (id, email, referred_by)
  VALUES (NEW.id, NEW.email, v_referrer_id)
  ON CONFLICT (id) DO UPDATE
    SET email       = EXCLUDED.email,
        referred_by = COALESCE(public.profiles.referred_by, EXCLUDED.referred_by);

  -- If the referral linked, try to issue the configured reward.
  IF v_referrer_id IS NOT NULL THEN
    SELECT reward_type, reward_coupon_id, is_active
      INTO v_settings
      FROM public.referral_settings
      WHERE id = 1;

    IF v_settings.is_active
       AND v_settings.reward_type = 'coupon'
       AND v_settings.reward_coupon_id IS NOT NULL THEN
      -- Only issue if the reward coupon is currently live. If not, skip
      -- silently — the link itself (referred_by) is still recorded.
      SELECT id INTO v_coupon_id
      FROM public.coupons
      WHERE id = v_settings.reward_coupon_id
        AND is_active = true
        AND starts_at <= now()
        AND expires_at > now();

      IF FOUND THEN
        -- Referee reward (the new user)
        INSERT INTO public.coupon_redemptions (coupon_id, user_id, redemption_code)
        VALUES (v_coupon_id, NEW.id, public.generate_coupon_redemption_code());

        -- Referrer reward
        INSERT INTO public.coupon_redemptions (coupon_id, user_id, redemption_code)
        VALUES (v_coupon_id, v_referrer_id, public.generate_coupon_redemption_code());
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

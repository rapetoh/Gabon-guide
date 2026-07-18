-- 045: Premium coupon broadcast (founder decision 2026-07-18).
--
-- When a place whose tier has the new `coupon_broadcast` feature posts a
-- coupon, EVERY non-blocked user is notified — not just the place's
-- favoriters. This is the premium-tier marketing megaphone owners pay for.
-- Standard-tier places keep the favoriters-only reach from 044. The switch
-- lives in tier_features, so the founder can flip it per tier in the admin
-- matrix like every other feature.

INSERT INTO public.tier_features (feature_key, tier, enabled) VALUES
  ('coupon_broadcast', 'free',     false),
  ('coupon_broadcast', 'standard', false),
  ('coupon_broadcast', 'premium',  true)
ON CONFLICT (feature_key, tier) DO NOTHING;

CREATE OR REPLACE FUNCTION public.notify_new_coupon()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_place_name text;
  v_owner uuid;
  v_broadcast boolean;
BEGIN
  -- System coupons (referral rewards etc.) and inactive drafts are silent.
  IF NEW.is_system OR NOT NEW.is_active THEN
    RETURN NEW;
  END IF;

  IF NEW.place_id IS NOT NULL THEN
    SELECT pl.name, pl.owner_id,
           EXISTS (
             SELECT 1 FROM tier_features tf
             WHERE tf.tier = pl.subscription_tier
               AND tf.feature_key = 'coupon_broadcast' AND tf.enabled
           )
      INTO v_place_name, v_owner, v_broadcast
      FROM places pl WHERE pl.id = NEW.place_id;

    IF v_broadcast THEN
      -- Premium reach: every non-blocked user except the owner.
      INSERT INTO notifications (user_id, type, payload)
      SELECT
        p.id,
        'new_coupon',
        jsonb_build_object(
          'place_id',   NEW.place_id,
          'place_name', v_place_name,
          'coupon_title_fr', NEW.title_fr,
          'coupon_title_en', NEW.title_en,
          'platform',   false
        )
      FROM profiles p
      WHERE NOT p.is_blocked AND p.id IS DISTINCT FROM v_owner;
    ELSE
      -- Standard reach: users who favorited this place.
      INSERT INTO notifications (user_id, type, payload)
      SELECT
        f.user_id,
        'new_coupon',
        jsonb_build_object(
          'place_id',   NEW.place_id,
          'place_name', v_place_name,
          'coupon_title_fr', NEW.title_fr,
          'coupon_title_en', NEW.title_en,
          'platform',   false
        )
      FROM favorites f
      JOIN profiles p ON p.id = f.user_id AND NOT p.is_blocked
      WHERE f.place_id = NEW.place_id
        AND f.user_id IS NOT NULL
        AND f.user_id IS DISTINCT FROM v_owner;
    END IF;
  ELSE
    -- Platform-wide (admin) coupon: everyone.
    INSERT INTO notifications (user_id, type, payload)
    SELECT
      p.id,
      'new_coupon',
      jsonb_build_object(
        'place_id',   NULL,
        'place_name', NULL,
        'coupon_title_fr', NEW.title_fr,
        'coupon_title_en', NEW.title_en,
        'platform',   true
      )
    FROM profiles p
    WHERE NOT p.is_blocked;
  END IF;
  RETURN NEW;
END;
$$;

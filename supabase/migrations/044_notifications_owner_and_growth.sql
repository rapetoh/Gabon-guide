-- 044: Close the owner-side + growth notification gaps (founder review 2026-07-18).
--
-- New types:
--   new_review      → place owner, when a customer posts a review
--   new_coupon      → users who favorited the place (place-scoped coupon),
--                     or every non-blocked user (platform-wide coupon)
--   place_activated → place owner, when their listing flips to active
--
-- Deliberately NOT notified: coupon redeemed at your own place (the owner
-- performs the scan themselves). Weekly digests / expiry reminders are
-- cron-shaped and parked with the other deferred scheduled work.
--
-- NOTE: multi-place coupon scopes (coupon_places) are not fanned out yet —
-- v1 notifies favorites of coupons.place_id only.

ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'coupon_redeemed', 'credit_spent', 'credit_received',
    'referral_reward', 'review_reply',
    'new_review', 'new_coupon', 'place_activated'
  ));

-- ── New review → owner ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_new_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_place_name text;
BEGIN
  SELECT owner_id, name INTO v_owner, v_place_name FROM places WHERE id = NEW.place_id;
  IF v_owner IS NOT NULL AND v_owner IS DISTINCT FROM NEW.user_id THEN
    INSERT INTO notifications (user_id, type, payload)
    VALUES (
      v_owner,
      'new_review',
      jsonb_build_object(
        'place_id',    NEW.place_id,
        'place_name',  v_place_name,
        'review_id',   NEW.id,
        'rating',      NEW.rating,
        'author_name', NEW.author_display_name,
        'excerpt',     left(NEW.comment, 140)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_review
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_review();

-- ── New coupon → favoriters (place-scoped) or everyone (platform) ───────────
CREATE OR REPLACE FUNCTION public.notify_new_coupon()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_place_name text;
BEGIN
  -- System coupons (referral rewards etc.) and inactive drafts are silent.
  IF NEW.is_system OR NOT NEW.is_active THEN
    RETURN NEW;
  END IF;

  IF NEW.place_id IS NOT NULL THEN
    SELECT name INTO v_place_name FROM places WHERE id = NEW.place_id;
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
      AND f.user_id IS DISTINCT FROM (SELECT pl.owner_id FROM places pl WHERE pl.id = NEW.place_id);
  ELSE
    -- Platform-wide coupon: the admin megaphone. Everyone not blocked.
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

CREATE TRIGGER trg_notify_new_coupon
  AFTER INSERT ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_coupon();

-- ── Place activated → owner ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_place_activated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active IS TRUE AND COALESCE(OLD.is_active, false) IS FALSE
     AND NEW.owner_id IS NOT NULL
     AND NEW.owner_id IS DISTINCT FROM auth.uid() THEN  -- owner activating it themselves: skip
    INSERT INTO notifications (user_id, type, payload)
    VALUES (
      NEW.owner_id,
      'place_activated',
      jsonb_build_object('place_id', NEW.id, 'place_name', NEW.name)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_place_activated
  AFTER UPDATE OF is_active ON public.places
  FOR EACH ROW EXECUTE FUNCTION public.notify_place_activated();

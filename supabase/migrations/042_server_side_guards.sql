-- 042: Server-side guards the client can no longer bypass (audit 2.1 + 4.3).
--
-- Three rules, previously client-side only:
--   1. A place cannot flip to is_active without at least one live gallery
--      photo. Product rule (PRD §5) — applies to EVERYONE including admins;
--      an admin publishes by adding a photo first, same quality bar.
--   2. Gallery photo count is capped by tier_limits.max_photos.
--   3. Place-scoped coupons / videos require the tier feature
--      (coupons_create / video) to be enabled.
-- Rules 2–3 are commercial rules: is_admin() bypasses them (admins configure
-- tiers and act deliberately), owners cannot.
--
-- All guards use the RAW subscription_tier, mirroring usePlaceTier on the
-- client (expiry downgrade is a deferred feature — see founder mandate).
-- Functions are SECURITY DEFINER so counting rows isn't at the mercy of the
-- caller's RLS view; they are triggers, not policies, so the profiles
-- recursion rule is not in play (and they only call is_admin() anyway).

-- ── 1. Publish requires a photo ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_publish_requires_photo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active IS TRUE
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.is_active, false) IS FALSE) THEN
    IF NOT EXISTS (
      SELECT 1 FROM photos
      WHERE place_id = NEW.id AND NOT is_deleted AND NOT is_menu
    ) THEN
      RAISE EXCEPTION 'PUBLISH_REQUIRES_PHOTO';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER publish_requires_photo
  BEFORE INSERT OR UPDATE OF is_active ON public.places
  FOR EACH ROW EXECUTE FUNCTION public.enforce_publish_requires_photo();

-- ── 2. Gallery photos capped by tier ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_photo_tier_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_max  int;
BEGIN
  IF NEW.is_menu OR NEW.is_deleted OR is_admin() THEN
    RETURN NEW;
  END IF;

  SELECT subscription_tier INTO v_tier FROM places WHERE id = NEW.place_id;
  SELECT max_photos INTO v_max FROM tier_limits WHERE tier = v_tier;

  IF v_max IS NOT NULL AND (
    SELECT count(*) FROM photos
    WHERE place_id = NEW.place_id AND NOT is_deleted AND NOT is_menu
  ) >= v_max THEN
    RAISE EXCEPTION 'PHOTO_LIMIT_REACHED';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER photo_tier_limit
  BEFORE INSERT ON public.photos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_photo_tier_limit();

-- ── 3. Coupons / videos require the tier feature ────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_tier_feature()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_place_id uuid;
  v_feature  text := TG_ARGV[0];
  v_tier     text;
BEGIN
  v_place_id := NEW.place_id;
  -- Platform coupons (place_id IS NULL) are admin-only via RLS already.
  IF v_place_id IS NULL OR is_admin() THEN
    RETURN NEW;
  END IF;

  SELECT subscription_tier INTO v_tier FROM places WHERE id = v_place_id;
  IF NOT EXISTS (
    SELECT 1 FROM tier_features
    WHERE tier = v_tier AND feature_key = v_feature AND enabled
  ) THEN
    RAISE EXCEPTION 'FEATURE_NOT_IN_TIER: %', v_feature;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER coupon_tier_feature
  BEFORE INSERT ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tier_feature('coupons_create');

CREATE TRIGGER video_tier_feature
  BEFORE INSERT ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tier_feature('video');

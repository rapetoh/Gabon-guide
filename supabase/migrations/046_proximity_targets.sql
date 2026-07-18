-- 046: Proximity alerts — tier switch + target-list RPC.
--
-- The phone does the geofencing (iOS region monitoring, ~20 region cap), so
-- the server's whole job is answering: "given where I am, which are the
-- nearest places worth watching?" A place qualifies when it is active, has
-- coordinates, its tier has the `proximity_pings` feature (premium by
-- default, admin-flippable in the tier matrix), and it has at least one
-- live, non-system coupon — proximity pings without a live offer are spam
-- (founder agreement 2026-07-18). Frequency capping is client-side.

INSERT INTO public.tier_features (feature_key, tier, enabled) VALUES
  ('proximity_pings', 'free',     false),
  ('proximity_pings', 'standard', false),
  ('proximity_pings', 'premium',  true)
ON CONFLICT (feature_key, tier) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_proximity_targets(
  p_lat double precision,
  p_lon double precision,
  p_limit int DEFAULT 18   -- iOS caps region monitoring at 20 per app; keep headroom
)
RETURNS TABLE (
  place_id uuid,
  name text,
  latitude double precision,
  longitude double precision,
  coupon_title_fr text,
  coupon_title_en text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pl.id,
    pl.name,
    pl.latitude,
    pl.longitude,
    c.title_fr,
    c.title_en
  FROM places pl
  CROSS JOIN LATERAL (
    SELECT co.title_fr, co.title_en
    FROM coupons co
    LEFT JOIN coupon_places cp ON cp.coupon_id = co.id
    WHERE (co.place_id = pl.id OR cp.place_id = pl.id)
      AND co.is_active AND NOT co.is_system
      AND co.starts_at <= now() AND co.expires_at > now()
    ORDER BY co.expires_at ASC   -- surface the offer ending soonest
    LIMIT 1
  ) c
  WHERE pl.is_active AND NOT pl.is_deleted
    AND pl.latitude IS NOT NULL AND pl.longitude IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM tier_features tf
      WHERE tf.tier = pl.subscription_tier
        AND tf.feature_key = 'proximity_pings' AND tf.enabled
    )
  -- Equirectangular distance is plenty at city scale.
  ORDER BY
    pow(pl.latitude - p_lat, 2)
    + pow((pl.longitude - p_lon) * cos(radians(p_lat)), 2)
  LIMIT p_limit
$$;

REVOKE EXECUTE ON FUNCTION public.get_proximity_targets(double precision, double precision, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_proximity_targets(double precision, double precision, int) TO authenticated;

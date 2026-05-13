-- Migration 020: platform-issued coupons.
--
-- Admins can now create coupons that aren't tied to a single restaurant —
-- either valid at every place, or scoped to a hand-picked subset. The
-- existing per-place coupon shape is preserved unchanged.
--
--   coupons.place_id NULL              => platform coupon
--      - empty coupon_places           => valid everywhere
--      - has coupon_places rows        => valid only at the listed places
--   coupons.place_id NOT NULL          => existing single-place owner coupon
--      - coupon_places rows ignored    => kept clean by app-side logic
--
-- The existing coupons RLS policy already covers this correctly: only
-- admins can write when place_id IS NULL (the owner check requires the
-- place row to exist + match auth.uid()). No policy edit needed on
-- coupons itself.

ALTER TABLE public.coupons ALTER COLUMN place_id DROP NOT NULL;

-- coupon_places: which places a platform coupon is valid at. Only used
-- when the coupon's place_id is NULL.
CREATE TABLE IF NOT EXISTS public.coupon_places (
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  place_id  uuid NOT NULL REFERENCES public.places(id)  ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (coupon_id, place_id)
);

CREATE INDEX IF NOT EXISTS coupon_places_place_idx ON public.coupon_places (place_id);

ALTER TABLE public.coupon_places ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated (or anon — coupons are public read) can SELECT the
-- mapping so the place detail page can render the right platform coupons.
DROP POLICY IF EXISTS "coupon_places_read_all" ON public.coupon_places;
CREATE POLICY "coupon_places_read_all" ON public.coupon_places
  FOR SELECT USING (true);

-- Only admins can write. Owners cannot manage platform coupons' scope —
-- a platform coupon is the admin's instrument.
DROP POLICY IF EXISTS "coupon_places_admin_write" ON public.coupon_places;
CREATE POLICY "coupon_places_admin_write" ON public.coupon_places
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  );

-- The apply_redemption_session RPC also needs updating so a platform
-- coupon can be redeemed at a place it's valid for. We ship that as the
-- 020b migration (same logical change, separate file purely so the diff
-- on the RPC body is easy to read).

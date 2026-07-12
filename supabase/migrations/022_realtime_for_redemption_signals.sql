-- Migration 022: enable Supabase Realtime on coupon_redemptions + credit_transactions.
--
-- The customer's phone needs to know the moment the owner applies their
-- redemption: today there's no signal — the QR modal just sits there until
-- they manually close it. We solve it by subscribing to postgres_changes on
-- these two tables on the customer side, filtered by RLS to the user's own
-- rows. That requires the tables to be in the supabase_realtime publication.
--
-- We also set REPLICA IDENTITY FULL on coupon_redemptions so UPDATE events
-- include the full row (we need redeemed_at, place_id, discount_applied for
-- the success state). credit_transactions only INSERTs in our use, so it
-- doesn't need REPLICA IDENTITY FULL.

ALTER PUBLICATION supabase_realtime ADD TABLE public.coupon_redemptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_transactions;

ALTER TABLE public.coupon_redemptions REPLICA IDENTITY FULL;

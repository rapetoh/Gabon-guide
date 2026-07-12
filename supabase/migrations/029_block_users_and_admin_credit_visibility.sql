-- Migration 029: block/suspend users + fix admin visibility of the credit
-- ledger. (LOGIC_AUDIT items 1.4 and a bug found while building the web
-- admin Users page.)
--
-- Part A — block/suspend (audit 1.4):
--   * profiles.is_blocked flag, default false
--   * is_blocked() helper so RLS policies can cheaply check the caller
--   * blocked users can no longer create content: reviews (insert/update),
--     favorites (insert), coupon claims (insert). Browsing stays available —
--     blocking is about stopping abuse, not hiding the app.
--   * get_all_users_for_admin() now returns is_blocked so both admin UIs
--     can show and toggle it. (Return-type change requires DROP + CREATE.)
--
-- Part B — admin credit visibility (bug):
--   credit_balances and credit_transactions only had "own row" read
--   policies. The admin activity/referrals pages query these tables with
--   the admin's session, so RLS silently filtered the results down to the
--   admin's OWN transactions — the "global" activity feed on the web was
--   showing a fraction of reality. Add admin read policies.

-- ─── A1. Column ────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_blocked IS
  'When true, the user can browse but can no longer write content (reviews, favorites, coupon claims). Toggled by admins from the Users pages.';

-- ─── A2. Helper ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_blocked()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT is_blocked FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_blocked() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_blocked() TO anon, authenticated;

-- ─── A3. Enforcement on user-generated writes ──────────────────────────

DROP POLICY IF EXISTS "reviews_own_insert" ON public.reviews;
CREATE POLICY "reviews_own_insert" ON public.reviews
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND NOT public.is_blocked());

DROP POLICY IF EXISTS "reviews_own_update" ON public.reviews;
CREATE POLICY "reviews_own_update" ON public.reviews
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND NOT public.is_blocked());

DROP POLICY IF EXISTS "favorites_own_insert" ON public.favorites;
CREATE POLICY "favorites_own_insert" ON public.favorites
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND NOT public.is_blocked());

DROP POLICY IF EXISTS "coupon_redemptions_user_insert_own" ON public.coupon_redemptions;
CREATE POLICY "coupon_redemptions_user_insert_own" ON public.coupon_redemptions
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND NOT public.is_blocked());

-- ─── A4. get_all_users_for_admin returns is_blocked ────────────────────
-- Return-type changes can't go through CREATE OR REPLACE.

DROP FUNCTION IF EXISTS public.get_all_users_for_admin();

CREATE FUNCTION public.get_all_users_for_admin()
RETURNS TABLE (
  id         uuid,
  full_name  text,
  role       text,
  is_admin   boolean,
  is_blocked boolean,
  email      text,
  joined_at  timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    p.id,
    p.full_name,
    p.role,
    p.is_admin,
    p.is_blocked,
    p.email,
    p.created_at AS joined_at
  FROM public.profiles p
  WHERE public.is_admin()
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_all_users_for_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin() TO authenticated;

-- ─── B. Admin can read the credit ledger ───────────────────────────────

DROP POLICY IF EXISTS "credit_balances_admin_read" ON public.credit_balances;
CREATE POLICY "credit_balances_admin_read" ON public.credit_balances
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "credit_transactions_admin_read" ON public.credit_transactions;
CREATE POLICY "credit_transactions_admin_read" ON public.credit_transactions
  FOR SELECT
  USING (public.is_admin());

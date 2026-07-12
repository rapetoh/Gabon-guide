-- Migration 026: pin search_path on the remaining functions that the
-- Supabase advisor flagged. Migration 023 covered three; these four
-- were either created earlier or by other migrations and slipped through.
--
-- Why: a function with a mutable search_path can be tricked by a caller
-- who creates a same-named table in another schema (e.g. pg_temp) before
-- invoking the function. Pinning the path closes that hole.

ALTER FUNCTION public.generate_coupon_redemption_code()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.handle_user_email_change()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.is_admin()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.update_updated_at()
  SET search_path = public, pg_temp;

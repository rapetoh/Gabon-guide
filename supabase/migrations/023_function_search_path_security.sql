-- Migration 023: pin search_path on three older functions that the
-- Supabase security advisor flagged as "function_search_path_mutable".
--
-- A function with a mutable search_path can be tricked by a caller who
-- creates a table with the same name in a different schema (e.g. pg_temp)
-- before invoking the function. Pinning search_path to `public, pg_temp`
-- means the function always resolves `profiles`, `coupons`, etc. to the
-- intended schema regardless of what the caller did.
--
-- All three of these functions exist (created in earlier migrations 011
-- and 014); they just need the search_path setting added. ALTER FUNCTION
-- is the least invasive way to apply this without rewriting bodies.

ALTER FUNCTION public.generate_referral_code()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.set_referral_code_on_profile()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_all_users_for_admin()
  SET search_path = public, pg_temp;

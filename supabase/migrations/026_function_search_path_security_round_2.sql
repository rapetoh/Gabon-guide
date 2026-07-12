-- Migration 026: pin search_path on the four remaining functions that the
-- Supabase security advisor flagged after migration 023.
--
-- Migration 023 caught three (generate_referral_code,
-- set_referral_code_on_profile, get_all_users_for_admin). The advisor
-- surfaced four more once those were fixed:
--
--   * public.is_admin()                       (SECURITY DEFINER — critical)
--   * public.handle_user_email_change()       (SECURITY DEFINER)
--   * public.generate_coupon_redemption_code()
--   * public.update_updated_at()              (trigger function)
--
-- Same reasoning as 023: a function with a mutable search_path can be
-- tricked by a caller who creates a same-named table in pg_temp before
-- invoking. ALTER FUNCTION pins it once and for all.

ALTER FUNCTION public.is_admin()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.handle_user_email_change()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.generate_coupon_redemption_code()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.update_updated_at()
  SET search_path = public, pg_temp;

-- Note on the remaining "security_definer_view" advisor finding on
-- public.profiles_public: this view is intentionally SECURITY DEFINER.
-- Its sole purpose is to expose ONLY (id, full_name, avatar_url) from the
-- profiles table to any caller, bypassing the otherwise-restrictive RLS
-- on the base table. A SECURITY INVOKER view here would either return
-- zero rows for non-admin / non-owner callers (defeating its purpose) or
-- require re-adding a permissive base-table policy that would leak every
-- profile column. The Supabase advisor flags SECURITY DEFINER views as a
-- generic concern; in this specific case it is the correct pattern. Do
-- not "fix" it without rethinking the wider profiles access design.
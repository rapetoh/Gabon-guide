-- Migration 035: get_all_users_for_admin returns avatar_url.
--
-- The admin Users LIST rendered initials only — the detail page already
-- shows the photo, but the list RPC never returned avatar_url, so the list
-- couldn't. (Founder request 2026-07-16: show real photos in the admin
-- portal wherever one exists.) Return-type change requires DROP + CREATE.

DROP FUNCTION IF EXISTS public.get_all_users_for_admin();

CREATE FUNCTION public.get_all_users_for_admin()
RETURNS TABLE (
  id         uuid,
  full_name  text,
  avatar_url text,
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
    p.avatar_url,
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

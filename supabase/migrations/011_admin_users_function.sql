-- Migration 011: Email in profiles + admin users function
--
-- REASON: auth.users is only accessible server-side (service role key).
-- Accessing it from a SECURITY DEFINER function called via the client SDK
-- fails in Supabase's hosted environment. The canonical solution is to
-- mirror email into the profiles table via a trigger.
--
-- Steps:
-- 1. Add email column to profiles
-- 2. Backfill existing profiles from auth.users (safe in migration context)
-- 3. Update handle_new_user trigger to also copy email on signup
-- 4. Add trigger to sync email changes
-- 5. Create get_all_users_for_admin() that only queries profiles (no cross-schema join)

-- ── 1. Add email column ───────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

-- ── 2. Backfill existing users ────────────────────────────────────────────────
-- Runs as postgres (superuser) in migration context — auth.users is accessible here.
UPDATE public.profiles p
SET
  email     = u.email,
  full_name = COALESCE(
    p.full_name,
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name'
  )
FROM auth.users u
WHERE u.id = p.id;

-- ── 3. Update new-user trigger to copy email + name ──────────────────────────
-- For OAuth (Google/Apple), Supabase stores the name in raw_user_meta_data.
-- For email/password signups, the app passes data: { full_name } to signUp()
-- which also lands in raw_user_meta_data.
-- We try 'full_name' first (our app's key + Apple), then 'name' (Google).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      NULL
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    email     = EXCLUDED.email,
    -- Never overwrite an existing name with null (e.g. re-login shouldn't clear it)
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Sync email when user updates their email in auth ───────────────────────
CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS trigger AS $$
BEGIN
  UPDATE public.profiles
  SET email = new.email
  WHERE id = new.id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_change();

-- ── 5. Admin function — queries profiles only, no auth.users join ─────────────
CREATE OR REPLACE FUNCTION public.get_all_users_for_admin()
RETURNS TABLE (
  id          uuid,
  full_name   text,
  role        text,
  is_admin    boolean,
  email       text,
  joined_at   timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Accept either is_admin flag or role = 'admin' (both may be set)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = true OR profiles.role = 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    COALESCE(p.role, 'user')     AS role,
    COALESCE(p.is_admin, false)  AS is_admin,
    p.email,
    p.created_at                 AS joined_at
  FROM public.profiles p
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin() TO authenticated;

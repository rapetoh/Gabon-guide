-- Migration 033: profiles inherit name + photo from the OAuth provider.
--
-- Founder report (2026-07-12): reviews showed "User" + blank avatar even
-- for reviewers who signed in with Google. Cause: handle_new_user() only
-- copied (id, email, referred_by) into profiles — the full_name / avatar
-- that Google/Apple deliver in raw_user_meta_data were never persisted.
-- profiles_public (which reviews read) therefore had NULLs for everyone
-- who never manually set a name in the (brand-new) account screen.
--
-- Fix A: handle_new_user now seeds full_name + avatar_url from provider
--        metadata (full_name/name, avatar_url/picture) at signup. Users
--        can still change both later in "Mon compte".
-- Fix B: one-time backfill of existing profiles from auth.users metadata,
--        only where the profile fields are still NULL (never clobbers a
--        name or photo someone set themselves).

-- ─── A. Seed identity at signup ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_ref_code     text;
  v_referrer_id  uuid;
  v_name         text;
  v_avatar       text;
BEGIN
  v_ref_code := NULLIF(trim(NEW.raw_user_meta_data->>'referral_code'), '');

  IF v_ref_code IS NOT NULL THEN
    SELECT id INTO v_referrer_id
    FROM public.profiles
    WHERE referral_code = upper(v_ref_code)
    LIMIT 1;
  END IF;

  -- Providers differ: Google sends full_name + name + avatar_url + picture,
  -- Apple sends full_name (when shared), email/password sends none.
  v_name   := NULLIF(trim(COALESCE(
                NEW.raw_user_meta_data->>'full_name',
                NEW.raw_user_meta_data->>'name'
              )), '');
  v_avatar := NULLIF(trim(COALESCE(
                NEW.raw_user_meta_data->>'avatar_url',
                NEW.raw_user_meta_data->>'picture'
              )), '');

  INSERT INTO public.profiles (id, email, referred_by, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, v_referrer_id, v_name, v_avatar)
  ON CONFLICT (id) DO UPDATE
    SET email       = EXCLUDED.email,
        referred_by = COALESCE(public.profiles.referred_by, EXCLUDED.referred_by),
        full_name   = COALESCE(public.profiles.full_name,   EXCLUDED.full_name),
        avatar_url  = COALESCE(public.profiles.avatar_url,  EXCLUDED.avatar_url);

  INSERT INTO public.credit_balances (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  IF NEW.email_confirmed_at IS NOT NULL THEN
    PERFORM public.grant_referral_reward(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- ─── B. Backfill existing accounts (NULL fields only) ──────────────────

UPDATE public.profiles p
SET full_name = COALESCE(p.full_name, NULLIF(trim(COALESCE(
                  u.raw_user_meta_data->>'full_name',
                  u.raw_user_meta_data->>'name')), '')),
    avatar_url = COALESCE(p.avatar_url, NULLIF(trim(COALESCE(
                  u.raw_user_meta_data->>'avatar_url',
                  u.raw_user_meta_data->>'picture')), ''))
FROM auth.users u
WHERE u.id = p.id
  AND (p.full_name IS NULL OR p.avatar_url IS NULL);

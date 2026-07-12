-- Migration 032: let users edit their OWN profile (name, avatar, preferences).
--
-- Ship-blocker found during live UI testing (2026-07-12): the account-edit
-- screen ("Mon compte") saves the display name / avatar by UPDATE-ing the
-- caller's own profiles row. But the ONLY UPDATE policy on profiles was
-- profiles_admin_update (is_admin()). A regular user's UPDATE therefore
-- matched zero rows — and PostgREST reports a zero-row UPDATE as success,
-- so the app showed "Enregistré ✓" while nothing persisted. Name + avatar
-- edits were silently broken for every non-admin user.
--
-- Fix: add profiles_own_update so a user can update their own row — but
-- PIN every privilege/identity column to its current value in WITH CHECK,
-- so a user can change full_name / avatar_url / preferred_zones /
-- preferred_vibes and NOTHING else. In particular they cannot set
-- is_admin = true (privilege escalation), flip is_blocked, change role,
-- rewrite their referral_code, or re-point referred_by. email stays pinned
-- too — the change-email flow goes through Supabase Auth + the
-- on_auth_user_email_changed trigger (SECURITY DEFINER), not a direct write.
--
-- Admin edits are unaffected: profiles_admin_update still grants admins full
-- update on any row (RLS permissive policies are OR-ed).

DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;
CREATE POLICY "profiles_own_update" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND is_admin      =            (SELECT p.is_admin      FROM public.profiles p WHERE p.id = auth.uid())
    AND role          IS NOT DISTINCT FROM (SELECT p.role          FROM public.profiles p WHERE p.id = auth.uid())
    AND is_blocked    =            (SELECT p.is_blocked    FROM public.profiles p WHERE p.id = auth.uid())
    AND referral_code IS NOT DISTINCT FROM (SELECT p.referral_code FROM public.profiles p WHERE p.id = auth.uid())
    AND referred_by   IS NOT DISTINCT FROM (SELECT p.referred_by   FROM public.profiles p WHERE p.id = auth.uid())
    AND email         IS NOT DISTINCT FROM (SELECT p.email         FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Migration 027: foundations for the user account-edit + account-delete
-- screen (LOGIC_AUDIT 1.1 + 1.2 — Apple App Store requirement).
--
-- This migration delivers four DB-side pieces:
--
--   1. A new `avatars` storage bucket so users can actually upload an
--      avatar from the new profile-edit screen. Bucket is public-read,
--      capped at 2 MB, restricted to common image mime types, and each
--      user can only write into a folder named after their own UUID.
--
--   2. A `reviews.author_display_name` snapshot column. When a user
--      deletes their account, we copy their current full_name into this
--      column on each of their reviews so the review still attributes
--      to "Jane D." rather than disappearing or showing "anonymous".
--
--   3. Change the `reviews.user_id` foreign key from ON DELETE CASCADE
--      to ON DELETE SET NULL. Combined with #2, deleting a user
--      preserves their reviews but disconnects them from the auth row.
--
--   4. A `delete_my_account()` SECURITY DEFINER RPC. The mobile app
--      calls it; it (a) snapshots the display name, (b) deletes the
--      auth.users row, which cascades to profiles / favorites /
--      credit_balances / credit_transactions and sets-null on
--      coupon_redemptions / places.owner_id / reviews.user_id.

-- ─── 1. Avatars bucket ─────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2 * 1024 * 1024, -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;
CREATE POLICY "Avatars are publicly readable" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── 2. Reviews: author display-name snapshot column ──────────────────

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS author_display_name text;

COMMENT ON COLUMN public.reviews.author_display_name IS
  'Snapshot of the author full_name set when the user deletes their account, so reviews remain attributable (e.g. "Jane D.") rather than vanishing or showing as anonymous.';

-- ─── 3. Reviews FK: CASCADE → SET NULL ────────────────────────────────

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─── 4. delete_my_account() RPC ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_name    text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- Snapshot the user's display name onto their reviews so they continue
  -- to make sense after the user row is gone. Only set on rows that
  -- don't already have a snapshot (defensive — should be all of them).
  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_user_id;
  UPDATE public.reviews
  SET author_display_name = COALESCE(v_name, 'Utilisateur supprimé')
  WHERE user_id = v_user_id
    AND author_display_name IS NULL;

  -- Deleting the auth row cascades to:
  --   * profiles               (ON DELETE CASCADE)
  --   * favorites              (CASCADE)
  --   * credit_balances        (CASCADE)
  --   * credit_transactions    (CASCADE)
  -- and SET NULLs:
  --   * coupon_redemptions.user_id
  --   * reviews.user_id        (after the FK change above)
  --   * places.owner_id
  --   * profiles.referred_by
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

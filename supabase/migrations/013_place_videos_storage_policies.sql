-- Migration 013: Storage policies for place-videos bucket
--
-- Root cause of "new row violates row-level security policy" when uploading
-- a video: the place-videos storage bucket was created with no policies,
-- so every INSERT into storage.objects was blocked by RLS regardless of
-- user role. The place-photos policies only covered that bucket.
--
-- This migration adds:
--   - Public read on place-videos
--   - Admin upload/update/delete on place-videos
--   - Restaurant owner upload/delete on place-videos (path-scoped to their place)
--   - Restaurant owner upload/delete on place-photos (same pattern)

-- ── place-videos ─────────────────────────────────────────────────────────────

CREATE POLICY "Videos are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'place-videos');

CREATE POLICY "Admins can upload videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'place-videos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR is_admin = true)
    )
  );

CREATE POLICY "Admins can update videos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'place-videos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR is_admin = true)
    )
  );

CREATE POLICY "Admins can delete videos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'place-videos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR is_admin = true)
    )
  );

CREATE POLICY "Restaurant owners can upload videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'place-videos'
    AND EXISTS (
      SELECT 1 FROM public.places p
      JOIN public.profiles pr ON pr.id = auth.uid()
      WHERE p.owner_id = auth.uid()
        AND pr.role = 'restaurant_owner'
        AND (storage.foldername(name))[1] = p.id::text
    )
  );

CREATE POLICY "Restaurant owners can delete videos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'place-videos'
    AND EXISTS (
      SELECT 1 FROM public.places p
      JOIN public.profiles pr ON pr.id = auth.uid()
      WHERE p.owner_id = auth.uid()
        AND pr.role = 'restaurant_owner'
        AND (storage.foldername(name))[1] = p.id::text
    )
  );

-- ── place-photos (restaurant owner access, was missing) ───────────────────────

CREATE POLICY "Restaurant owners can upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'place-photos'
    AND EXISTS (
      SELECT 1 FROM public.places p
      JOIN public.profiles pr ON pr.id = auth.uid()
      WHERE p.owner_id = auth.uid()
        AND pr.role = 'restaurant_owner'
        AND (storage.foldername(name))[1] = p.id::text
    )
  );

CREATE POLICY "Restaurant owners can delete photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'place-photos'
    AND EXISTS (
      SELECT 1 FROM public.places p
      JOIN public.profiles pr ON pr.id = auth.uid()
      WHERE p.owner_id = auth.uid()
        AND pr.role = 'restaurant_owner'
        AND (storage.foldername(name))[1] = p.id::text
    )
  );

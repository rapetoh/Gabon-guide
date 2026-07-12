-- Migration 031: fix restaurant-owner storage uploads + add bucket limits.
-- (LOGIC_AUDIT items 2.3 and 2.4, verified still-open during full
-- verification 2026-07-12.)
--
-- Problem A (2.3): the "Restaurant owners can upload/delete photos/videos"
-- policies check `(storage.foldername(p.name))[1] = (p.id)::text` where p is
-- the places table — so it reads the place's DISPLAY NAME, not the uploaded
-- object's path. Proven false for a real owner+place+object triple, so
-- owners currently cannot upload or delete their own media (only admins can).
--   Extra subtlety: `places` has its own `name` column, so a bare `name`
--   inside the EXISTS subquery would ALSO resolve to places.name, not the
--   storage object. The fix pulls the object-path check to the policy's top
--   level (where the only relation is storage.objects) and matches its first
--   folder against the set of place IDs the caller owns.
--
-- Problem B (2.4): place-photos and place-videos buckets had NULL
-- file_size_limit and NULL allowed_mime_types — any authenticated user could
-- push a multi-GB blob or a disguised file. Add a 5 MB cap on photos (all
-- existing photos are <420 KB jpeg/png) and 50 MB on videos (all existing
-- videos are <11 MB mp4). Photo mime types are restricted to images; video
-- mime types are left unrestricted for now (one legitimate past upload came
-- through as application/octet-stream, so the size cap is the safe win and
-- mime tightening is deferred to avoid breaking the video upload path).

-- ─── A. Bucket size + mime limits ──────────────────────────────────────

UPDATE storage.buckets
   SET file_size_limit    = 5 * 1024 * 1024,
       allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
 WHERE id = 'place-photos';

UPDATE storage.buckets
   SET file_size_limit    = 50 * 1024 * 1024
 WHERE id = 'place-videos';

-- ─── B. Rewrite the four owner media policies ──────────────────────────
-- Structure: match the object's first path segment against the caller's
-- owned place IDs. Folder extraction stays at top level so `name` binds to
-- storage.objects.name, not places.name.

DROP POLICY IF EXISTS "Restaurant owners can upload photos" ON storage.objects;
CREATE POLICY "Restaurant owners can upload photos" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'place-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT p.id::text FROM public.places p
      JOIN public.profiles pr ON pr.id = auth.uid()
      WHERE p.owner_id = auth.uid() AND pr.role = 'restaurant_owner'
    )
  );

DROP POLICY IF EXISTS "Restaurant owners can delete photos" ON storage.objects;
CREATE POLICY "Restaurant owners can delete photos" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'place-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT p.id::text FROM public.places p
      JOIN public.profiles pr ON pr.id = auth.uid()
      WHERE p.owner_id = auth.uid() AND pr.role = 'restaurant_owner'
    )
  );

DROP POLICY IF EXISTS "Restaurant owners can upload videos" ON storage.objects;
CREATE POLICY "Restaurant owners can upload videos" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'place-videos'
    AND (storage.foldername(name))[1] IN (
      SELECT p.id::text FROM public.places p
      JOIN public.profiles pr ON pr.id = auth.uid()
      WHERE p.owner_id = auth.uid() AND pr.role = 'restaurant_owner'
    )
  );

DROP POLICY IF EXISTS "Restaurant owners can delete videos" ON storage.objects;
CREATE POLICY "Restaurant owners can delete videos" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'place-videos'
    AND (storage.foldername(name))[1] IN (
      SELECT p.id::text FROM public.places p
      JOIN public.profiles pr ON pr.id = auth.uid()
      WHERE p.owner_id = auth.uid() AND pr.role = 'restaurant_owner'
    )
  );

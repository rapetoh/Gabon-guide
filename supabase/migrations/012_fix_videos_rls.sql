-- Migration 012: Fix videos table RLS policies
--
-- Problem: the original "Admins can manage all videos" policy (migration 010)
-- had a USING clause but no WITH CHECK clause. PostgreSQL requires WITH CHECK
-- to authorize INSERT operations — without it, any INSERT violates RLS even
-- for admins.
--
-- Also aligns the admin check with the rest of the codebase: checks both
-- role = 'admin' AND is_admin = true so either field alone is sufficient.

-- Admin policy: drop old, recreate with explicit WITH CHECK
DROP POLICY IF EXISTS "Admins can manage all videos" ON public.videos;

CREATE POLICY "Admins can manage all videos"
  ON public.videos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR is_admin = true)
    )
  );

-- Restaurant owner policy: same fix — add WITH CHECK
DROP POLICY IF EXISTS "Restaurant owners can manage their place videos" ON public.videos;

CREATE POLICY "Restaurant owners can manage their place videos"
  ON public.videos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.places p
      WHERE p.id = videos.place_id
        AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.places p
      WHERE p.id = videos.place_id
        AND p.owner_id = auth.uid()
    )
  );

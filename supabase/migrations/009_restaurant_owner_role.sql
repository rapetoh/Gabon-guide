-- Migration 009: Restaurant owner role
-- Adds a role column to profiles and an owner_id FK to places.
-- Restaurant owners can edit their own place and manage their own photos.

-- 1. Add role to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'restaurant_owner', 'admin'));

COMMENT ON COLUMN profiles.role IS 'User role: user (default), restaurant_owner, or admin.';

-- 2. Add owner_id to places (nullable — not all places have an owner account yet)
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS places_owner_id_idx ON places (owner_id);

COMMENT ON COLUMN places.owner_id IS 'Profile ID of the restaurant owner account, if any.';

-- 3. RLS policy: restaurant owners can UPDATE their own place
CREATE POLICY "restaurant_owner_update_own_place"
  ON places
  FOR UPDATE
  USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'restaurant_owner'
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
  );

-- 4. RLS policy: restaurant owners can INSERT photos for their own place
CREATE POLICY "restaurant_owner_insert_photo"
  ON photos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM places p
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE p.id = photos.place_id
        AND p.owner_id = auth.uid()
        AND pr.role = 'restaurant_owner'
    )
  );

-- 5. RLS policy: restaurant owners can DELETE their own place's photos
CREATE POLICY "restaurant_owner_delete_photo"
  ON photos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM places p
      JOIN profiles pr ON pr.id = auth.uid()
      WHERE p.id = photos.place_id
        AND p.owner_id = auth.uid()
        AND pr.role = 'restaurant_owner'
    )
  );

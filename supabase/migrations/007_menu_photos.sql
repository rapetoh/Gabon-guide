-- Migration 007: Add is_menu flag to photos table
-- Allows marking photos as menu photos, separate from the regular gallery.

ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS is_menu boolean NOT NULL DEFAULT false;

-- Index for fast filtering on place detail page
CREATE INDEX IF NOT EXISTS photos_place_is_menu_idx ON photos (place_id, is_menu);

-- Comment
COMMENT ON COLUMN photos.is_menu IS 'When true, photo is shown in the Menu section, not the general gallery.';

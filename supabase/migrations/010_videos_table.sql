-- Migration 010: videos table for TikTok-style video feed
--
-- NOTE: After running this migration, create the 'place-videos' Storage bucket
--       manually in the Supabase dashboard:
--         Storage → New bucket → name: "place-videos" → Public: ON
--
-- Each place can have one or more videos.
-- The first video (lowest position) is used as the primary feed card.

CREATE TABLE IF NOT EXISTS videos (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id      uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  thumbnail_url text,
  caption       text,
  position      integer NOT NULL DEFAULT 0,
  created_at    timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_videos_place_id ON videos(place_id);
CREATE INDEX IF NOT EXISTS idx_videos_place_position ON videos(place_id, position);

-- Row Level Security
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Everyone (including anon) can read videos
CREATE POLICY "Videos are publicly readable"
  ON videos FOR SELECT USING (true);

-- Admins can manage all videos
CREATE POLICY "Admins can manage all videos"
  ON videos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Restaurant owners can manage videos for their own place
CREATE POLICY "Restaurant owners can manage their place videos"
  ON videos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM places p
      WHERE p.id = videos.place_id
        AND p.owner_id = auth.uid()
    )
  );

-- Migration 008: Add onboarding preference columns to profiles
-- Stores user's preferred zones and vibes selected during onboarding.
-- Both default to empty array so existing rows are unaffected.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_zones text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_vibes text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN profiles.preferred_zones IS 'Zone IDs or names selected during onboarding (e.g. ["Centre-ville", "Akanda"]).';
COMMENT ON COLUMN profiles.preferred_vibes IS 'Vibe tags selected during onboarding (e.g. ["Restaurants", "Nightlife"]).';

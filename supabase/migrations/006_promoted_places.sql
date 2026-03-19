-- Migration 006: Add promotion fields to places
-- Enables the "Trending Now" monetization feature on the home screen.
-- When is_promoted = true, the place appears at the top of "Trending Now"
-- with a visible badge (promoted_label_fr / promoted_label_en).

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS is_promoted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS promoted_label_fr text,  -- e.g. "Partenaire", "À la une"
  ADD COLUMN IF NOT EXISTS promoted_label_en text;  -- e.g. "Partner", "Featured"

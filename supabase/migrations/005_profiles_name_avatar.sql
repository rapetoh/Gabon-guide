-- Migration 005: Add full_name and avatar_url to profiles
-- Required for displaying reviewer names on place detail screens.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

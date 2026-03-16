-- O'Kili — Schema Improvements
-- Migration 003

-- ============================================================
-- PLACES: add soft delete + hours freshness tracking
-- ============================================================

alter table public.places
  add column is_deleted boolean not null default false;

-- Tracks when the content team last confirmed hours are accurate.
-- Null = never verified since entry was created.
alter table public.places
  add column hours_verified_at timestamptz default null;

-- ============================================================
-- PHOTOS: add soft delete + display ordering
-- ============================================================

alter table public.photos
  add column is_deleted boolean not null default false;

-- Controls gallery display order. Lower number = shown first.
-- 0 = default; admin can set 1, 2, 3... to control order.
alter table public.photos
  add column position int not null default 0;

-- ============================================================
-- UPDATE RLS POLICIES
-- Soft-deleted rows must never be visible to regular users.
-- Admin policies are unchanged — admins need to see deleted rows
-- to be able to restore them.
-- ============================================================

-- PLACES: update public read to exclude soft-deleted rows
drop policy "places_public_read" on public.places;

create policy "places_public_read"
  on public.places for select
  using (is_active = true and is_deleted = false);

-- PHOTOS: update public read to exclude soft-deleted rows
drop policy "photos_public_read" on public.photos;

create policy "photos_public_read"
  on public.photos for select
  using (is_deleted = false);

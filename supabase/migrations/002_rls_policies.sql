-- O'Kili — Row Level Security Policies
-- Migration 002

-- Enable RLS on all tables
alter table public.categories enable row level security;
alter table public.zones enable row level security;
alter table public.places enable row level security;
alter table public.photos enable row level security;
alter table public.profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.weekly_feed enable row level security;

-- ============================================================
-- Helper function: check if current user is admin
-- ============================================================
create or replace function public.is_admin()
returns boolean as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$ language sql security definer;

-- ============================================================
-- CATEGORIES — public read, admin write
-- ============================================================
create policy "categories_public_read"
  on public.categories for select
  using (true);

create policy "categories_admin_write"
  on public.categories for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- ZONES — public read, admin write
-- ============================================================
create policy "zones_public_read"
  on public.zones for select
  using (true);

create policy "zones_admin_write"
  on public.zones for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- PLACES — public read active only, admin full access
-- ============================================================
create policy "places_public_read"
  on public.places for select
  using (is_active = true);

create policy "places_admin_read_all"
  on public.places for select
  using (public.is_admin());

create policy "places_admin_write"
  on public.places for insert
  with check (public.is_admin());

create policy "places_admin_update"
  on public.places for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "places_admin_delete"
  on public.places for delete
  using (public.is_admin());

-- ============================================================
-- PHOTOS — public read, admin write
-- ============================================================
create policy "photos_public_read"
  on public.photos for select
  using (true);

create policy "photos_admin_write"
  on public.photos for insert
  with check (public.is_admin());

create policy "photos_admin_delete"
  on public.photos for delete
  using (public.is_admin());

-- ============================================================
-- PROFILES — users read/update own row, admin reads all
-- ============================================================
create policy "profiles_own_read"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_admin_read_all"
  on public.profiles for select
  using (public.is_admin());

create policy "profiles_admin_update"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- FAVORITES — users manage their own favorites only
-- ============================================================
create policy "favorites_own_read"
  on public.favorites for select
  using (user_id = auth.uid());

create policy "favorites_own_insert"
  on public.favorites for insert
  with check (user_id = auth.uid());

create policy "favorites_own_delete"
  on public.favorites for delete
  using (user_id = auth.uid());

-- ============================================================
-- WEEKLY FEED — public read, admin write
-- ============================================================
create policy "weekly_feed_public_read"
  on public.weekly_feed for select
  using (true);

create policy "weekly_feed_admin_write"
  on public.weekly_feed for all
  using (public.is_admin())
  with check (public.is_admin());

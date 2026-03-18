-- O'Kili — Map, Reviews, Subcategories, Website
-- Migration 004

-- ============================================================
-- PLACES: add map coordinates + website URL
-- ============================================================

-- GPS coordinates for map pin placement.
-- Nullable: content team adds these when visiting the venue.
alter table public.places
  add column latitude  decimal(10, 7) default null,
  add column longitude decimal(10, 7) default null;

-- Optional website URL for the venue.
alter table public.places
  add column website text default null;

-- ============================================================
-- SUBCATEGORIES
-- Category-specific type labels shown as filter chips.
-- Examples:
--   Dining     → Local, French, Asian, Italian, Seafood, African Fusion...
--   Nightlife  → Bar, Lounge, Club, Rooftop...
--   Activities → Nature, Beach, Culture, Sport, Family...
--   Cafés      → Coffee Shop, Bakery, Juice Bar...
-- ============================================================

create table public.subcategories (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete cascade not null,
  name_fr     text not null,
  name_en     text not null,
  slug        text not null,
  created_at  timestamptz default now(),
  unique (category_id, slug)
);

-- Each place belongs to one subcategory (optional — null = uncategorized)
alter table public.places
  add column subcategory_id uuid references public.subcategories(id) on delete set null;

-- ============================================================
-- REVIEWS
-- Users can leave a rating + comment on any place.
-- One review per user per place.
-- ============================================================

create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid references public.places(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  rating     int not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (place_id, user_id)  -- one review per user per place
);

-- Auto-update updated_at on edit
create trigger reviews_updated_at
  before update on public.reviews
  for each row execute function public.update_updated_at();

-- ============================================================
-- RLS POLICIES — subcategories + reviews
-- ============================================================

-- SUBCATEGORIES: public read, admin write
alter table public.subcategories enable row level security;

create policy "subcategories_public_read"
  on public.subcategories for select
  using (true);

create policy "subcategories_admin_write"
  on public.subcategories for all
  using (public.is_admin())
  with check (public.is_admin());

-- REVIEWS: public read, authenticated users write their own
alter table public.reviews enable row level security;

create policy "reviews_public_read"
  on public.reviews for select
  using (true);

create policy "reviews_own_insert"
  on public.reviews for insert
  with check (user_id = auth.uid());

create policy "reviews_own_update"
  on public.reviews for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "reviews_own_delete"
  on public.reviews for delete
  using (user_id = auth.uid());

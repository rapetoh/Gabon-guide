-- O'Kili — Initial Database Schema
-- Migration 001

-- ============================================================
-- CATEGORIES
-- ============================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name_fr text not null,
  name_en text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

-- ============================================================
-- ZONES (Libreville neighborhoods — names TBD before launch)
-- ============================================================
create table public.zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

-- ============================================================
-- PLACES
-- ============================================================
create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references public.categories(id),
  zone_id uuid references public.zones(id),
  price_range int check (price_range between 1 and 3),
  -- 1 = Économique / Budget
  -- 2 = Intermédiaire / Mid-range
  -- 3 = Haut de gamme / Upscale
  -- CFA thresholds to be confirmed before launch
  description_fr text,
  description_en text,
  address text,
  phone text,     -- stored in international format: +241XXXXXXXXX
  whatsapp text,  -- stored in international format: +241XXXXXXXXX
  hours jsonb,
  -- hours format:
  -- {
  --   "mon": { "open": "08:00", "close": "22:00", "closed": false, "overnight": false },
  --   "tue": { "open": "08:00", "close": "22:00", "closed": false, "overnight": false },
  --   ...
  -- }
  -- overnight: true = closes after midnight (important for bars)
  is_active boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at on any change
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger places_updated_at
  before update on public.places
  for each row execute function public.update_updated_at();

-- ============================================================
-- PHOTOS
-- ============================================================
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid references public.places(id) on delete cascade,
  storage_path text not null,
  is_primary boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- PROFILES (used for admin role detection)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- FAVORITES
-- ============================================================
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  place_id uuid references public.places(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, place_id)
);

-- ============================================================
-- WEEKLY FEED
-- ============================================================
create table public.weekly_feed (
  id uuid primary key default gen_random_uuid(),
  week_of date not null,  -- Monday of the target week
  place_id uuid references public.places(id) on delete cascade,
  rank int not null,
  label_fr text,  -- e.g. "Coup de coeur"
  label_en text,  -- e.g. "Staff Pick"
  created_at timestamptz default now()
);

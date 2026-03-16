# O'Kili — Product Requirements Document (PRD)

**Version:** 0.2
**Last Updated:** March 2026
**Author:** Roch APETOH
**App Name:** O'Kili

---

## 1. Project Overview

### One-Sentence Pitch
A mobile city guide for Libreville, Gabon where users discover restaurants, bars, and tourist
activities via category + zone-based search, with a business model built on B2B subscriptions
and sponsored placements.

### Problem
Libreville has no reliable digital discovery tool for locals, expats, and visitors. Existing
global apps (Google Maps, TripAdvisor) have poor coverage, outdated information, and no
Gabon-specific context.

### Solution
A curated, mobile-first directory for Libreville — every listing hand-picked and confirmed
by the O'Kili team, built around the three things users actually need: price range, real photos,
and reliable hours.

### Quality Promise
Every place on O'Kili is hand-picked and confirmed by our team.
No listing goes live without the team verifying it exists, is open, and has accurate information.
This is communicated globally in the app (onboarding + About screen) — not as a per-listing badge.

### Target Geography
Libreville, Gabon (MVP). Other Gabonese cities post-MVP.

### Target Users
- Locals planning weekend outings
- Expats and professionals living in Libreville
- Visitors and tourists
- Business owners seeking digital visibility

---

## 2. Research Validation (Survey — 19 Responses)

### Key Findings

| Signal | Finding | Product Implication |
|---|---|---|
| Usage frequency | Occasional (weekends / going out), not daily | Add a weekly re-engagement hook |
| Top must-have #1 | Price range / budget info | Required field on every listing |
| Top must-have #2 | Recent real photos | Required on every listing, curated by admin |
| Top must-have #3 | Reliable open/closed hours | Required field; computed Open/Closed status |
| Location preference | Zone-based acceptable; GPS-precise not required | Neighborhood zones, not GPS coordinates |
| Transport feature | Useful but not #1 priority | Deferred to post-MVP |
| Pricing model | Strong preference for free app | Free for users; B2B monetization |

### Weekly Re-Engagement Strategy
Because usage is occasional, we add a weekly curated feed: **"Week-end à Libreville"**
(Top 10 spots + new arrivals) to give users a reason to open the app every week.

If no feed has been curated for the current week, the home screen falls back to showing the
most recently added listings automatically — the home screen never looks empty or stale.

---

## 3. Product Vision

### Core Philosophy
- **Curated-first:** Quality over quantity. Every listing is confirmed by the team before going live.
- **Accurate data:** Price, hours, and photos are team-controlled to ensure reliability.
- **WhatsApp-first conversion:** Users contact venues via WhatsApp or phone — no booking forms.
- **Offline-aware growth:** Word of mouth + WhatsApp sharing is the primary viral loop.

### Patterns Borrowed from US Apps (Adapted for Libreville)

| US Pattern | Source | Libreville Adaptation |
|---|---|---|
| Clean place pages + discovery | Yelp / TripAdvisor | Team-curated data (not user-generated) |
| Quick contact/conversion | OpenTable | WhatsApp + Call instead of reservation forms |
| "Things to do" feed | Eventbrite | "Week-end à Libreville" weekly curation |
| Business visibility tools | Yelp for Business | Tiered B2B subscription model |

---

## 4. MVP Scope

### In Scope

#### Listing Categories
- Restaurants
- Bars
- Activities (tourist / leisure)

#### Search & Filters
- Filter by category
- Filter by price range (Économique / Intermédiaire / Haut de gamme)
- Filter by zone (neighborhood-based — list TBD)
- Filter by open now (computed from stored hours, always using Libreville time UTC+1)

#### Place Detail Page

| Field | Required | Notes |
|---|---|---|
| Name | Yes | |
| Category | Yes | |
| Zone | Yes | Neighborhood name |
| Price range | Yes | Économique / Intermédiaire / Haut de gamme — CFA thresholds TBD before launch |
| Hours | Yes | Per day; app computes Open/Closed using Libreville timezone (UTC+1) |
| Photos | Yes | Minimum 1; recent and real; uploaded by team |
| Description | No | Short bilingual text (FR + EN) |
| Address | No | Approximate street/area |
| Phone | No | Stored in international format (+241XXXXXXXX) |
| WhatsApp number | No | Auto-formatted to international format for wa.me links |

#### Action CTAs (Prominent on Detail Page)
- WhatsApp (opens `wa.me` deep link — number auto-formatted to international format)
- Call (`tel:` link)
- Save to Favorites (requires login)
- Share (Branch.io smart link — works whether recipient has the app or not)

#### Weekly Feed — "Week-end à Libreville"
- Displayed on home screen
- Top 10 curated spots + new arrivals, admin-managed each week
- Labels per listing (e.g., "Coup de coeur" / "Nouveau")
- Fallback: if no feed curated this week, show most recently added listings automatically

#### User Accounts
Sign-in options (low-friction, no roadblocks):
- **Email + Password** — classic fallback for all users
- **Google Sign-In** — 1-tap on Android
- **Apple Sign-In** — required by Apple App Store when any social login is offered

All three handled via Supabase Auth. Login required only for Favorites.
Browsing and search always available without login.
If a logged-out user taps Save, they see a login bottom sheet — never blocked from browsing.

#### Admin Panel — Two Surfaces

**1. In-App Admin Mode (Mobile)**
- Accessible to admin accounts only (not visible to regular users)
- Create/edit listings from the field
- Upload photos directly from phone camera
- Ideal for content team on the ground

**2. Web Admin Dashboard (`/web`)**
- Full management interface on desktop
- Create / edit / delete listings
- Manage weekly feed curation
- Publishing workflow
- Photo management

Admin capabilities (both surfaces):
- Create / edit place listings
- Upload and manage photos (compressed before upload)
- Set and update hours
- Set price range
- Publish / unpublish listings

### Out of Scope (Post-MVP)
- User reviews and ratings
- Deals and promos
- Sponsored / paid featured placements
- Transport deep-link (Uber / local taxis)
- Reservations
- Business self-service portal
- Business analytics dashboard
- Push notifications
- Events calendar
- Coverage outside Libreville
- Per-listing verified badge (replaced by global quality promise)

---

## 5. User Stories

### End User
- As a user, I can browse places by category (restaurants / bars / activities)
- As a user, I can filter results by price range, zone, and open-now status
- As a user, I can view a place detail page with photos, hours, price, and description
- As a user, I can see whether a place is currently open or closed (Libreville time)
- As a user, I can WhatsApp or call a venue directly from the app
- As a user, I can save favorite places (login required)
- As a user, I can share a place via a smart link that works even without the app installed
- As a user, I can see a weekly curated feed ("Week-end à Libreville")
- As a user, I can register and log in with email/password, Google, or Apple

### Admin (Mobile In-App)
- As an admin, I can access a hidden admin section with my admin account
- As an admin, I can create a new listing from my phone
- As an admin, I can upload photos for a listing from my phone camera
- As an admin, I can update hours, price range, and details for any listing

### Admin (Web Dashboard)
- As an admin, I can view all listings and their publish status
- As an admin, I can create, edit, and delete listings
- As an admin, I can publish or unpublish listings
- As an admin, I can manage the weekly feed (select, label, and rank spots)
- As an admin, I can upload and organize photos for any listing

---

## 6. Monetization Model

### Principle
The app is **always free for users**. Revenue comes from businesses.

### Business Tiers (Post-MVP rollout)

| Tier | Price | What's Included |
|---|---|---|
| Free listing | 0 | Name, category, zone — no photos, no hours, no CTA buttons |
| Standard | TBD/month | Full listing: photos + hours + price range + WhatsApp/Call CTAs + analytics |
| Premium | TBD/month | Standard + featured placement in search/feed + promos + advanced analytics |

### MVP Approach
All listings are admin-managed. Monetization tiers defined here but not enforced in the product yet.
First paying businesses onboarded manually by the founder.

---

## 7. App Languages

- **French (FR):** Primary — Gabon's official language; default app language
- **English (EN):** Secondary — for expats and visitors
- All place content fields (description, weekly feed labels) bilingual where possible
- Full UI string translations in both languages from MVP
- Language toggle in app settings

---

## 8. Tech Stack

### Repository Structure (Monorepo)

```
okili/
├── mobile/          # React Native (Expo) app
├── web/             # Next.js web admin dashboard
├── docs/            # PRD, PLAN, research docs
└── supabase/        # DB migrations, seed data, RLS policies
```

### Mobile App (`/mobile`)

| Layer | Technology | Notes |
|---|---|---|
| Framework | React Native + Expo (managed) | iOS first; Android at launch |
| Navigation | Expo Router (file-based) | |
| Language | TypeScript | |
| Data fetching | TanStack Query (React Query) | Caching, loading states, pagination |
| Supabase client | @supabase/supabase-js | |
| Images | expo-image | Progressive loading |
| Image compression | expo-image-manipulator | Compress before upload |
| Linking | expo-linking | WhatsApp / Call |
| Auth (Google) | expo-auth-session | |
| Auth (Apple) | expo-apple-authentication | |
| Deep links / Share | Branch.io SDK | Smart links — works with/without app |
| Analytics | PostHog (React Native SDK) | CTA taps, page views, feed opens |
| i18n | i18next + react-i18next | |

### Web Admin Dashboard (`/web`)

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth | Supabase Auth |
| Hosting | Vercel (free tier) |

### Backend — Supabase

| Feature | Supabase Service |
|---|---|
| Authentication | Supabase Auth (email/password + Google + Apple OAuth) |
| Database | Supabase Postgres |
| File storage | Supabase Storage (place photos — compressed before upload) |
| Security | Row Level Security (RLS) policies |
| API | Auto-generated REST via supabase-js |
| Edge Functions | Deferred to post-MVP |

### Database Schema

```sql
-- Categories
create table categories (
  id uuid primary key default gen_random_uuid(),
  name_fr text not null,
  name_en text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

-- Zones (neighborhoods — list TBD)
create table zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

-- Places
create table places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references categories(id),
  zone_id uuid references zones(id),
  price_range int check (price_range between 1 and 3),
  -- 1 = Économique, 2 = Intermédiaire, 3 = Haut de gamme (CFA thresholds TBD)
  description_fr text,
  description_en text,
  address text,
  phone text,           -- stored in international format: +241XXXXXXXX
  whatsapp text,        -- stored in international format: +241XXXXXXXX
  hours jsonb,
  -- { mon: {open:"08:00", close:"02:00", closed:false, overnight:true}, ... }
  -- overnight:true = closes after midnight (e.g. bars)
  is_active boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Photos
create table photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid references places(id) on delete cascade,
  storage_path text not null,
  is_primary boolean default false,
  created_at timestamptz default now()
);

-- User profiles (used for admin role detection)
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- Favorites
create table favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  place_id uuid references places(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, place_id)
);

-- Weekly Feed
create table weekly_feed (
  id uuid primary key default gen_random_uuid(),
  week_of date not null,  -- Monday of the target week
  place_id uuid references places(id) on delete cascade,
  rank int not null,
  label_fr text,          -- e.g. "Coup de coeur"
  label_en text,          -- e.g. "Staff Pick"
  created_at timestamptz default now()
);
```

---

## 9. UX & Design Principles

- **Mobile-first:** iOS first for development and testing; Android at public launch
- **Fast images:** Compressed before upload (max 1200px, ~80% quality); progressive loading
- **Prominent CTAs:** WhatsApp and Call buttons always visible on detail page, above the fold
- **Zone over GPS:** No map view required — neighborhood zone filter is sufficient for MVP
- **Libreville timezone:** "Open now" always computed in Libreville local time (UTC+1 / WAT), regardless of user's device timezone
- **Midnight handling:** Bars/venues with hours past midnight handled correctly (e.g., open 21:00 → closes 02:00 next day)
- **WhatsApp formatting:** Phone numbers auto-formatted to international format (+241XXXXXXXX) for wa.me links
- **Smart sharing:** Branch.io links work whether recipient has O'Kili installed or not
- **Login without friction:** Social login (Google/Apple) reduces sign-up to 1 tap
- **Offline-graceful:** Cache recent search results where feasible

---

## 10. Launch & Content Strategy

A small hired team (1-2 people in Libreville) builds the initial listing database before launch:
- Visit or contact venues to confirm they exist and are open
- Photograph each place (minimum 1 primary photo per listing)
- Verify hours, price range, WhatsApp/phone numbers
- Enter data via web admin dashboard or in-app admin mode

**Launch target:** 50+ listings across all categories before public launch.
Quality over quantity: 50 great listings beats 200 incomplete ones.

**Price range calibration:** The content team defines CFA thresholds during the first listing
sprint. These must be confirmed before launch and communicated in the app UI.
Example: Économique = moins de 5 000 CFA / Intermédiaire = 5 000–15 000 CFA / Haut de gamme = plus de 15 000 CFA.

---

## 11. Analytics Plan

PostHog (free tier) integrated from Phase 1. Events tracked from day 1:

| Event | Why |
|---|---|
| `place_viewed` | Most viewed listings; content team priority |
| `cta_whatsapp_tapped` | Core conversion metric; B2B sales proof |
| `cta_call_tapped` | Core conversion metric |
| `cta_save_tapped` | Engagement signal |
| `cta_share_tapped` | Viral loop signal |
| `weekly_feed_opened` | Re-engagement metric |
| `filter_used` | Which filters matter most |

No dashboard shown to businesses in MVP — data collected silently. Used for B2B sales pitch
("X people tapped WhatsApp to contact you this month") and product decisions.

---

## 12. Success Metrics (MVP Launch Targets)

| Metric | Target |
|---|---|
| Listings at launch | 50+ |
| Weekly active users (Month 1) | 200+ |
| CTA tap rate (WhatsApp / Call) | > 20% of detail page views |
| Weekly feed open rate | > 40% of weekly active users |
| First paying businesses | 5+ Standard/Premium within 60 days of launch |

---

## 13. Go-to-Market Notes

- **Offline growth matters:** Print flyers, local partnerships, word of mouth are key channels
- **WhatsApp is the viral loop:** Share button → Branch.io smart link → WhatsApp forward
- **Quality signal at launch:** Team-curated listings are the core differentiator vs. Google Maps
- **B2B sales:** Direct outreach to restaurants and bars; PostHog data is the sales proof
- **Launch hook:** "Week-end à Libreville" launch edition to drive first-week installs

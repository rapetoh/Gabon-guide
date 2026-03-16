# O'Kili — Technical Build Plan

**Version:** 0.3
**Last Updated:** March 2026
**Linked PRD:** [PRD.md](./PRD.md)

---

## Overview

This document defines the phases and tasks to build the O'Kili MVP.
Build and testing: iOS first (iPhone). Published to both App Store and Google Play at launch.

Each phase ends with a **QA gate** — a checklist of tests to run before moving to the next phase.
Do not start the next phase until all tests in the current phase pass.

Two phases also include **automated unit tests** for critical logic that is easy to get silently wrong.

```
okili/
├── mobile/      # Expo (React Native) app — iOS first
├── web/         # Next.js admin dashboard
├── docs/        # PRD, PLAN, research
└── supabase/    # Migrations, seed, RLS
```

---

## Phase 0 — Project Setup

**Goal:** Working skeleton; all tools configured; team can run the project locally.

### 0.1 Repository & Tooling
- [ ] Rename/restructure repo root to reflect O'Kili branding
- [ ] Initialize `/mobile`, `/web`, `/supabase`, `/docs` folders
- [ ] Add root `.gitignore` (Node, Expo, Next.js, `.env` files)
- [ ] Add root `README.md` with setup instructions per workspace

### 0.2 Supabase Project
- [ ] Create Supabase account and new project
- [ ] Store `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env` files (never commit)
- [ ] Enable Email/Password auth
- [ ] Configure Google OAuth provider (Google Cloud Console credentials)
- [ ] Configure Apple OAuth provider (Apple Developer credentials — account confirmed)
- [ ] Add redirect URLs for Expo deep link scheme

### 0.3 Mobile App Bootstrap (`/mobile`)
- [ ] Init Expo project with TypeScript template: `npx create-expo-app`
- [ ] Install and configure Expo Router (file-based routing)
- [ ] Install `@supabase/supabase-js` — configure Supabase client
- [ ] Install `@tanstack/react-query` — configure QueryClient provider
- [ ] Install `expo-image`, `expo-linking`, `expo-image-manipulator`
- [ ] Install `expo-auth-session` (Google) and `expo-apple-authentication` (Apple)
- [ ] Install Branch.io React Native SDK — configure with Branch key
- [ ] Install PostHog React Native SDK — configure with project API key
- [ ] Install `i18next` + `react-i18next` — scaffold `locales/fr.json` and `locales/en.json`
- [ ] Install `jest` + `jest-expo` for automated testing
- [ ] Configure `app.json`: name = O'Kili, bundle ID = `com.okili.app`, icons placeholder

### 0.4 Web Admin Bootstrap (`/web`)
- [ ] Init Next.js app with TypeScript + Tailwind: `npx create-next-app`
- [ ] Install `@supabase/supabase-js` — configure Supabase client
- [ ] Add auth guard middleware (redirect to `/login` if no session)

### 0.5 Database Schema
- [ ] Write migration files in `/supabase/migrations/`
- [ ] Create tables: `categories`, `zones`, `places`, `photos`, `profiles`, `favorites`, `weekly_feed`
- [ ] Apply migrations: `supabase db push`
- [ ] Seed: categories (Restaurant, Bar, Activity), placeholder zones (TBD)
- [ ] Create Storage bucket: `place-photos` (public read, authenticated write)
- [ ] Generate TypeScript types: `supabase gen types typescript` → shared between `/mobile` and `/web`

### 0.6 Row Level Security (RLS)
- [ ] `places`: public SELECT where `is_active = true`; admin-only INSERT/UPDATE/DELETE
- [ ] `photos`: public SELECT; admin-only INSERT/DELETE
- [ ] `profiles`: users can SELECT their own row; admin-only UPDATE `is_admin`
- [ ] `favorites`: authenticated users SELECT/INSERT/DELETE their own rows only
- [ ] `weekly_feed`: public SELECT; admin-only INSERT/UPDATE/DELETE
- [ ] `categories` + `zones`: public SELECT; admin-only modifications

### 0.7 Admin Role Setup
- [ ] `profiles` table auto-creates a row with `is_admin = false` on every new user signup
  (via Supabase Database Trigger or auth webhook)
- [ ] Manually set `is_admin = true` for admin users directly in Supabase dashboard
- [ ] Document this process in README for the team

---

### Phase 0 — QA Gate (run before starting Phase 1)

**Supabase**
- [ ] Open Supabase dashboard → Table Editor → confirm all 7 tables exist with correct columns
- [ ] Confirm seed data: 3 categories (Restaurant, Bar, Activity) visible in `categories` table
- [ ] Confirm Storage bucket `place-photos` exists
- [ ] RLS test — anonymous INSERT blocked: in Supabase SQL editor run:
  `insert into places (name) values ('test');` → should return a permission error
- [ ] Create a test user via Supabase Auth dashboard → confirm a `profiles` row is created automatically with `is_admin = false`

**Mobile App**
- [ ] Run `npx expo start` — app launches in Expo Go on iPhone without crashing
- [ ] App connects to Supabase: no red error banners on launch
- [ ] TypeScript compiles: `npx tsc --noEmit` → zero errors

**Web Admin**
- [ ] Run `npm run dev` in `/web` — opens in browser without errors
- [ ] Visiting `/admin` redirects to `/login` (auth guard working)

---

## Phase 1 — Mobile App Foundation

**Goal:** Navigation in place; real Supabase data flowing; auth fully working.

### 1.1 Navigation Structure (Expo Router)

```
mobile/app/
├── (tabs)/
│   ├── index.tsx           # Home — weekly feed
│   ├── explore.tsx         # Browse/search/filter
│   └── favorites.tsx       # Saved places (login required)
├── place/[id].tsx          # Place detail page
├── auth/
│   ├── _layout.tsx
│   └── login.tsx           # Login + register screen
└── admin/
    ├── _layout.tsx         # Auth guard — admin only
    ├── index.tsx           # Listings dashboard
    ├── place/new.tsx       # Create listing
    └── place/[id]/edit.tsx # Edit listing
```

- [ ] Build bottom tab navigator (Home / Explore / Favorites)
- [ ] Add place detail dynamic route
- [ ] Add auth screens
- [ ] Add admin section with layout-level auth guard (admin role check)

### 1.2 Data Layer (TanStack Query + Supabase)
- [ ] `usePlaces(filters)` — paginated active places with filter support
- [ ] `usePlace(id)` — single place with photos
- [ ] `useCategories()` — all categories
- [ ] `useZones()` — all zones
- [ ] `useSession()` — current auth session
- [ ] `useIsAdmin()` — query `profiles` table for `is_admin`
- [ ] `useFavorites()` — user's saved places (add / remove / check)
- [ ] `useWeeklyFeed()` — current week's feed; fallback to recent listings if empty

### 1.3 Auth Flow
- [ ] Login/Register screen: three clear options — Email+Password | Google | Apple
- [ ] Email + password: register form + login form
- [ ] Google Sign-In: `expo-auth-session` + Supabase `signInWithOAuth`
- [ ] Apple Sign-In: `expo-apple-authentication` + Supabase `signInWithIdToken`
- [ ] Persistent session (AsyncStorage — Supabase client handles automatically)
- [ ] Logout
- [ ] Admin detection: query `profiles` table → `is_admin = true`
- [ ] Non-blocking auth: unauthenticated user taps Save → login bottom sheet, not redirect

### 1.4 Analytics Setup
- [ ] Initialize PostHog in app root
- [ ] Create `useAnalytics()` helper hook for clean event tracking
- [ ] Track screen views automatically via Expo Router

---

### Phase 1 — QA Gate (run before starting Phase 2)

**Navigation**
- [ ] Tap all 3 tabs (Home / Explore / Favorites) — each loads without crashing
- [ ] Navigate to a place detail page — loads correctly
- [ ] Navigate to auth screen — loads correctly
- [ ] Back navigation works on all screens

**Auth — Email/Password**
- [ ] Register a new account with email + password → success
- [ ] Log out → session cleared
- [ ] Log back in with same credentials → success
- [ ] Wrong password → shows error message (does not crash)

**Auth — Apple Sign-In**
- [ ] Tap "Continue with Apple" → Apple auth sheet appears
- [ ] Complete Apple login → user is logged in
- [ ] Check Supabase dashboard → user appears in Auth → Users

**Auth — Google Sign-In**
- [ ] Tap "Continue with Google" → Google OAuth flow opens
- [ ] Complete Google login → user is logged in

**Session persistence**
- [ ] Log in → close the app completely → reopen → still logged in (not sent back to login)

**Admin access**
- [ ] Log in with admin account → admin tab/section is visible
- [ ] Log in with regular account → admin section is completely invisible
- [ ] Try to navigate to `/admin` route manually with regular account → redirected to home

**Favorites tab (logged out)**
- [ ] Open Favorites tab while not logged in → login prompt appears (not blank screen)

---

## Phase 2 — Core User Features

**Goal:** Full discovery flow — browse, filter, view detail, take action.

### 2.1 Home Screen
- [ ] "Week-end à Libreville" weekly feed (from `weekly_feed` table)
- [ ] Fallback: if no feed this week, show most recent listings automatically
- [ ] Quick category shortcuts: Restaurant / Bar / Activity
- [ ] Feed card: photo, name, label (FR/EN), price range, open/closed

### 2.2 Explore / Search Screen
- [ ] Paginated list of active places (load-more, 20 per page)
- [ ] Filter bar: Category | Price range | Zone | Open now
- [ ] Open/Closed logic:
  - Always computed in **Libreville timezone (UTC+1 / WAT)**
  - Handle overnight hours (e.g., bar open 21:00 → closes 02:00 next day)
  - `overnight: true` flag in hours JSON triggers next-day close logic
- [ ] Listing card: primary photo, name, category, zone, price range, open/closed status

### 2.3 Place Detail Page
- [ ] Hero photo + swipeable gallery
- [ ] Name, category, zone
- [ ] Price range (Économique / Intermédiaire / Haut de gamme)
- [ ] Open/Closed status (Libreville time) + today's hours
- [ ] Full hours accordion (all days, overnight handled)
- [ ] Description in current app language (FR or EN)
- [ ] Address (if available)
- [ ] Sticky CTA bar at bottom: WhatsApp | Call | Save | Share

### 2.4 CTA Actions
- [ ] **WhatsApp:** auto-format number to `+241XXXXXXXX` → open `https://wa.me/241XXXXXXXX`
- [ ] **Call:** `expo-linking` → `tel:+241XXXXXXXX`
- [ ] **Save:** toggle favorite; if logged out → login bottom sheet
- [ ] **Share:** Branch.io smart link with place name + photo
  - If recipient has O'Kili: opens place detail directly
  - If recipient doesn't have O'Kili: opens a basic web page with place info + download prompt

### 2.5 Analytics Events (PostHog)
- [ ] `place_viewed` — on detail page open
- [ ] `cta_whatsapp_tapped` — on WhatsApp button tap
- [ ] `cta_call_tapped` — on Call button tap
- [ ] `cta_save_tapped` — on Save button tap
- [ ] `cta_share_tapped` — on Share button tap
- [ ] `weekly_feed_opened` — on weekly feed card tap
- [ ] `filter_used` — on any filter change (log which filters)

### 2.6 Favorites Screen
- [ ] List of saved places (requires login)
- [ ] If not logged in: show login prompt (not a blank/broken screen)
- [ ] Tap to open place detail
- [ ] Remove from favorites

### 2.7 Automated Unit Tests

These two functions are pure logic — no UI, no network. They must be unit tested because
failures are invisible to the user (the button still taps, but the wrong thing happens).

**Test file: `mobile/__tests__/isOpenNow.test.ts`**

```
isOpenNow(hours, currentLibrevilleTime) — test cases:

NORMAL HOURS
  ✓ returns true  — place open 08:00–22:00, tested at 12:00 Libreville time
  ✓ returns false — place open 08:00–22:00, tested at 23:00 Libreville time
  ✓ returns false — place open 08:00–22:00, tested at 07:59 Libreville time

CLOSED DAY
  ✓ returns false — day marked as closed:true (e.g., closed on Mondays)

OVERNIGHT HOURS (bars)
  ✓ returns true  — bar open 21:00–02:00 (overnight:true), tested at 23:00
  ✓ returns true  — bar open 21:00–02:00 (overnight:true), tested at 01:30 (next day)
  ✓ returns false — bar open 21:00–02:00 (overnight:true), tested at 02:01 (after close)
  ✓ returns false — bar open 21:00–02:00 (overnight:true), tested at 15:00 (afternoon)

TIMEZONE INDEPENDENCE
  ✓ returns true  — place open at 12:00 Libreville time,
                    even when device timezone is UTC-5 (New York)
  ✓ returns true  — place open at 12:00 Libreville time,
                    even when device timezone is UTC+9 (Tokyo)
```

**Test file: `mobile/__tests__/formatWhatsApp.test.ts`**

```
formatWhatsAppNumber(input) — test cases:

  ✓ "0712345678"     → "24112345678"   (local format, leading 0 replaced by 241)
  ✓ "+24112345678"   → "24112345678"   (already has +241, strip the +)
  ✓ "24112345678"    → "24112345678"   (already correct, no change)
  ✓ "07 12 34 56 78" → "24112345678"   (spaces removed)
  ✓ "07-12-34-56-78" → "24112345678"   (dashes removed)
  ✓ ""               → null            (empty input returns null — button hidden)
  ✓ "abc"            → null            (invalid input returns null)
```

- [ ] Write `isOpenNow()` utility function in `mobile/utils/isOpenNow.ts`
- [ ] Write `formatWhatsAppNumber()` utility function in `mobile/utils/formatWhatsApp.ts`
- [ ] Write test files as above
- [ ] Run `npx jest` — all tests pass before moving on

---

### Phase 2 — QA Gate (run before starting Phase 3)

**Automated tests — must pass first**
- [ ] `npx jest` → all `isOpenNow` tests pass (9/9)
- [ ] `npx jest` → all `formatWhatsAppNumber` tests pass (7/7)

**Home Screen**
- [ ] Weekly feed loads and displays listing cards with labels
- [ ] Tapping a category shortcut opens Explore filtered by that category
- [ ] (Test fallback) Temporarily remove this week's feed from Supabase → home screen still shows listings (not blank)

**Explore & Filters**
- [ ] Default list loads with listing cards
- [ ] Filter by category: Restaurant → only restaurants shown
- [ ] Filter by price range: Économique → only cheap places shown
- [ ] Filter by zone: select a zone → only that zone shown
- [ ] Filter by Open now: results reflect places open at current Libreville time
- [ ] Combine two filters: category + zone → both applied correctly
- [ ] Clear all filters → full list returns

**Place Detail Page**
- [ ] Tap a listing card → detail page opens with all fields visible
- [ ] Photos display (no broken images)
- [ ] Price range shows correct label (Économique / Intermédiaire / Haut de gamme)
- [ ] Open/Closed status is correct for current Libreville time
- [ ] Hours accordion expands to show all days

**CTAs**
- [ ] WhatsApp button → opens WhatsApp app with correct number (verify number format)
- [ ] Call button → opens phone dialer with correct number
- [ ] Save button (logged in) → place appears in Favorites tab
- [ ] Save button (logged out) → login sheet appears; user stays on detail page
- [ ] Share button → Branch.io link generated; share sheet opens

**Branch.io deep link**
- [ ] Share a place link → open the link on a device WITHOUT O'Kili → web page loads with place info and download banner
- [ ] Share a place link → open the link on a device WITH O'Kili → opens directly in app on correct detail page

**Analytics**
- [ ] Open PostHog dashboard → confirm `place_viewed`, `cta_whatsapp_tapped`, and `cta_share_tapped` events are appearing in real time

---

## Phase 3 — Admin — In-App Mode (Mobile)

**Goal:** Content team can create and manage listings from their phones in the field.

### 3.1 Admin Access
- [ ] `useIsAdmin()` hook gates the admin section
- [ ] Admin tab / entry point only rendered when `is_admin = true`
- [ ] `admin/_layout.tsx` redirects non-admin to home

### 3.2 Image Compression (implement here — before first photo upload)
- [ ] On photo selection (camera or library): compress with `expo-image-manipulator`
  - Max width: 1200px
  - Quality: 80% JPEG
  - Result: ~5MB phone photo → ~250KB — visually identical on screen
- [ ] Upload compressed image to Supabase Storage `place-photos`

### 3.3 Admin Screens (Mobile)
- [ ] **Listings dashboard:** all places (active + inactive) with status chip
- [ ] **Create place form:**
  - Name, category (dropdown), zone (dropdown)
  - Price range: Économique / Intermédiaire / Haut de gamme
  - Phone + WhatsApp (auto-format helper to +241XXXXXXXX)
  - Hours per day (open time / close time / closed toggle / overnight toggle)
  - Description FR + EN
  - Address
- [ ] **Edit place form:** same fields, pre-filled
- [ ] **Photo management:** pick/shoot → compress → upload → set primary
- [ ] **Publish toggle:** flip `is_active`

---

### Phase 3 — QA Gate (run before starting Phase 4)

**Admin access control**
- [ ] Log in as regular user → admin section is completely invisible
- [ ] Log in as admin → admin section is visible

**Creating a listing**
- [ ] Create a new listing with all required fields filled in
- [ ] Set it to inactive (`is_active = false`)
- [ ] Confirm it does NOT appear on the Explore screen (inactive listing hidden from users)
- [ ] Set it to active (`is_active = true`)
- [ ] Confirm it NOW appears on the Explore screen

**Photo upload and compression**
- [ ] Upload a photo from camera roll for the new listing
- [ ] Check Supabase Storage dashboard → confirm uploaded file size is under 500KB
- [ ] Confirm the photo appears on the place detail page in the app (no broken image)
- [ ] Confirm photo quality looks good on iPhone screen (no visible pixelation)

**Editing a listing**
- [ ] Edit the listing: change the name → confirm change appears immediately on Explore and detail page
- [ ] Edit the hours → confirm Open/Closed status updates correctly on the detail page

**WhatsApp formatting**
- [ ] Enter a local format number in the form (e.g., `07 12 34 56`) → confirm it auto-formats to `+24107123456`
- [ ] Open the listing detail page → tap WhatsApp button → confirm it opens WhatsApp with the correctly formatted number

---

## Phase 4 — Admin — Web Dashboard (`/web`)

**Goal:** Full desktop management interface for bulk work and weekly feed curation.

### 4.1 Auth
- [ ] `/login` page — email/password
- [ ] Middleware: all `/admin/*` routes require authenticated admin session
- [ ] Logout

### 4.2 Dashboard Pages

| Route | Purpose |
|---|---|
| `/admin` | Overview: listing count, this week's feed status |
| `/admin/places` | Table: all listings, search, filter by status/category |
| `/admin/places/new` | Create listing form |
| `/admin/places/[id]` | Edit listing form |
| `/admin/places/[id]/photos` | Photo upload, reorder, set primary, delete |
| `/admin/weekly-feed` | Pick and rank this week's spots, add FR/EN labels |

### 4.3 Place Form
All fields from PRD: name, category, zone, price range, phone, WhatsApp (auto-format),
hours per day (with overnight toggle), description FR/EN, address, `is_active`.

### 4.4 Photo Management
- [ ] Upload (drag and drop + file picker) → compress → Supabase Storage
- [ ] Set primary photo
- [ ] Delete photo
- [ ] Preview all photos for a listing

---

### Phase 4 — QA Gate (run before starting Phase 5)

**Auth**
- [ ] Visit `/admin` without being logged in → redirected to `/login`
- [ ] Log in with a non-admin account → still blocked from `/admin`
- [ ] Log in with admin account → `/admin` dashboard loads

**Listings management**
- [ ] Create a new listing from the web dashboard → appears in mobile app Explore screen
- [ ] Edit a listing from the web dashboard → changes appear in mobile app immediately
- [ ] Unpublish a listing → disappears from mobile app Explore screen
- [ ] Republish it → reappears in mobile app
- [ ] Delete a listing → gone from both web dashboard and mobile app

**Photo management**
- [ ] Upload a photo for a listing → appears in mobile app detail page
- [ ] Set a different photo as primary → mobile app detail page shows new primary photo
- [ ] Delete a photo → gone from mobile app

**Weekly feed**
- [ ] Open `/admin/weekly-feed` → select 3 places, set ranks, add FR labels
- [ ] Open mobile app home screen → the curated feed appears with correct labels
- [ ] Remove the weekly feed entries → mobile app falls back to showing recent listings

---

## Phase 5 — Internationalization (i18n)

**Goal:** App fully usable in French and English.

### 5.1 UI Strings
- [ ] All UI strings in `locales/fr.json` and `locales/en.json`
- [ ] Language toggle in Settings screen
- [ ] Default: French; auto-detect device language on first launch

### 5.2 Content Fields
- [ ] Place descriptions: show `description_fr` or `description_en` based on language
- [ ] Weekly feed labels: `label_fr` or `label_en`
- [ ] Category names: `name_fr` or `name_en`
- [ ] Price range labels: "Économique / Intermédiaire / Haut de gamme" in FR; "Budget / Mid-range / Upscale" in EN

---

### Phase 5 — QA Gate (run before starting Phase 6)

**Language switch**
- [ ] Open Settings → tap language toggle → all UI text switches to English immediately
- [ ] Toggle back to French → all UI text switches back to French

**Content fields in English**
- [ ] Open a place detail page in English mode → description shows in English (if available)
- [ ] Open the weekly feed in English mode → labels show in English
- [ ] Open the Explore filter in English mode → category names in English; price range shows "Budget / Mid-range / Upscale"

**Default language**
- [ ] Uninstall and reinstall the app with device language set to French → app opens in French
- [ ] Uninstall and reinstall with device language set to English → app opens in English

**Nothing broken**
- [ ] Run through the full Phase 2 QA checklist in both languages → everything works in FR and EN

---

## Phase 6 — Polish & Launch Prep

**Goal:** App stable, store-ready, data populated.

### 6.1 Performance
- [ ] Infinite scroll / load-more on Explore screen
- [ ] Cache last Explore results in TanStack Query (stale-while-revalidate)
- [ ] Skeleton loaders on listing cards and detail hero

### 6.2 Empty States & Error Handling
- [ ] No results found (search returns empty)
- [ ] No favorites saved yet
- [ ] No internet connection (offline banner + cached data)
- [ ] Supabase error fallback (generic error screen, not crash)

### 6.3 App Store Preparation
- [ ] Design app icon (1024x1024) and splash screen
- [ ] Configure EAS Build (`eas.json`) for iOS production build
- [ ] Write App Store description FR + EN
- [ ] Submit to TestFlight for internal testing (iOS)
- [ ] Fix any review issues
- [ ] Configure Android build for Google Play
- [ ] Submit to Play Store internal testing track
- [ ] Public release — both stores simultaneously

### 6.4 Content Sprint (Hired Team)
- [ ] Finalize list of Libreville zones/neighborhoods
- [ ] Define and confirm CFA thresholds for Économique / Intermédiaire / Haut de gamme
- [ ] Update price range UI labels with confirmed CFA amounts
- [ ] Enter 50+ listings via web admin dashboard
- [ ] Curate first "Week-end à Libreville" feed (10 spots + labels)

### 6.5 Soft Launch Checklist
- [ ] Confirm Supabase free tier limits are sufficient — or upgrade to Pro ($25/month)
- [ ] Vercel deployment live for web admin
- [ ] All production environment variables set (Vercel + EAS)
- [ ] PostHog events verified firing in production
- [ ] Branch.io smart links tested (with and without app installed)
- [ ] End-to-end test on real iPhone (primary test device)
- [ ] End-to-end test on Android device before Play Store submission

---

### Phase 6 — Final QA Gate (run before public launch)

**Performance**
- [ ] Scroll to bottom of Explore → more listings load (load-more working)
- [ ] Slow network test: disable WiFi, use 3G → skeleton loaders appear while data loads
- [ ] Results load in under 3 seconds on a normal connection

**Empty states**
- [ ] Set filters to an impossible combination → "no results" empty state appears (not a blank/broken screen)
- [ ] Log in with a fresh account with no saved places → Favorites shows a friendly empty state
- [ ] Turn off all network → app shows offline banner + last cached Explore results

**Full regression — run the complete QA checklist from every previous phase**
- [ ] Phase 0 QA: Supabase + local setup still correct
- [ ] Phase 1 QA: all 3 auth methods still work; admin access still correct
- [ ] Phase 2 QA: all filters, CTAs, deep links, analytics still working
- [ ] Phase 3 QA: admin mobile create/edit/photo still working
- [ ] Phase 4 QA: web dashboard create/edit/weekly feed still working
- [ ] Phase 5 QA: FR/EN language switch still working

**TestFlight (iOS)**
- [ ] Install the TestFlight build on iPhone (not dev build — production build)
- [ ] Run through all CTAs: WhatsApp, Call, Save, Share on the production build
- [ ] Apple Sign-In works on the production build (different behavior than dev)

**Content**
- [ ] 50+ listings visible and correctly displayed in the app
- [ ] First "Week-end à Libreville" feed is live on the home screen
- [ ] All listing photos load correctly (no broken images)
- [ ] Price range labels show confirmed CFA amounts

---

## Deferred — Post-MVP Backlog

- User reviews and ratings system
- Business self-service listing portal
- Monetization tier enforcement (Standard / Premium gating)
- Sponsored placements in search/feed
- Transport deep-links (Uber / local taxis)
- Reservation / booking system
- Push notifications (weekly "Week-end à Libreville" alert)
- Events calendar
- Business analytics dashboard (expose PostHog data to businesses)
- Per-listing Verified badge (when businesses can submit/claim listings)
- Coverage expansion to other Gabonese cities

---

## Tech Decisions Log

| Decision | Choice | Reason |
|---|---|---|
| Mobile framework | Expo managed workflow | Fastest path to iOS + Android; no native code for MVP |
| Navigation | Expo Router | File-based routing; clean admin section isolation |
| Data fetching | TanStack Query (React Query) | Handles loading, caching, pagination, errors automatically |
| Backend | Supabase | Auth + DB + Storage + RLS in one service |
| Admin UI | Next.js + Tailwind | Fast to build; Vercel free tier; same Supabase project |
| Repo | Monorepo | Shared Supabase types; easier to keep in sync |
| GPS / Maps | None (MVP) | Zone filter sufficient; no Google Maps cost |
| Auth methods | Email + Google + Apple | Minimal friction; Apple mandatory on iOS with any OAuth |
| Admin roles | `profiles` table | Transparent, queryable, no JWT tricks needed |
| Deep links / Share | Branch.io | Smart links work with or without app installed |
| Analytics | PostHog | Free tier; collects B2B sales proof data from day 1 |
| Image handling | expo-image-manipulator | Compress before upload; 5MB → 250KB, no visible quality loss |
| Timezone | Libreville UTC+1 hardcoded | "Open now" always correct regardless of user's location |
| Currency | CFA only | App is for Libreville; no dollar symbols anywhere |
| Price tiers | Économique / Intermédiaire / Haut de gamme | Local, French-first, CFA amounts confirmed before launch |
| Verified badge | Removed from MVP | Everything in app is curated; global quality promise instead |
| Monetization enforcement | Post-MVP | Manual business onboarding first; no self-service at launch |
| Unit testing | Jest + jest-expo | Test critical pure logic: open/closed calc + WhatsApp formatter |

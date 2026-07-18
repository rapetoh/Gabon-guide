# O'Kili — Technical Build Plan

**Version:** 0.4
**Last Updated:** 2026-05-06
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

## Phase 0 — Project Setup ✅ COMPLETED — March 2026

**Goal:** Working skeleton; all tools configured; team can run the project locally.

### 0.1 Repository & Tooling
- [x] Rename/restructure repo root to reflect O'Kili branding
- [x] Initialize `/mobile`, `/web`, `/supabase`, `/docs` folders
- [x] Add root `.gitignore` (Node, Expo, Next.js, `.env` files)
- [x] Add root `README.md` with setup instructions per workspace

### 0.2 Supabase Project
- [x] Create Supabase account and new project
- [x] Store `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env` files (never commit)
- [x] Enable Email/Password auth
- [x] Configure Google OAuth provider — Google Cloud Console credentials configured; `okili://` redirect registered
- [x] Configure Apple OAuth provider — Supabase Apple provider enabled; Client ID = `com.okili.app`
- [x] Add redirect URLs for Expo deep link scheme — `okili://` added to Supabase redirect URLs

### 0.3 Mobile App Bootstrap (`/mobile`)
- [x] Init Expo project with TypeScript template
- [x] Install and configure Expo Router (file-based routing)
- [x] Install `@supabase/supabase-js` — Supabase client configured
- [x] Install `@tanstack/react-query`
- [x] Install `expo-image`, `expo-linking`, `expo-image-manipulator`
- [x] Install `expo-auth-session` (Google) and `expo-apple-authentication` (Apple)
- [ ] Install Branch.io React Native SDK — *deferred: needs Branch.io account/key*
- [ ] Install PostHog React Native SDK — *deferred: needs PostHog account/key*
- [x] Install `i18next` + `react-i18next` — `locales/fr.json` and `locales/en.json` scaffolded
- [x] Install `jest` + `jest-expo` for automated testing
- [x] Configure `app.json`: name = O'Kili, bundle ID = `com.okili.app`

### 0.4 Web Admin Bootstrap (`/web`)
- [x] Init Next.js app with TypeScript + Tailwind
- [x] Install `@supabase/supabase-js` — Supabase client configured
- [ ] Add auth guard middleware (redirect to `/login` if no session) — *done in Phase 4*

### 0.5 Database Schema
- [x] Write migration files in `/supabase/migrations/` (001, 002, 003)
- [x] Create all 7 tables: `categories`, `zones`, `places`, `photos`, `profiles`, `favorites`, `weekly_feed`
- [x] Apply migrations in Supabase
- [x] Migration 004: `latitude`, `longitude`, `website`, `subcategory_id` on `places` + new `subcategories` + `reviews` tables
- [x] Apply migration 004 in Supabase — *confirmed applied by user*
- [x] Seed: categories (Restaurant, Bar, Nightlife, Cafés, Activities) + zones (Centre-ville, Akanda, Owendo, Libreville Nord, Libreville Sud) — *seeded March 2026*
- [x] Create Storage bucket: `place-photos` (public)
- [x] TypeScript types in `mobile/lib/database.types.ts`

### 0.6 Row Level Security (RLS)
- [x] All RLS policies applied via migration 002 + 003

### 0.7 Admin Role Setup
- [x] `profiles` trigger — auto-creates row with `is_admin = false` on signup
- [x] Set `is_admin = true` for your account — *done March 2026*

---

### Phase 0 — QA Gate ✅ PASSED — March 2026

**Supabase**
- [x] All 7 tables exist in Supabase Table Editor — *confirmed by user*
- [x] Storage bucket `place-photos` exists — *confirmed by user*
- [x] Seed data (categories + zones) — *seeded March 2026*
- [ ] RLS anonymous INSERT block test — *deferred*
- [x] Profiles trigger test — *verified: trigger fires correctly on signup*

**Mobile App**
- [x] TypeScript compiles: `npx tsc --noEmit` → 0 errors
- [x] App launches on iPhone without crashing — *confirmed March 2026*

**Web Admin**
- [x] TypeScript compiles: `npx tsc --noEmit` → 0 errors
- [ ] `npm run dev` launches without errors — *verified at start of Phase 4*

---

## Phase 1 — Mobile App Foundation ✅ COMPLETED — March 2026

**Goal:** Navigation in place; real Supabase data flowing; auth fully working.

### 1.1 Navigation Structure (Expo Router) ✅

```
mobile/app/
├── (tabs)/
│   ├── index.tsx           # Home — weekly feed
│   ├── explore.tsx         # Browse/search/filter
│   ├── favorites.tsx       # Saved places (login required)
│   └── profile.tsx         # Profile — account, language, logout
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

- [x] Build bottom tab navigator (Home / Explore / Favorites / Profile)
- [x] Add place detail dynamic route
- [x] Add auth screens
- [x] Add admin section with layout-level auth guard (admin role check)

### 1.2 Data Layer (TanStack Query + Supabase) ✅
- [x] `usePlaces(filters)` — paginated active places with filter support
- [x] `usePlace(id)` — single place with photos + reviews
- [x] `useCategories()` — all categories
- [x] `useSubcategories(categoryId)` — subcategories for a given category
- [x] `useZones()` — all zones
- [x] `useSession()` — current auth session
- [x] `useIsAdmin()` — query `profiles` table for `is_admin`
- [x] `useFavorites()` — user's saved places (add / remove / check)
- [x] `useWeeklyFeed()` — current week's feed; fallback to recent listings if empty
- [x] `useReviews(placeId)` — reviews for a place with average rating
- [x] `useUserReview(placeId)` — current user's review for a place (for edit/delete)

**Note:** `database.types.ts` hand-written types required `Relationships: []` on every table and `Views`/`Functions` keys on the schema to satisfy `@supabase/supabase-js` v2.99 `GenericSchema` constraint. Nested join type inference disabled — explicit `ReviewWithProfile` interface used in `useReviews` instead.

### 1.3 Auth Flow ✅
- [x] Login/Register screen: three clear options — Email+Password | Google | Apple
- [x] Email + password: register form + login form
- [x] Google Sign-In: `expo-auth-session` + Supabase `signInWithOAuth` + PKCE — *fix: hardcode `okili://` redirect + extract clean code from `%23`-suffixed callback URL*
- [x] Apple Sign-In: `expo-apple-authentication` + Supabase `signInWithIdToken` — *Client ID = `com.okili.app` (bundle ID, not Team ID)*
- [x] Persistent session (AsyncStorage — Supabase client handles automatically)
- [x] Logout (implemented in Profile tab)
- [x] Admin detection: query `profiles` table → `is_admin = true`
- [ ] Non-blocking auth: unauthenticated user taps Save → login bottom sheet, not redirect — *Phase 2, when Save CTA is built*

**TypeScript check:** `npx tsc --noEmit` → 0 errors ✅

### 1.4 Analytics Setup
- [ ] Initialize PostHog in app root
- [ ] Create `useAnalytics()` helper hook for clean event tracking
- [ ] Track screen views automatically via Expo Router

---

### Phase 1 — QA Gate ✅ PASSED — March 2026

**Navigation**
- [x] Tap all 4 tabs (Home / Explore / Favorites / Profile) — each loads without crashing
- [x] Navigate to a place detail page — loads correctly
- [x] Navigate to auth screen — loads correctly
- [x] Back navigation works on all screens

**Auth — Email/Password**
- [x] Register a new account with email + password → success
- [x] Log out → session cleared
- [x] Log back in with same credentials → success
- [x] Wrong password → shows error message (does not crash)

**Auth — Apple Sign-In**
- [x] Tap "Continue with Apple" → Apple auth sheet appears
- [x] Complete Apple login → user is logged in
- [x] Check Supabase dashboard → user appears in Auth → Users

**Auth — Google Sign-In**
- [x] Tap "Continue with Google" → Google OAuth flow opens
- [x] Complete Google login → user is logged in

**Session persistence**
- [x] Log in → close the app completely → reopen → still logged in

**Admin access**
- [ ] Log in with admin account → admin tab/section is visible — *pending: requires is_admin=true + admin UI*
- [ ] Log in with regular account → admin section is completely invisible
- [ ] Try to navigate to `/admin` route manually with regular account → redirected to home

**Favorites tab (logged out)**
- [x] Open Favorites tab while not logged in → login prompt appears (not blank screen)

---

## Phase 2 — Core User Features 🔄 IN PROGRESS — March 2026

**Goal:** Full discovery flow — browse, filter, view detail, take action.

### 2.1 Home Screen
- [ ] "Week-end à Libreville" weekly feed (from `weekly_feed` table)
- [ ] Fallback: if no feed this week, show most recent listings automatically
- [ ] Quick category shortcuts: Restaurant / Bar / Activity
- [ ] Feed card: photo, name, label (FR/EN), price range, open/closed

### 2.2 Explore / Search Screen
- [ ] Paginated list of active places (load-more, 20 per page)
- [ ] Filter bar: Category | Subcategory | Price range | Zone | Open now | Near me
- [ ] "Near me" filter: request location permission → sort by distance from user
- [ ] Open/Closed logic:
  - Always computed in **Libreville timezone (UTC+1 / WAT)**
  - Handle overnight hours (e.g., bar open 21:00 → closes 02:00 next day)
  - `overnight: true` flag in hours JSON triggers next-day close logic
- [ ] Listing card: primary photo, name, category, zone, price range, open/closed status
- [ ] Neighborhoods section: zone cards with place count + photo
- [ ] "Curated for you" section: admin-curated thematic collections

### 2.3 Place Detail Page
- [ ] Hero photo + swipeable gallery
- [ ] Name, category, subcategory, zone
- [ ] Price range (Économique / Intermédiaire / Haut de gamme)
- [ ] Average rating + review count (e.g., ⭐ 4.8 · 124 reviews)
- [ ] Open/Closed status (Libreville time) + today's hours
- [ ] Full hours accordion (all days, overnight handled)
- [ ] Description in current app language (FR or EN)
- [ ] Address (if available)
- [ ] Website link (if available)
- [ ] Sticky CTA bar at bottom: WhatsApp | Call | Save | Share
- [ ] Reviews section: list of user reviews + "Leave a review" button (login required)
- [ ] Leave/edit review: rating (1–5 stars) + optional comment

### 2.4 Map Screen
- [ ] Google Maps view with pins for all active places
- [ ] Filter chips at top: All Places | Restaurants | Bars | Activities...
- [ ] Tap a pin → bottom sheet preview card (name, category, zone, rating)
- [ ] Tap preview card → navigate to place detail page
- [ ] "Near me" → center map on user's location (request permission)
- [ ] Install: `react-native-maps` + Google Maps API keys in `app.json`

**Google Maps API keys (2 keys — one per platform):**
- `okili-maps-ios`: restricted to iOS apps, bundle ID `com.okili.app`, Maps SDK for iOS only ← do in Phase 0
- `okili-maps-android`: API-restricted to Maps SDK for Android only (no app restriction yet — SHA-1 fingerprint needed, add in Phase 6 when Android build is set up)
- Keys stored in `.env` — never committed to git

### 2.5 Profile Tab
- [ ] Show user info when logged in (avatar, email/name)
- [ ] Language toggle (FR / EN)
- [ ] Logout button
- [ ] Login prompt when not logged in

### 2.6 CTA Actions
- [ ] **WhatsApp:** auto-format number to `+241XXXXXXXX` → open `https://wa.me/241XXXXXXXX`
- [ ] **Call:** `expo-linking` → `tel:+241XXXXXXXX`
- [ ] **Save:** toggle favorite; if logged out → login bottom sheet
- [ ] **Share:** Branch.io smart link with place name + photo
  - If recipient has O'Kili: opens place detail directly
  - If recipient doesn't have O'Kili: opens a basic web page with place info + download prompt

### 2.7 Analytics Events (PostHog)
- [ ] `place_viewed` — on detail page open
- [ ] `cta_whatsapp_tapped` — on WhatsApp button tap
- [ ] `cta_call_tapped` — on Call button tap
- [ ] `cta_save_tapped` — on Save button tap
- [ ] `cta_share_tapped` — on Share button tap
- [ ] `weekly_feed_opened` — on weekly feed card tap
- [ ] `filter_used` — on any filter change (log which filters)

### 2.8 Favorites Screen
- [ ] List of saved places (requires login)
- [ ] If not logged in: show login prompt (not a blank/broken screen)
- [ ] Tap to open place detail
- [ ] Remove from favorites

### 2.9 Automated Unit Tests

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

## Phase 4 — Admin — Web Dashboard (`/web`) ✅ COMPLETED — March 2026

**Goal:** Full desktop management interface for bulk work and listing management.

### 4.1 Auth ✅
- [x] `/login` page — Google Sign-In (primary) + email/password fallback
- [x] `proxy.ts` (Next.js 16): all `/admin/*` routes require authenticated admin session + `is_admin = true`
- [x] `/auth/callback` route — handles Google OAuth code exchange
- [x] Logout

**Note:** Admin account uses Google OAuth (no password). Web login has Google Sign-In button as primary method. Required adding `http://localhost:3000/auth/callback` to Supabase redirect URLs.

**Note:** Next.js 16 breaking changes encountered and fixed:
- `middleware.ts` → renamed to `proxy.ts`, export named `proxy` (not `middleware`)
- `searchParams` in server components is a Promise → must be `await`ed
- `params` in dynamic route server components is also a Promise → must `await params` before accessing `.id` or any segment
- `useSearchParams` in client components requires `<Suspense>` boundary

### 4.2 Dashboard Pages ✅

| Route | Purpose |
|---|---|
| `/admin` | Overview: stat cards (total/active/inactive/promoted) + 5 recent places |
| `/admin/places` | Table: all listings, search, filter by All/Active/Inactive/Promoted |
| `/admin/places/new` | Create listing form |
| `/admin/places/[id]` | Edit listing form |
| `/admin/places/[id]/photos` | Photo upload, set primary, delete |

**Note:** `/admin/weekly-feed` not built — "Trending Now" replaced the weekly feed (see Architecture Decision #1). Promotion is managed directly in the place edit form.

### 4.3 Place Form ✅
All fields + full validation parity with mobile PlaceForm:
- [x] Name (required, min 2, max 100), Category (required), Zone (required), Subcategory
- [x] Price range with CFA hints (< 5 000 / 5 000–20 000 / > 20 000 FCFA)
- [x] Phone + WhatsApp (digit count validation)
- [x] Website (auto-normalizes bare domains to https://, validates format)
- [x] Address (max 300 chars)
- [x] Location link paste (Google Maps / Apple Maps / WhatsApp → extracts lat/lon)
- [x] GPS coordinates (lat/lon manual input)
- [x] Hours per day (open/close/closed/overnight) with time format validation
- [x] Description FR + EN
- [x] Promotion toggle + badge labels (FR/EN)
- [x] Active/Inactive toggle
- [x] Gabon bounds check TODO (commented out same as mobile — re-enable pre-launch)

### 4.4 Photo Management ✅
- [x] Upload (file picker, multiple files) → Supabase Storage
- [x] Set primary photo (hover → "Set as primary")
- [x] Delete photo (soft-delete in DB + remove from storage)
- [x] Preview grid (3-column)

---

### Phase 4 — QA Gate ✅ PASSED — March 2026

**Auth**
- [x] Visit `/admin` without being logged in → redirected to `/login`
- [ ] Log in with a non-admin account → still blocked from `/admin` *(not tested — only one account)*
- [x] Log in with admin account → `/admin` dashboard loads

**Listings management**
- [x] Create a new listing from the web dashboard → appears in mobile app Explore screen
- [x] Edit a listing from the web dashboard → changes appear in mobile app immediately
- [x] Unpublish a listing → disappears from mobile app Explore screen
- [x] Republish it → reappears in mobile app
- [ ] Delete a listing → gone from both web dashboard and mobile app *(not tested)*

**Photo management**
- [x] Upload a photo for a listing → appears in mobile app detail page
- [x] Set a different photo as primary → mobile app detail page shows new primary photo
- [x] Delete a photo → gone from mobile app

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

## Phase 7 — ViralBite-Inspired Features — 🔄 IN PROGRESS — March 2026

**Context:** After reviewing ViralBite (a US-based restaurant discovery app), several high-value UX improvements were identified. All changes are additive — no existing features are modified or broken.

**Implementation order:** Share → Maps Choice → Menu Photos → Onboarding → Restaurant Owner Role → Video Feed (last)

---

### 7.1 Share Functionality

**Goal:** Wire up the existing Share button (UI already present on place detail, handler missing).

- [ ] Wire up Share Pressable in `mobile/app/place/[id].tsx` using React Native `Share` API
- [ ] Share content: place name + short description + deep link (`okili://place/<id>`)
- [ ] Call `ctaShareTapped()` analytics event on tap (event already defined, never called)

**QA tests:**
- [ ] Tap Share on place detail → native share sheet appears
- [ ] Share sheet contains correct place name
- [ ] Analytics event fires (`cta_share_tapped`)

---

### 7.2 Apple Maps / Google Maps Choice for Directions

**Goal:** When user taps the Map button or address, show a choice instead of going straight to in-app navigation.

- [ ] Add a bottom action sheet in `mobile/app/place/[id].tsx` with 3 options:
  - In-App Navigation (existing map modal)
  - Open in Apple Maps
  - Open in Google Maps (hidden if not installed — use `Linking.canOpenURL`)
- [ ] Use `Linking.openURL` with `maps://` scheme for Apple Maps
- [ ] Use `Linking.openURL` with `comgooglemaps://` scheme for Google Maps

**QA tests:**
- [ ] Tap "Map" or address → choice bottom sheet appears
- [ ] "In-App" → existing navigation modal opens
- [ ] "Apple Maps" → opens Apple Maps with place coordinates
- [ ] "Google Maps" → opens Google Maps; option hidden if not installed

---

### 7.3 Menu Photos

**Goal:** Restaurants can have dedicated menu photo(s) separate from the general gallery.

**DB change (migration 005):**
- [ ] Add `is_menu boolean default false` to `photos` table

**Mobile:**
- [ ] Add "Menu" section to `mobile/app/place/[id].tsx` (below photos gallery, only shown if menu photos exist)
- [ ] Menu photos excluded from the regular gallery query (filter `is_menu = false` for gallery, `is_menu = true` for menu section)

**Admin (web):**
- [ ] Add "Menu Photos" upload section in `web/app/admin/places/[id]/photos/page.tsx` with a toggle to mark photos as menu photos

**Admin (mobile):**
- [ ] Add "Menu Photos" section in `mobile/app/admin/place/[id]/edit.tsx`

**QA tests:**
- [ ] Admin can upload a photo tagged as menu
- [ ] Menu section appears on place detail only if menu photos exist
- [ ] Menu photos do NOT appear in the regular photo gallery
- [ ] Menu photos can be deleted from admin

---

### 7.4 Onboarding Flow

**Goal:** First-launch onboarding to capture user preferences (skippable — no forced sign-in).

**DB change (migration 006):**
- [ ] Add `preferred_zones text[] default '{}'` to `profiles` table
- [ ] Add `preferred_vibes text[] default '{}'` to `profiles` table

**Files to create:**
- [ ] `mobile/app/onboarding/_layout.tsx`
- [ ] `mobile/app/onboarding/index.tsx` — Welcome screen
- [ ] `mobile/app/onboarding/areas.tsx` — "Which areas do you visit?"
- [ ] `mobile/app/onboarding/preferences.tsx` — Cuisine / vibe profile
- [ ] `mobile/app/onboarding/location.tsx` — Location permission request

**Files to modify:**
- [ ] `mobile/app/_layout.tsx` — on first launch, check AsyncStorage flag `onboarding_completed`; if not set, redirect to `/onboarding`
- [ ] Each onboarding screen has an X / Skip button that sets `onboarding_completed = true` in AsyncStorage and navigates to `/(tabs)/`
- [ ] If user is logged in at completion: save `preferred_zones` + `preferred_vibes` to `profiles` table
- [ ] If user is NOT logged in at completion: save to AsyncStorage; merge to profile on next login

**QA tests:**
- [ ] First install → onboarding shows before home tab
- [ ] Tap X on any step → lands on home tab normally; onboarding never shows again
- [ ] Complete all steps → preferences saved; home tab loads
- [ ] Second launch → onboarding does NOT show again
- [ ] Complete onboarding while not logged in → preferences saved to AsyncStorage
- [ ] Log in after skipping → account created, local preferences not lost

---

### 7.5 Restaurant Owner Role ✅ IMPLEMENTED (2026-03-29)

**Goal:** Restaurant owners get a restricted admin account to manage only their own listing. Admins can assign/change roles from within the app.

**DB change (migration 009) ✅ RUN:**
- [x] `role text not null default 'user'` added to `profiles` (values: `'user'`, `'restaurant_owner'`, `'admin'`)
- [x] `owner_id uuid references profiles(id)` added to `places` (nullable)
- [x] RLS: `restaurant_owner` can UPDATE their own place
- [x] RLS: `restaurant_owner` can INSERT/DELETE photos for their own place

**Restaurant owner mobile screens ✅:**
- [x] `mobile/app/restaurant-admin/_layout.tsx` — auth guard: redirects non-owners to home tab
- [x] `mobile/app/restaurant-admin/index.tsx` — place dashboard (photo, name, category, zone, active badge)
- [x] `mobile/app/restaurant-admin/edit.tsx` — edit name, description FR/EN, upload gallery + menu photos
- [x] `mobile/app/(tabs)/profile.tsx` — "Gérer mon restaurant" link shown only when `role = 'restaurant_owner'`
- [x] `mobile/hooks/useIsAdmin.ts` — exposes `role` field alongside `isAdmin`

**Admin user management screens ✅:**
- [x] `supabase/migrations/011_admin_users_function.sql` — adds `email` column to `profiles`, backfills from `auth.users` (safe in migration context), updates `handle_new_user` trigger to copy email on signup, adds email-change sync trigger, creates `get_all_users_for_admin()` RPC that queries `profiles` only (no cross-schema join — avoids Supabase client-side auth.users restriction)
- [x] `mobile/app/admin/users/index.tsx` — searchable list: name + email + join date + role badge; search by name OR email; sorted newest first; total count in header
- [x] `mobile/app/admin/users/[id].tsx` — role editor: pick User / Restaurant Owner / Admin; if Owner, assign a place from a dropdown; warns if place already linked to another owner
- [x] `mobile/app/admin/index.tsx` — people icon in header → navigates to Users list
- [x] `mobile/app/(tabs)/profile.tsx` — "Manage Users" row added to Admin section for 1-tap access
- Note: when setting `admin` role, both `role = 'admin'` and `is_admin = true` are updated to keep RLS working

**User identity improvements ✅:**
- [x] `supabase/migrations/011_admin_users_function.sql` — `handle_new_user` trigger updated to copy `full_name` from `raw_user_meta_data` (covers Google/Apple OAuth names); backfill updates existing users; email-change sync trigger added
- [x] `mobile/app/auth/login.tsx` — "Full name" field shown in register mode only; passed as `data: { full_name }` to `supabase.auth.signUp()` → trigger saves to `profiles.full_name`
- [x] `mobile/locales/en.json` + `fr.json` — added `auth.fullName` translation key

**QA tests:**
- [ ] User with `role = 'user'` → no "Manage My Restaurant" link visible
- [ ] User with `role = 'restaurant_owner'` → "Manage My Restaurant" link visible + dashboard loads their place
- [ ] Restaurant owner can edit their place name/description; changes save and appear in feed
- [ ] Restaurant owner CANNOT edit another restaurant (RLS blocks at DB level)
- [ ] Restaurant owner CANNOT access the full admin dashboard (layout guard redirects)
- [ ] Admin can still edit all places
- [ ] Admin opens Users list → all registered users appear with correct role badges
- [ ] Admin changes a user to restaurant_owner + selects a place → that place now shows as their linked restaurant
- [ ] Admin demotes restaurant_owner to user → "Manage My Restaurant" link disappears for that user; place owner_id cleared
- [ ] Admin sets a user to admin → that user gains full admin access (is_admin = true)

---

### 7.6 Video Feed ✅ IMPLEMENTED (2026-03-28)

**Goal:** TikTok-style vertical video feed as primary home screen.

**DB change (migration 010):**
- [x] New `videos` table: `id`, `place_id`, `storage_path`, `thumbnail_url`, `caption`, `position`, `created_at`
- [x] RLS: public read; admins + restaurant owners can manage their own videos
- [ ] **Manual step:** Create `place-videos` Storage bucket in Supabase dashboard (Public: ON)

**Mobile — implemented:**
- [x] `expo-video` installed + added to `app.config.js` plugins
- [x] `mobile/hooks/useVideoFeed.ts` — infinite query with filter support (`categoryId`, `zoneId`, `priceRange`, `openNow`)
- [x] `mobile/components/VideoFeedCard.tsx` — full-screen card:
  - Video → plays with `expo-video`, auto-play/pause driven by `isActive` prop
  - No video → auto-slides gallery photos with crossfade every 3.5 s
  - Right-side panel: Save (heart/favorites), Share (native sheet), Comments (→ `ReviewsBottomSheet`), Menu (→ `MenuBottomSheet`, only if menu photos exist)
  - Bottom overlay: place name, category · zone, description excerpt, "View place" button
  - Mute/unmute button (top-right, video cards only)
  - Photo progress dots (slideshow cards, multiple photos)
  - Promoted badge (top-left)
  - All top badges/buttons clear the floating filter header via `headerHeight` prop
- [x] `mobile/app/(tabs)/index.tsx` — full-screen vertical FlatList with floating filter header:
  - `pagingEnabled` + `snapToInterval` for one-card-per-swipe
  - `viewabilityConfig` (50% threshold) drives `activeIndex` → controls play/pause
  - `getItemLayout` for perf, infinite scroll via `fetchNextPage`
  - Floating filter header: category tabs + Open now / price / zone chips + search icon
  - Search icon → navigates to Explore tab with `focus=1` to auto-focus search bar
  - Empty state with "Reset filters" button

- [x] `mobile/components/MenuBottomSheet.tsx` — bottom sheet for menu photos:
  - 2-column photo grid, fetched lazily when sheet opens (not on feed load)
  - Tap any photo → full-screen viewer with prev/next arrows and "X / N" counter
  - Empty state if no photos available
- [x] `mobile/components/ReviewsBottomSheet.tsx` — TikTok-style bottom sheet for reviews:
  - Slides up over the video feed via `Modal` + `Animated.spring/timing` (no third-party libs)
  - Shows average rating + count, full review list (avatar initial, name, stars, date, comment)
  - Inline review form for logged-in users: star picker + optional comment + submit/cancel
  - Edit / Delete own review without leaving the feed
  - Login prompt for anonymous users
  - `KeyboardAvoidingView` handles soft keyboard on iOS/Android

**Explore tab redesigned:**
- [x] `mobile/app/(tabs)/explore.tsx` — dual-mode screen:
  - **Discovery mode** (no search/filters): Trending Now, Categories grid, Explore by Area, New in Town
  - **Search/filter mode** (any input active): filtered place list
  - Auto-focuses search bar when navigated with `?focus=1`

**Mobile admin — implemented:**
- [x] `mobile/components/admin/PlaceForm.tsx` — added "Menu Photos" card below gallery photos section; separate pick/take functions upload with `is_menu: true`; menu photos pre-filled when editing; blue receipt badge distinguishes menu thumbs from gallery thumbs

**Web admin — implemented:**
- [x] `web/components/VideoManager.tsx` — upload / delete / caption-edit for place videos
- [x] `web/app/admin/places/[id]/videos/page.tsx` — videos management page
- [x] "Videos →" link added to place edit page header
- [x] `web/components/PhotoManager.tsx` — already supported menu photos via "Upload as menu photo" toggle + separate gallery/menu sections

**QA tests:**
- [ ] Swipe up → next place loads; swipe down → previous place
- [ ] Place with video → video autoplays when card enters view; pauses when scrolled away
- [ ] Place without video → photos slide automatically (crossfade) when card is active
- [ ] Mute button toggles audio on video cards; state persists across swipes
- [ ] Save (heart) → adds/removes from favorites; requires login if not authed
- [ ] Share → native share sheet opens with place name + deep link
- [ ] Comments button → `ReviewsBottomSheet` slides up over the feed (does NOT navigate away)
- [ ] Menu button (only visible when place has menu photos) → `MenuBottomSheet` slides up with 2-column photo grid; tap any photo → full-screen viewer with prev/next arrows
- [ ] "View place" CTA → navigates to `/place/[id]`
- [ ] Filter header: category tab filters feed in real time
- [ ] Filter header: Open now chip, price chip, zone dropdown all filter feed
- [ ] Search icon → Explore tab opens with keyboard focused
- [ ] Infinite scroll → next page loads when near end of feed
- [ ] Web admin: upload video → appears in list; delete → removed from list + storage
- [ ] Web admin: add/edit caption → saved to DB
- [ ] Explore tab (no filters) → shows Trending, Categories, Areas, New in Town
- [ ] Explore tab (search/filter active) → shows filtered list
- [ ] Reviews bottom sheet: tap Comments → sheet slides up over the feed without navigating away
- [ ] Reviews bottom sheet: logged-in user can submit, edit, and delete a review inline

---

### 7.7 Auth Improvements ✅ IMPLEMENTED (2026-03-31)

**Goal:** Harden the login/register screen and add forgot password.

- [x] **Forgot password** — "Forgot password?" link calls `supabase.auth.resetPasswordForEmail()` with `redirectTo: 'okili://reset-password'`; shows success alert in FR/EN
- [x] **Email format validation** — client-side regex check before attempting signUp/signIn; shows friendly error if malformed
- [x] **Email verification detection** — after `signUp()`, if `data.session === null` the account needs email verification; shows "Check your email" alert instead of navigating to home
- [x] **Post-login redirect** — login screen reads `redirect` param from URL; after any successful auth it calls `router.replace(redirect)` instead of always going to `/(tabs)`; used so tapping Save or leaving a review while logged out lands back on the same place after login
- [x] i18n keys added for all new auth states: `fillAllFields`, `invalidEmail`, `checkEmail`, `resetSent`, `enterEmailFirst`

**QA tests:**
- [ ] Enter bad email format → "Invalid email" error shown before any network call
- [ ] Register with valid email → "Check your email" alert appears (no navigation yet)
- [ ] Tap "Forgot password?" with email pre-filled → success alert; reset email arrives
- [ ] Tap "Forgot password?" with empty email → "Enter your email first" error
- [ ] Tap Save (logged out) → redirected to login → log in → lands back on the place detail

---

### 7.8 Video Feed UX Refinements ✅ IMPLEMENTED (2026-03-31)

**Goal:** Correct the most obvious UX gaps in the feed cards.

- [x] **Tap to pause/resume** — `VideoFeedCard` now has a full-screen `Pressable` overlay (above scrim, below all UI buttons) that toggles play/pause; a large play/pause icon flashes briefly in the centre for feedback; scrolling away resets the pause state so the next scroll-in auto-plays
- [x] **Pause on navigate away** — `index.tsx` uses `useFocusEffect` to set `isScreenFocused`; all feed cards receive `isActive={index === activeIndex && isScreenFocused}`, so video stops the moment the user opens a place detail or switches tabs
- [x] **Scrim gradient** — replaced solid dark `View` (which created a hard horizontal line ~40% from top) with `expo-linear-gradient` starting at 30% opacity 0 → opacity 0.78 at bottom; no visible edge
- [x] **Feed scroll-to-top on filter change** — all filter chips/tabs call `applyFilter()` which resets `activeIndex` to 0 and calls `feedRef.current?.scrollToOffset({ offset: 0, animated: false })`

**QA tests:**
- [ ] Tap centre of a playing video → video pauses; icon flashes
- [ ] Tap again → video resumes
- [ ] Tap "View place" from feed → navigate to detail → video in feed has stopped
- [ ] Return to feed → active card resumes playing
- [ ] Switch to Map tab → video stops; switch back → resumes
- [ ] Tap a filter chip → feed scrolls to top immediately

---

### 7.9 RLS & Video Upload Bug Fixes ✅ IMPLEMENTED (2026-03-31)

**Goal:** Fix "new row violates row-level security policy" errors and 0-byte video uploads.

- [x] **Migration 012** (`supabase/migrations/012_fix_videos_rls.sql`) — The original admin/owner policies on `public.videos` used `FOR ALL … USING(…)` with no `WITH CHECK` clause; PostgreSQL requires `WITH CHECK` to authorise `INSERT`. Both policies dropped and recreated with both clauses.
- [x] **Migration 013** (`supabase/migrations/013_place_videos_storage_policies.sql`) — The `place-videos` Storage bucket was created with no policies; every `INSERT` into `storage.objects` was blocked by RLS. Added public read + admin upload/update/delete + restaurant-owner upload/delete (path-scoped to their place); also added missing restaurant-owner photo policies for `place-photos`.
- [x] **iOS video upload fix** — `fetch(localUri).blob()` and `XMLHttpRequest` both produce 0-byte blobs for iOS photo library URIs. Fixed in both `PlaceForm.tsx` and `restaurant-admin/edit.tsx` by replacing the Supabase JS client upload with `FileSystem.uploadAsync` (from `expo-file-system/legacy`) with `uploadType: BINARY_CONTENT` and a manual `Authorization: Bearer {token}` header. This performs a native-layer HTTP POST that correctly reads the local file.

**QA tests:**
- [ ] Admin uploads a video → storage file is non-zero bytes; video plays in feed
- [ ] Restaurant owner uploads a video → same result
- [ ] Admin inserts a `videos` row → succeeds (no RLS error)
- [ ] Restaurant owner inserts a `videos` row for their own place → succeeds
- [ ] Restaurant owner cannot insert a row for another place → blocked by RLS

---

### 7.10 Place Detail — Photo & Menu Viewer ✅ IMPLEMENTED (2026-03-31)

**Goal:** All photos on the restaurant detail page are tappable and zoomable.

- [x] **Gallery photos** — `<View>` wrappers replaced with `<Pressable>`; tap any photo → `Modal` (fade animation) with `ScrollView maximumZoomScale={4}` for native pinch-to-zoom; prev/next arrows; photo counter (`1 / N`); "Pinch to zoom" hint at bottom; expand icon on each thumbnail
- [x] **Menu photos** — same viewer pattern; thumbnails in the horizontal menu strip are now `Pressable`; same `Modal` + zoomable `ScrollView`
- [x] State: `photoViewerIndex` and `menuViewerIndex` (separate) both reset to `null` on close; no stale viewer state between opens

**QA tests:**
- [ ] Tap a gallery photo → full-screen modal opens
- [ ] Pinch to zoom → image zooms up to 4×; can pan while zoomed
- [ ] Tap anywhere outside image → modal closes
- [ ] Prev/next arrows navigate between gallery photos
- [ ] Tap a menu thumbnail on the detail page → full-screen modal opens
- [ ] Same zoom and navigation works for menu photos

---

### 7.11 MenuBottomSheet Redesign ✅ IMPLEMENTED (2026-03-31)

**Goal:** Fix the three bugs in the menu bottom sheet and add standard drag-to-dismiss.

**Root causes fixed:**
- Fragment + second `Modal` (photo viewer was a separate `Modal` outside the sheet `Modal`) caused broken touch dispatch and stale viewer state that blocked re-open
- `viewerIndex` was never reset when the sheet closed, leaving a phantom `Modal` open

**Changes:**
- [x] **Single-Modal design** — entire sheet + viewer live inside one `<Modal>`; photo viewer rendered as an absolutely-positioned `View` overlay inside the same modal; no React Fragment, no second modal
- [x] **Drag-to-dismiss** — `PanResponder` on the handle + header area; drag down > 100 px or flick velocity > 0.8 → sheet animates down to `SHEET_HEIGHT` then calls `onClose`; not far enough → spring snaps back; `Animated.add(slideAnim, dragY)` combines open/close animation with drag offset
- [x] **Pinch-to-zoom viewer** — photo viewer uses `ScrollView` with `maximumZoomScale={4}`, `centerContent`, `bouncesZoom`; same pattern as place detail viewer
- [x] **State reset** — `useEffect` resets `viewerIndex` to `null` when `visible` becomes `false`

**QA tests:**
- [ ] Open menu sheet → grab handle and drag down slowly → sheet follows finger
- [ ] Release after dragging > 100 px → sheet closes
- [ ] Release after dragging < 100 px → sheet snaps back open
- [ ] Flick down quickly → sheet closes even if < 100 px
- [ ] Close and re-open → sheet re-opens correctly (no phantom state)
- [ ] Tap a photo → full-screen viewer opens
- [ ] Pinch to zoom in viewer → zooms up to 4×
- [ ] Tap X or outside → viewer closes; sheet still visible

---

### Phase 7 — QA Gate (run before marking Phase 7 complete)

- [ ] Share: share sheet appears + correct content + analytics fires
- [ ] Maps choice: all 4 map tests pass
- [ ] Menu photos: all 4 menu tests pass
- [ ] Onboarding: all 6 onboarding tests pass *(not yet built)*
- [ ] Restaurant owner role: all 10 role + user-management tests pass
- [ ] Video feed: all 6 video QA tests (7.6) + all 6 refinement tests (7.8) pass
- [ ] Auth improvements: all 5 auth QA tests (7.7) pass
- [ ] RLS/upload: all 5 upload QA tests (7.9) pass
- [ ] Place detail viewer: all 6 photo viewer tests (7.10) pass
- [ ] MenuBottomSheet: all 8 drag/zoom tests (7.11) pass
- [ ] No regressions: favorites, map, explore, admin — all still work
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors ✅ (passing as of 2026-03-31)

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
| GPS / Maps | Google Maps via react-native-maps | Free tier covers MVP scale; best data quality in Libreville |
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
| Google OAuth redirect | Hardcoded `okili://` | `makeRedirectUri()` returns Expo dev client URL in dev builds, causing PKCE mismatch |
| Google OAuth callback parsing | Extract `code` + strip trailing `%23` | Supabase appends `#` (encoded as `%23`) to callback URL; passing full URL to `exchangeCodeForSession` sends malformed code |
| Apple Sign-In Supabase config | Client ID = `com.okili.app` (bundle ID) | Native iOS flow; Supabase verifies `aud` claim in Apple identity token against bundle ID — NOT Team ID |
| Supabase hand-written types | Add `Relationships: []` + `Views`/`Functions` to every table | Required by `@supabase/supabase-js` v2.99 `GenericSchema` constraint; without it all table types resolve to `never` |
| Expo Router entry point | `import 'expo-router/entry'` in `index.ts` | Default `registerRootComponent(App)` bypasses Expo Router; shows blank "Open up App.tsx" screen |
| EAS Build peer deps | `.npmrc` with `legacy-peer-deps=true` | Expo SDK 55 has peer dependency conflicts with npm 10 strict mode |
| react-native-maps Google API key | Use `infoPlist.GMSApiKey` not `ios.config.googleMapsApiKey` | The latter triggers deprecated `react-native-google-maps` pod which no longer exists in `react-native-maps` 1.x |

---

## 2026-05-06 — 3-Tier Monetization + Coupons + Referrals (planned)

**Trigger:** Founding team (Eunice's PDF, March 2026) proposed a 3-tier B2B model (Free / Standard / Premium) with companion features. The PRD (§6) had the tier model "defined, not enforced." This entry turns it into an enforced product surface and adds two MVP systems (owner coupons with QR redemption, end-user referral codes).

**Source PDF:** [`docs/Remarks from Eunice.pdf`](./Remarks%20from%20Eunice.pdf)

**Status as of 2026-05-06:** Decisions finalized in interactive review with founder. Implementation not yet started.

### Tier composition (final)

| Capability | Free | Standard | Premium |
|---|---|---|---|
| Edit name / description / address / hours / contact | ✅ | ✅ | ✅ |
| Reply to reviews | ✅ | ✅ | ✅ |
| Photos | ✅ (max 5) | ✅ (unlimited) | ✅ (unlimited) |
| Video | ❌ | ❌ | ✅ |
| Menu (photos + PDF upload) | ❌ | ✅ | ✅ |
| WhatsApp / Call / Website CTAs | ❌ | ✅ | ✅ |
| Social links (Instagram / Facebook / TikTok) | ❌ | ✅ | ✅ |
| "Vérifié par O'Kili" badge (auto-derived from tier) | ❌ | ✅ | ✅ |
| Views count (basic owner stat) | ❌ | ✅ | ✅ |
| Coupons (create + display) | ❌ | ✅ | ✅ |
| Trending Now / top-3 in category (one unified surface) | ❌ | ❌ | ✅ |
| Competition trends (search-trend insights) | ❌ | ❌ | ✅ |
| Reservations module | post-MVP | post-MVP | post-MVP |
| Geolocated push notifications | post-MVP | post-MVP | post-MVP |
| Advanced clicks analytics | post-MVP | post-MVP | post-MVP |

### Other settled decisions
- **Tier lives on `places`** (not on profile) — future-proofs multi-place owners.
- **Launch default**: 50+ curated launch listings start on **Standard with a 3-month free promo** (`subscription_expires_at = launch + 3 months`).
- **Payments**: manual in-person collection. Admin flips tier and expiry date. No in-app payment.
- **Expiration behavior**: no auto-downgrade. Admin dashboard surfaces an "expiring / expired" filter; admin acts manually.
- **Owner onboarding**: admin-only (already built — no self-serve "claim your business" flow).
- **Moderation queue**: **OFF by default** for MVP — owner edits go live immediately. A `system_settings.moderation_enabled` toggle ships, but the queue itself is post-MVP.
- **Verified badge**: auto-derived from tier ≥ Standard. No separate flag.
- **Coupon redemption**: QR code shown by user, scanned in restaurant-admin.
- **Referral entry**: at signup only.
- **Referral reward**: admin-configurable from settings UI (not hardcoded).
- **"Top de Liste" + "À la une"**: treated as one surface — existing `is_promoted`-driven Trending Now, gated to Premium, also boosts top-3 in category search.
- **Global admin requirement**: every tier-feature toggle, per-tier limit, the moderation toggle, and the referral reward configuration must be editable from both the web admin and (where mobile-appropriate) the mobile admin. Stored in DB, read at runtime, no code deploy.

### New DB schema (Migration 014 — to be written)

```sql
-- Tier on places
alter table places
  add column subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'standard', 'premium')),
  add column subscription_expires_at timestamptz,
  add column social_instagram text,
  add column social_facebook text,
  add column social_tiktok text,
  add column menu_pdf_path text;

create index places_subscription_tier_idx on places(subscription_tier);

alter table places
  add constraint promoted_requires_premium
  check (not is_promoted or subscription_tier = 'premium');

-- Admin-editable tier matrix
create table tier_features (
  feature_key text not null,
  tier text not null check (tier in ('free','standard','premium')),
  enabled boolean not null default false,
  updated_at timestamptz default now(),
  primary key (feature_key, tier)
);

create table tier_limits (
  tier text primary key check (tier in ('free','standard','premium')),
  max_photos int not null default 5
);

-- Coupons
create table coupons (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  title_fr text not null,
  title_en text,
  description_fr text,
  description_en text,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  max_redemptions_per_user int default 1,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references coupons(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  redemption_code text not null,
  redeemed_at timestamptz,
  created_at timestamptz default now(),
  unique (coupon_id, user_id, redemption_code)
);

-- Referrals
alter table profiles
  add column referral_code text unique,
  add column referred_by uuid references profiles(id);

create table referral_settings (
  id int primary key default 1 check (id = 1),
  reward_type text not null default 'coupon',  -- 'coupon' | 'points' | 'none'
  referrer_reward_value int default 0,
  referee_reward_value int default 0,
  reward_coupon_id uuid references coupons(id),
  is_active boolean default true,
  updated_at timestamptz default now()
);

-- Global settings (currently just moderation toggle)
create table system_settings (
  id int primary key default 1 check (id = 1),
  moderation_enabled boolean default false
);
insert into system_settings (id) values (1) on conflict do nothing;

-- Premium "competition trends" backing data
create table search_trends_weekly (
  week_of date not null,
  category_id uuid references categories(id),
  search_count int not null default 0,
  primary key (week_of, category_id)
);
```

### Implementation order (planned)

Each completed item will get its own dated entry below this one as it ships.

1. Migration 014 + types regen
2. `usePlaceTier` hook + tier_features/limits seeding + admin matrix UI (web first, then mobile)
3. Place detail gating end-user-facing
4. Restaurant-admin tier-awareness (dashboard + edit + locked cards)
5. Top admin PlaceForm tier controls (mobile + web)
6. Reviews replies in restaurant-admin (Free-accessible)
7. Coupons end-to-end (owner create + user view + QR + scanner)
8. Referral codes (signup field + settings + reward issuing)
9. Stats screen (views count) for Standard+
10. Competition trends + scheduled aggregator
11. Renewals admin filter + expiring stat cards
12. Moderation toggle UI (switch + system_settings row)

### Out of MVP (Phase 6+)
- Reservations module (table booking via app)
- Geolocated push notifications
- Advanced clicks analytics for owners
- Self-serve "claim your business" signup
- In-app payments
- Moderation queue actual implementation (only the toggle ships in MVP)

### Files to be modified (planned)

**Mobile** — new hooks (`usePlaceTier`, `useTierFeatures`, `useReferralSettings`, `useSystemSettings`, `useCoupons`, `useCouponRedemption`, `useTrends`); restaurant-admin updates (`_layout`, `index`, `edit`, new `coupons`, `scanner`, `reviews`, `trends`, `stats`); top admin (`places/[id]`, new `tier-features`, `tier-limits`, `referral-settings`, `system-settings`, expiring filter on dashboard); end-user (`place/[id]`, `(tabs)/explore`, `auth/signup`); components (`PlaceCard` skinny variant, new `CouponCard`, `CouponQrModal`, `LockedFeatureCard`); `database.types.ts` regen; new `feature-keys.ts`; FR/EN i18n keys.

**Web** — `PlaceForm`, `admin/places/page.tsx`, new `admin/tier-features/page.tsx`, `admin/tier-limits/page.tsx`, `admin/referral-settings/page.tsx`, `admin/system-settings/page.tsx`, `admin/coupons/page.tsx`.

**Supabase** — `functions/aggregate-search-trends/` daily aggregator.

### Pre-existing pre-launch items (still pending, unrelated to this entry)
- Re-enable Gabon bounding box check in `mobile/components/admin/PlaceForm.tsx` and `web/components/PlaceForm.tsx` before App Store submission
- Phase 7.1 (Share button), 7.2 (Apple/Google Maps choice sheet), 7.4 (Onboarding)
- Phase 6 Polish & Launch (app icon, splash, EAS Build, store submission)

### Document hygiene rule
This file is the source of truth. Going forward, every meaningful decision, completion, or change gets a new dated entry appended below — never overwrites prior history.

---

## 2026-05-08 → 2026-05-10 — Implementation log: Steps 1-7 + web admin restyle

Founder paired with Claude Code to ship the bulk of the 3-tier monetization plan. All commits pushed to `dev` branch on `https://github.com/rapetoh/Gabon-guide.git`. iOS dev build installed both on the iOS simulator and on Senyo's iPhone (both via `npx expo run:ios` / `--device`).

Work done in chronological order (commit hashes are in `dev`):

### Step 1 — Migration 014 applied (2026-05-08)
- `supabase/migrations/014_tiers_coupons_referrals.sql` written and applied to the OKiLi Supabase project (`fvmzsxmlpwvtnszmuowc`) via MCP.
- Backfill: any place that already had `is_promoted = true` was upgraded to `subscription_tier = 'premium'` so the new `promoted_requires_premium` check constraint wouldn't reject existing rows.
- Seeds: `tier_features` populated with 11 keys × 3 tiers per §1.1; `tier_limits` set to {free: 5, standard: 9999, premium: 9999}; single-row `referral_settings` and `system_settings` (moderation_enabled = false) inserted.
- Verified seeds: Free=0/11 enabled, Standard=8/11, Premium=11/11.
- Commit: `876eaa9` (PLAN.md log) → `76f56c5` (migration + foundation hooks + web admin matrix) → `baa791b` (mobile admin matrix).

### Step 2 — Foundation hooks + admin matrix UI (web + mobile)
- New mobile hooks `usePlaceTier`, `useTierFeatures`, `useTierLimits`, `lib/feature-keys.ts`.
- Hand-written `database.types.ts` updated in **both** `mobile/lib/` and `web/lib/`. Caught up missing fields on `places` (`is_promoted`, `promoted_label_*`) and `profiles` (`email`), added `videos.thumbnail_url` to Insert as optional, added Functions block for `set_review_owner_reply` and `get_all_users_for_admin`. Both files kept identical via `cp`.
- Web `/admin/tier-settings` page: server component loads matrix + limits, client component renders a checkbox grid + per-tier `max_photos` inputs. Optimistic updates with rollback on error.
- Mobile `/admin/tier-settings` screen: same matrix UX adapted to React Native; tap-to-toggle cells, inline-edit photo limits.
- Sidebar entry "Tier settings" added on web; gear icon button added to the mobile admin dashboard header.

### Step 3 — Place detail tier gating
- `mobile/app/place/[id].tsx` wired to `usePlaceTier(p)`. Photos slice by `tier.photoLimit`; Photo viewer modal indices use `visiblePhotos`; Action grid CTAs (Call/Website/WhatsApp) gated; new social-links row (IG/FB/TikTok) gated by `tier.can('social_links')`; Menu section gated by `tier.can('menu')`; Vérifié badge added in the title-card badge row when `tier.isVerified`; bottom sticky CTA gated.
- Hooks-rules bug found and fixed: `usePlaceTier` was being called *after* the early-return for loading state → "Rendered more hooks than during the previous render". Moved the call above the returns. Commit: `629eaa1`.
- Commit (initial Step 3): `a47439f`.

### Step 4 — Restaurant-admin tier-aware
- New shared component `mobile/components/restaurant-admin/LockedFeatureCard.tsx`.
- `restaurant-admin/index.tsx`: tier badge card under the place card with FR/EN label, color-coded per tier, "Expires in N days / Expired" hint when applicable. "Available" section + "Unlock more" section (locked feature cards for coupons / stats / market trends / featured placement).
- `restaurant-admin/edit.tsx`: adds editable address / phone / WhatsApp (open to ALL tiers per the founder's PDF); adds Social links inputs gated by `tier.can('social_links')` with LockedFeatureCard fallback; gates Video upload by `tier.can('video')`; gates Menu photos by `tier.can('menu')`; gallery photos respect `tier.photoLimit` with used/cap counter and lock state at cap.
- Save handler writes the new fields and skips socials when tier doesn't permit.
- Commit: `a9fd6e6`.

### Step 5 — Top admin PlaceForm tier controls (mobile + web)
- `mobile/components/admin/PlaceForm.tsx` and `web/components/PlaceForm.tsx` both gain:
  - Pack selector (Free / Standard / Premium) — 3-button segmented.
  - Subscription `expires_at` date input + +3-months / +1-year / Clear quick buttons. Empty = no expiry. No auto-downgrade.
  - Social links section (Instagram / Facebook / TikTok URL fields).
  - Promotion toggle disabled when subscription_tier ≠ premium. Demoting away from Premium auto-clears `is_promoted` in form state.
  - Save payload writes the new fields and forces `is_promoted = false` for non-Premium.
- Commit: `bd1f02f`.

### Web admin restyle — between steps 5 and 6 (founder request)
- Founder shared a desktop reference design (Eunice's friend Claude Design archive) and asked for layout/structure improvements only — **no color or font changes**, login screen and mobile app untouched.
- New shared `web/components/admin/Topbar.tsx` (breadcrumb + title + actions).
- `web/app/admin/layout.tsx`: sectioned sidebar (Général / Settings / Coupons), branded mark, user card pinned to bottom with avatar circle + email + role + Sign out icon row. Sidebar widened 224 → 240px.
- Overview page: 4 hero stat cards (Total / Promoted / Premium / Expiring ≤ 30d) + 2-col panels (Tier distribution bars, Quick actions) + recent places table with Tier and Status pills.
- Places list: filter chips with live counts, new tier filter strip, soft-tint status pills, richer empty state.
- PlaceForm: **two-column** xl layout — main editing fields on the left, Subscription / Promotion / Social / Visibility on the right. Photos section moved below the grid, full-width. Action bar with top border at the very bottom.
- Photos / Videos / Tier settings / New place pages all adopt the new Topbar.
- LogoutButton reformatted to match sidebar nav row style.
- Commit: `d8612de`.

### Step 6 — Owner review replies (Free-tier accessible)
- `supabase/migrations/015_review_owner_replies.sql` written and applied. Adds `owner_reply` text + `owner_reply_at` timestamptz on `reviews`. Adds `set_review_owner_reply(p_review_id, p_reply)` SECURITY DEFINER RPC; only the place owner OR an admin can call it; empty/whitespace clears the reply.
- Hand-written types updated in both apps: ReviewWithProfile + reviews table Row gain `owner_reply` / `owner_reply_at`. Functions block declares `set_review_owner_reply`.
- `mobile/hooks/useReviews.ts`: select clause fetches `owner_reply` + `owner_reply_at`; new `useSetOwnerReply` mutation.
- `mobile/app/restaurant-admin/reviews.tsx` (new): lists every review with stars + comment; per review either a "Reply to this review" CTA or an editable card showing the reply with edit/delete. Multi-line text input + Cancel / Publish / Delete actions.
- `mobile/app/restaurant-admin/index.tsx`: "Reviews & replies" stub becomes a real link to `/restaurant-admin/reviews`. Open to all tiers.
- `mobile/app/place/[id].tsx`: reviews list renders `owner_reply` as an indented quote with an orange left border and a "Réponse du restaurant / Reply from the restaurant" eyebrow.
- Commit: `61d3bba`.

### Step 7 — Coupons end-to-end (PARTIAL — see Open Issues)
- New native deps installed via `npx expo install`: `expo-camera ~55.0.18` (BarcodeScanner via `<CameraView>`), `react-native-qrcode-svg ^6.3.21` (uses already-installed `react-native-svg`).
- `mobile/app.config.js`: `expo-camera` plugin added with French permission string; microphone + recordAudioAndroid set to false.
- Mobile hooks:
  - `useCoupons.ts`: list (all states / active-only), create, update, delete; `useOwnedPlaceId`.
  - `useCouponRedemption.ts`: `encodeQrPayload` / `decodeQrPayload`, `useUserRedemption`, `useStartRedemption`, `useRedeemCode`, `useCouponRedemptions`. Owner-side redeem throws `ALREADY_REDEEMED` if double-scanned.
- Owner UI:
  - `restaurant-admin/coupons.tsx`: tier-gated by `coupons_create`. Free owners see a LockedFeatureCard. Paid owners get a create form (FR/EN title, description, expiry with quick-pick) and a list with Live/Off/Expired pill, active toggle, delete. Header has a scan shortcut button.
  - `restaurant-admin/scanner.tsx`: full-screen camera with QR-only barcode scanning, branded reticle + hint, result modal with success/error/already-redeemed states + "Scan another" CTA. Permission gate with explanation.
  - Restaurant-admin dashboard: "Coupons & promos" entry shown when tier permits.
- End-user UI:
  - `components/place/CouponsBlock.tsx`: "Available coupons" section with one card per active coupon (orange left-border + ticket eyebrow + Use button). Tap "Use" → modal with a 220px QR. Reuses an existing redemption row if one exists.
  - Logged-out users redirected to `/auth/login` with the place URL as redirect.
- Web admin:
  - `/admin/coupons` cross-place table with redemption stats + Live/Inactive/Expired filter chips. Status pill computed live (live / scheduled / inactive / expired).
  - "Coupons" sidebar entry added to the Général group.
- Native rebuild was required and was performed by founder (port 8084 used because 8081 is held by their other voice-expense project; iPhone build via `--device`). Coupon **creation by owner** confirmed working. **QR rendering on user side** confirmed working (iOS native Camera reads it instantly).
- Commits: `0b63114` (initial Step 7) → `28b0cfd` (stable cell layout in PlaceForm tier UI from earlier — included for completeness) → `fbaae85` (ref-based onBarcodeScanned + diagnostic logs) → `cac7ce1` (QR payload format change).

---

## Current state at handoff (2026-05-10)

### What works end-to-end
- All admin matrix toggles + per-tier photo limits (web + mobile).
- Place detail tier gating, including Vérifié badge and photo cap.
- Restaurant-admin dashboard with tier badge + locked-feature upsell cards.
- Restaurant-admin edit with address/phone/WhatsApp + tier-gated socials/menu/video + photo cap.
- Top admin PlaceForm tier controls + promotion-requires-Premium constraint enforced both client-side and via DB check constraint.
- Web admin layout/structure refresh, no color or font change. Two-column PlaceForm.
- Owner review replies (create / edit / delete) and public display on place detail.
- Coupon creation by Standard+ owners.
- Coupon QR generation on user side (visible and scannable by iOS native Camera).
- Web admin `/admin/coupons` cross-place overview.

### Open issues / unfinished work
1. **CRITICAL — Coupon QR scanning not firing in our in-app scanner.**
   - Symptom: `mobile/app/restaurant-admin/scanner.tsx` shows live preview, reticle visible. iPhone (Senyo's iPhone) is the scanner, simulator displays the user-side QR. Pointing iPhone at the simulator's QR results in **no scan event firing** — `[scanner] onBarcodeScanned event fired with data:` log (added 2026-05-10) never appears in Metro terminal.
   - Side evidence: iOS native Camera app reads the QR fine and tries to deep-link, getting an "Unmatched Route" page (Step 7 commit `cac7ce1` changed the QR format from `okili:c:1:<id>:<code>` to `OKILI|1|<id>|<code>` to address that — decoder still accepts both).
   - Last fix attempt: the format change in `cac7ce1`. Founder reloaded the iPhone with the new code; not yet confirmed whether scanning fires after that. Handoff state: **awaiting founder's test result of `cac7ce1`**.
   - Confidence in the format-change fix: ~50% per Claude. If it doesn't work, next steps are documented under "Pivot plan if `cac7ce1` doesn't fix it" below.

2. **Pre-existing pre-launch checklist items still pending** (unchanged):
   - Re-enable Gabon bounding box check in `mobile/components/admin/PlaceForm.tsx` and `web/components/PlaceForm.tsx`. Search for `TODO (pre-launch)`.
   - PRD Phase 7.1 Share button (Branch.io smart links).
   - Phase 7.2 Apple/Google Maps choice sheet (most plumbing already exists in `mobile/app/place/[id].tsx`).
   - Phase 7.4 Onboarding flow.
   - Phase 6 Launch prep: app icon, splash, EAS Build, App Store + Play Store submission.

3. **App Store bundle ID note** (operational, not code):
   - Current dev build on Senyo's iPhone uses `com.rapetoh.okili` because `com.okili.app` couldn't auto-sign on this Mac. Founder has a paid Apple Developer Program; the dev profile for `com.okili.app` was missing on this Mac (the project was transferred from Windows via Telegram). For App Store submission, the bundle ID needs to be reverted to `com.okili.app` once the dev profile is generated by Xcode (Signing & Capabilities → Automatically manage signing → pick paid team).

### Pivot plan if `cac7ce1` doesn't fix the scanner
If founder reports that scanning still doesn't fire after `cac7ce1`:
1. Strip `mobile/app/restaurant-admin/scanner.tsx` to the minimum: inline `onBarcodeScanned` arrow function, no refs, no useCallback. Add a `console.log` at component render time.
2. Verify `[scanner] component rendered` fires once per mount in Metro terminal.
3. If it does and `onBarcodeScanned` STILL doesn't fire, the bug is at the native level (CameraView prop wiring, possibly an SDK 55 quirk). Next move: try a fresh `expo install expo-camera` and full native rebuild.
4. If `[scanner] component rendered` doesn't fire either, the route isn't reaching this screen — investigate `expo-router` typed-routes handling for `/restaurant-admin/scanner`.

### Project state summary
- Branch: `dev`. Latest commit: `cac7ce1`. All steps 1-7 + web restyle pushed to `origin/dev`.
- Native deps current at: `expo ~55.0.6`, `expo-camera ~55.0.18`, `react-native-qrcode-svg ^6.3.21`, `react-native-svg 15.15.3`.
- Both mobile + web `npx tsc --noEmit` clean (modulo a pre-existing `@expo/vector-icons` resolver warning that's unrelated to any of our work).
- Two Metro processes coexist on the founder's machine: 8081 (other voice-expense project) and 8082/8083 (this project). Use `--port 8082` or `8083` on `expo start --dev-client` to avoid port collision.
- Permissions footnote: this project's `node_modules/` was originally moved from Windows via Telegram and macOS quarantined it. Founder ran fresh `npm install` in both `mobile/` and `web/` on 2026-05-09 to clear it permanently. Subsequent `npm install` runs work without manual chmod.

### Memory / context references for the next session
- `MEMORY.md` exists with: `project_prelaunce_checklist.md` (Gabon bounds check) and `project_architecture_decisions.md` (10+ entries pre-dating this work; tier work is logged here in PLAN.md, not in memory).
- The founder's design reference archive (Eunice's friend) sits at `/tmp/okili-design/` from earlier in this session — it may be cleared on next restart. The design file the founder agreed to take inspiration from was `screens/web.jsx` in that archive (web/desktop only).

---

## 2026-05-10 (cont.) — Coupon scanner: real root cause + fix

Founder switched sessions because previous context was nearly full. Confirmed at handoff: `cac7ce1` did not fix the in-app scanner — `[scanner] onBarcodeScanned event fired with data:` still never appeared in Metro after a reload of the iPhone with the new build.

### Root cause (confirmed against expo-camera 55 source)

Starting in expo-camera SDK 55, barcode scanning was split out of the main pod into a separate companion pod, **`ExpoCameraBarcodeScanning`**, that is **not registered with Expo autolinking**. Three smoking guns:

1. `node_modules/expo-camera/expo-module.config.json` only registers `ExpoCamera.podspec` — autolinking never installs the companion.
2. `node_modules/expo-camera/ios/ExpoCamera.podspec` line 27: `s.exclude_files = "barcode-scanning/**"` — main pod explicitly excludes the provider sources.
3. `node_modules/expo-camera/ios/ExpoCameraBarcodeScanning.podspec` exists separately, depends on `ZXingObjC/PDF417` + `ZXingObjC/OneD`, and ships the `ExpoCameraZXingProvider` Swift class that the runtime looks up via `NSClassFromString("ExpoCameraZXingProvider")`.

Confirmed missing from project:
- `mobile/ios/Podfile.lock` lists `ExpoCamera` but no `ExpoCameraBarcodeScanning`.

Native consequence — `mobile/node_modules/expo-camera/ios/Current/BarcodeScanner.swift`:
```swift
var isAvailable: Bool { return barcodeProvider != nil }
func maybeStartBarcodeScanning() {
  guard isScanningBarcodes else { return }
  guard barcodeProvider != nil else { return }   // ← silently bails
  ...
}
```

With no provider linked, every scan attempt hits this guard and returns. No error. No log (other than the one-shot `Barcode scanning has been disabled` warning when settings are first applied — which the previous session saw and misattributed to JS prop-identity churn). Camera preview keeps working because preview doesn't go through the BarcodeScanner code path.

QR specifically: even though the ZXing provider only registers PDF417 / Code39 / Codabar readers (not QR), the gate in `BarcodeScanner.maybeStartBarcodeScanning` is `barcodeProvider != nil`, not "provider supports this type." Once the provider exists, iOS's native `AVCaptureMetadataOutput` is what actually decodes QR codes. So linking the companion pod fixes QR scanning even though the pod's only purpose on paper is the ZXing-backed formats.

### What the previous session got wrong

Commit `28b0cfd` ("stable identity for CameraView props") and `fbaae85` ("ref-based onBarcodeScanned for truly stable identity") attributed the bug to prop-identity churn making expo-camera tear down its scanner pipeline. That theory is wrong — re-reading `CameraView.swift`, prop changes do not tear down the barcode pipeline. Stable refs are still a fine pattern (worth keeping for what it actually does — preventing stale closures over `state`), but they were not the fix.

Commit `cac7ce1` ("drop the okili: URL scheme") addressed a different symptom — iOS native Camera app outside our app deep-linking the QR. That's unrelated to the in-app scanner. Kept as-is on purpose since the decoder still accepts both formats.

### Fix shipped this session (uncommitted at time of writing)

1. **New config plugin** — `mobile/plugins/withExpoCameraBarcodeScanning.js` — uses `withDangerousMod('ios', ...)` to append `pod 'ExpoCameraBarcodeScanning', :path => '../node_modules/expo-camera/ios'` to `ios/Podfile` during prebuild. Idempotent (checks for existing marker) and fails loudly if the anchor (`use_expo_modules!`) is missing.
2. **`mobile/app.config.js`** — appended `'./plugins/withExpoCameraBarcodeScanning'` to the plugins array so prebuild picks it up.
3. **`mobile/ios/Podfile`** — patched directly so the founder doesn't have to run a full `npx expo prebuild` to test. The plugin keeps it in sync if/when prebuild ever runs.
4. **`mobile/app/restaurant-admin/scanner.tsx`** — removed the misleading "stable identity prevents barcode pipeline teardown" comments and the diagnostic `console.log` calls (no longer needed). Kept the ref-based handler structure (still correct, just for a different reason).

### What the founder needs to run to activate the fix

```bash
cd /Users/roch/Desktop/Gabon-guide/mobile/ios
pod install
cd ..
npx expo run:ios --device   # or --simulator if testing without iPhone
```

`pod install` is required — JS reload alone cannot pick up the missing native module. After the rebuild, `Podfile.lock` will list `ExpoCameraBarcodeScanning` and `ZXingObjC/{PDF417,OneD}`. From then on, `onBarcodeScanned` fires on QR detection.

### Verification checklist after rebuild

1. Open `restaurant-admin/scanner` on the iPhone build.
2. Display a coupon QR on the simulator (user-side `place/[id]` → "Use" button).
3. Point iPhone at simulator screen, frame inside reticle.
4. Expected: success modal pops within ~1s, redemption row gets `redeemed_at` populated, second scan of the same QR shows "ALREADY_REDEEMED".

If step 4 still fails after a clean rebuild, the next thing to check is the console log on the iPhone (Xcode → Devices → Senyo's iPhone → Open Console) for `Barcode scanning has been disabled` warnings or any `ZXingObjC` linker complaints.

### Files touched
- `mobile/plugins/withExpoCameraBarcodeScanning.js` (new)
- `mobile/app.config.js` (plugin registration)
- `mobile/ios/Podfile` (gitignored — patched directly so today's rebuild works)
- `mobile/app/restaurant-admin/scanner.tsx` (comment cleanup)
- `docs/PLAN.md` (this entry)

### Post-fix: Podfile module-map error on first `pod install`

Initial `pod install` failed with: *"The Swift pod `ExpoCameraBarcodeScanning` depends upon `ZXingObjC`, which does not define modules."* CocoaPods needs module maps for Swift to consume ObjC pods; ZXingObjC ships without them. Fixed by also adding `pod 'ZXingObjC/PDF417', :modular_headers => true` and `pod 'ZXingObjC/OneD', :modular_headers => true` to the Podfile, and updating `withExpoCameraBarcodeScanning.js` to inject all three lines so future prebuilds stay in sync.

After the fix, `pod install` succeeded, the iPhone rebuild was clean, and **scanning fires reliably** — founder-confirmed on 2026-05-10.

---

## 2026-05-10 (cont.) — Coupons: quotas, discount value, bill capture, scan-result UX

Continued the coupon work after scanning was unblocked. Founder asked for:
1. **Per-user usage limit** — configurable, enforced.
2. **Total quota** — coupon becomes unavailable after N total redemptions.
3. **Discount value model** — owners declare the discount as a percentage or fixed FCFA amount on each coupon.
4. **Bill amount capture at redeem time** — owner enters the customer's bill; app computes the discount; redemption row stores both for later analytics.
5. **Scan UX change** — exit the camera as soon as a QR is detected; show the result modal on the coupons page (which is where the owner came from). User explicitly chose this over the in-camera result modal; ownership taken on the trade-off.
6. **Show last redemption date/time** on the user-side card.
7. **Customer info in scan result** — name + email of the customer whose QR was just scanned.

### Migration 016 (applied to OKiLi Supabase project via MCP)

`supabase/migrations/016_coupons_quota_and_value.sql`:
- `coupons.max_total_redemptions int` — nullable = unlimited; CHECK `> 0` when set.
- `coupons.discount_type text` — `'percentage' | 'amount'` — nullable for "no math" coupons.
- `coupons.discount_value int` — % (1-100) or FCFA amount; CHECK constraints enforce pairing with `discount_type` and valid range per type.
- `coupon_redemptions.bill_amount int` — nullable, FCFA, captured by owner at redeem time. CHECK `>= 0`.
- `coupon_redemptions.discount_applied int` — nullable, FCFA, computed at redeem time. CHECK `>= 0`.
- Partial index `coupon_redemptions_redeemed_idx (coupon_id, user_id) WHERE redeemed_at IS NOT NULL` — supports fast quota counts.

### Hook layer

`mobile/hooks/useCouponRedemption.ts` rewritten:
- New exports: `REDEMPTION_ERRORS` (string union for thrown error keys), `useCouponUsage`, `useLastUserRedemption`, `useScanContext`.
- `useUserRedemption` now returns only **unredeemed** rows (so multi-use coupons can have multiple historical rows and the live QR shows the open one). `useLastUserRedemption` is the new accessor for "last redeemed" date display.
- `useStartRedemption` enforces total quota + per-user limit + active/expired status **before** creating a new row. Reuses the user's open unredeemed row when one exists (single live QR per user/coupon at a time).
- `useRedeemCode` now accepts `billAmount?: number`. Re-checks quotas defensively (concurrent redemptions could push the coupon over the limit between QR generation and owner scan). Computes `discount_applied` from coupon's `discount_type`/`discount_value` and the supplied bill, capped at the bill amount.
- `useScanContext(couponId, code)` returns coupon + redemption row + customer profile + current usage counts in a single query bundle — feeds the new scan modal.

### Owner UI

`mobile/app/restaurant-admin/coupons.tsx`:
- Create form gained: per-customer limit, total quota (empty = unlimited), discount type segmented control (None / % / FCFA), discount value input with type-aware placeholder + validation (% capped at 100, FCFA positive).
- Each coupon card now shows a `CouponInfoRow`: discount pill + `X / Y used` or `X used` + "Sold out" badge when applicable.
- Picks up `scanCouponId` + `scanCode` from route params (`useLocalSearchParams`), opens `ScanResultModal`, then strips the params so reopening the page doesn't replay the modal.

`mobile/components/restaurant-admin/ScanResultModal.tsx` (new):
- Single component renders four modes: loading / error / ready-to-redeem / success.
- Error modes cover CODE_NOT_FOUND, COUPON_INACTIVE_OR_EXPIRED, COUPON_SOLD_OUT, PER_USER_LIMIT_REACHED, ALREADY_REDEEMED (with last-redeem date/time), and a fallback for unknown errors.
- Ready mode shows customer name + email, current usage count, an optional bill input (only if the coupon has a discount), and live "Customer pays: X FCFA" math as the owner types.
- Success mode echoes the customer card + final amounts so the owner has a moment of confirmation.

`mobile/app/restaurant-admin/scanner.tsx` rewritten:
- On QR decode, immediately `router.replace('/restaurant-admin/coupons', { scanCouponId, scanCode })`. No in-camera result modal anymore.
- Sets `CameraView active={false}` during the route transition + dims overlay so it doesn't keep firing scans during the handoff.
- All the redemption logic moved out — scanner is now purely a decode-and-handoff screen.

### User-facing changes

`mobile/components/place/CouponsBlock.tsx` rewritten:
- Discount pill in the card header when set.
- "Used X / N" and "Last used: 12 May 2026, 14:32" surfaced on the card whenever the user has any redemption history or the per-user max is > 1.
- Button states: **Sold out** (grey, disabled), **Limit reached** (green, disabled, shown after they've hit their per-user cap), **Use this coupon** / **Use again** (orange).
- QR modal handles `useStartRedemption` errors (sold out, limit reached, inactive) inline with a clear message instead of failing silently.

### Web admin

`web/app/admin/coupons/page.tsx`: added Discount column, separate Quota column showing `X / max_total · Sold out` when applicable, and a "max N/customer" sub-line when `max_redemptions_per_user > 1`. "Redeemed" column now shows "X / Y generated" for clarity.

### Types

Mobile `database.types.ts` updated; `cp`'d to `web/lib/database.types.ts` so both apps stay in sync (hand-written, not generated). `Coupon` interface in `useCoupons.ts` extended with the new fields.

### tsc

Both mobile + web `npx tsc --noEmit` clean (modulo the pre-existing `@expo/vector-icons` resolver warning).

### Files touched / created
- `supabase/migrations/016_coupons_quota_and_value.sql` (new, applied)
- `mobile/lib/database.types.ts` + `web/lib/database.types.ts` (kept in sync)
- `mobile/hooks/useCoupons.ts`
- `mobile/hooks/useCouponRedemption.ts` (large rewrite)
- `mobile/app/restaurant-admin/coupons.tsx`
- `mobile/app/restaurant-admin/scanner.tsx` (full rewrite — decode + handoff only)
- `mobile/components/restaurant-admin/ScanResultModal.tsx` (new)
- `mobile/components/place/CouponsBlock.tsx` (rewrite)
- `web/app/admin/coupons/page.tsx`
- `docs/PLAN.md` (this entry)

### What changes for the next session
- Scanner flow now exits the camera on detection — if you need to test the scanner again, expect to land back on the coupons page with a modal, not see a modal stacked on the live camera. This is intentional, by founder's design call.
- `useUserRedemption` now returns ONLY unredeemed rows — any caller relying on it to detect "ever-redeemed" needs to switch to `useLastUserRedemption` or `useCouponUsage`.
- All quota checks are client-side at the moment. For tighter race-condition safety later (e.g., two devices redeeming simultaneously at the exact moment of the last quota slot), a Postgres function with row locking would be the upgrade — but at MVP scale this is acceptable.
- Bill amount input is **optional**: owners can skip it and still mark the coupon redeemed. `bill_amount` and `discount_applied` will be null on the row. Decision documented in this session per founder go-ahead.

---

## 2026-05-10 (cont.) — Step 8: Referrals end-to-end

Founder confirmed Step 7 (coupons) was working as intended (single QR per active redemption; quotas, discount math, bill capture all good). Moved to Step 8 per the original 2026-05-06 roadmap.

### What ships

- New users can enter a friend's **referral code** at signup. If valid, the link is recorded (`profiles.referred_by`) AND both parties receive the admin-configured reward.
- Reward is a **coupon** for MVP (points are post-MVP per founder decision in 2026-05-06 entry). Admin picks one currently-active coupon from any place; the signup trigger issues an unredeemed `coupon_redemptions` row to each side. The reward surfaces automatically on the place page because `useStartRedemption` already returns the existing unredeemed row.
- Every user has an auto-generated unique 8-char referral code (already done by migration 014's `set_referral_code_on_profile` trigger + backfill — verified: all 6 existing profiles have codes).
- Profile screen shows the user's code + invited-friend count + native Share sheet CTA.
- Admin settings page (web + mobile) toggles program active, picks reward type, picks reward coupon.

### Migration 017 (applied via MCP)

`supabase/migrations/017_referral_signup_flow.sql`:
- New helper `public.generate_coupon_redemption_code()` — 8-char alphanumeric, same alphabet as the client-side `generateCode()` in `useCouponRedemption.ts`. Used only by the trigger.
- Replaces `public.handle_new_user()` (the AFTER INSERT trigger on `auth.users` that creates the profile row). New version:
  1. Reads `raw_user_meta_data->>'referral_code'`, normalizes to uppercase.
  2. Looks up the referrer's profile by `referral_code` (if a code was supplied).
  3. Inserts the new profile with `referred_by` set (defensive `COALESCE` on conflict).
  4. If `referral_settings.is_active` AND `reward_type='coupon'` AND `reward_coupon_id` points to an **active, current** coupon, inserts unredeemed `coupon_redemptions` rows for both the new user and the referrer.
  5. Invalid codes / inactive program / missing reward coupon → signup still succeeds, the linkage is recorded where possible, no rewards. Trigger never blocks the signup.
- `SECURITY DEFINER` so it bypasses RLS; runs in the owner context.
- Self-referral is naturally impossible: at lookup time the new user's profile (and therefore their auto-generated code) does not yet exist.

### Hooks

`mobile/hooks/useReferrals.ts` (new):
- `useReferralSettings()` / `useUpdateReferralSettings()` — single-row settings table read/write for admins.
- `useMyReferral()` — current user's code, who referred them (if any), and `invitedCount` of profiles where `referred_by = me`. One round-trip, two parallel queries.
- `checkReferralCodeExists(code)` — async helper available if we ever want pre-submit validation. Not used yet (the trigger handles invalid codes silently).

### Signup flow

`mobile/app/auth/login.tsx`:
- New `referralCode` state. Only rendered in register mode, just below the password field.
- Auto-uppercases, strips non-alphanumeric, max 12 chars.
- On submit, the trimmed/uppercased code is passed as `options.data.referral_code` in `supabase.auth.signUp`. From there the auth trigger does the work — no extra client roundtrip.
- Translations added to both `locales/fr.json` and `locales/en.json` under `auth.referralCode` + the whole `referral.*` namespace.

### Profile screen

`mobile/app/(tabs)/profile.tsx`:
- New referral card between Preferences and Restaurant-owner sections. Only renders when signed in and the user's code is loaded.
- Shows the code in a large orange display + a one-line hint ("Share this code with friends, you both earn a coupon").
- Footer: pluralized "X friends invited" count + Share button.
- Share button uses React Native's built-in `Share` API (no new native dep — `expo-clipboard` is NOT installed and not needed; iOS's share sheet includes "Copy to clipboard" natively).
- Translations under `referral.*` with `_plural` variant for invitedCount.

### Admin UI

**Web** `web/app/admin/referrals/page.tsx` + `ReferralsClient.tsx`:
- New "Referrals" entry in the Settings group of the admin sidebar.
- Server-side: fetches settings + lists currently-active coupons + counts profiles with `referred_by NOT NULL` (total links stat).
- Client-side: toggle for `is_active`, segmented control for `reward_type` (`coupon` | `none`; `points` deferred), `<select>` dropdown of active coupons keyed by id. Each interaction does an immediate update with optimistic UI + rollback on error.

**Mobile** `mobile/app/admin/referrals.tsx`:
- New gift-icon entry in the admin dashboard header.
- Mirrors the web functionality: stat card, active toggle, reward-type segmented control, coupon picker via `Alert.alert` action sheet listing every active coupon by title + place name.

### Files touched / created
- `supabase/migrations/017_referral_signup_flow.sql` (new, applied)
- `mobile/hooks/useReferrals.ts` (new)
- `mobile/app/auth/login.tsx` (referral input + auth metadata)
- `mobile/app/(tabs)/profile.tsx` (referral card)
- `mobile/app/admin/index.tsx` (sidebar gift icon)
- `mobile/app/admin/referrals.tsx` (new screen)
- `mobile/locales/{fr,en}.json` (referral.* + auth.referralCode strings)
- `web/app/admin/layout.tsx` (sidebar nav entry)
- `web/app/admin/referrals/page.tsx` (new)
- `web/app/admin/referrals/ReferralsClient.tsx` (new)
- `docs/PLAN.md` (this entry)

### tsc

Both mobile + web `npx tsc --noEmit` clean (modulo pre-existing `@expo/vector-icons` warning, unrelated).

### What changes for the next session
- A signup with a valid referral code automatically issues a coupon redemption row to BOTH parties. The reward shows up next time either user opens the referenced coupon's place page — `useStartRedemption` returns the existing unredeemed row, the user just shows the QR.
- The trigger silently ignores invalid codes — the signup never fails on a bad referral. This is intentional: error UX on signup is risky. If we want to validate inline later, `checkReferralCodeExists` is exported.
- If the admin picks a reward coupon that later expires, signups that happen after expiry simply won't issue rewards (the trigger checks `expires_at > now()`).
- Points-based rewards are deferred. If/when added, extend the trigger's reward issuance branch and the admin segmented control (and add a `user_points` table).

### What's left in the original 12-step plan
- Step 9: Stats screen (views count) for Standard+
- Step 10: Competition trends + scheduled aggregator
- Step 11: Renewals admin filter + expiring stat cards
- Step 12: Moderation toggle UI

Pre-launch (still pending): Gabon bounds re-enable, PRD 7.1 Share button, 7.2 Maps choice sheet, 7.4 Onboarding, Phase 6 (app icon, splash, EAS Build, store submission).

---

## 2026-05-10 (cont.) — Step 8 rework: welcome credit + multi-item redemption session

Founder pushed back on Step 8 as originally shipped — the place-specific coupon reward was awkward (new user signs up, "your reward is at restaurant X you've never heard of"). Right answer was a platform-wide welcome credit. Also raised that the scanner was becoming a primary owner workflow but only supported one coupon at a time; a customer paying a single bill should be able to have all their things (coupons + credit) redeemed in one session.

Both shipped end-to-end this session. Welcome credit is now the default referral reward, the scanner is a session/cart that locks to one customer, and redemption is atomic via a Postgres RPC. The coupon-as-reward path is kept for admins who prefer it but it's no longer the recommended choice.

### Migration 018 (applied via MCP)

`supabase/migrations/018_welcome_credit_and_session_redeem.sql`:
- **`credit_balances`** (user_id PK, balance_fcfa, lifetime_earned, updated_at) — one row per user, balance never goes negative (CHECK).
- **`credit_transactions`** (id, user_id, delta_fcfa, reason, ref_id, created_at) — append-only audit log. `reason` is one of `referral_signup`, `referral_invite`, `redemption_session`, `admin_adjust`.
- RLS on both: users SELECT their own rows only; writes are SECURITY DEFINER through the trigger / RPC.
- `referral_settings`: dropped + recreated the `reward_type` CHECK to add `'welcome_credit'`, added `reward_credit_fcfa int` column (positive when set). Migration auto-bumps the existing row to `welcome_credit` + 1 000 FCFA default when admin hadn't already picked a coupon reward.
- `handle_new_user` extended: seeds a `credit_balances` row for every signup. If `reward_type='welcome_credit'` and the program is active, credits BOTH referrer + new user by `reward_credit_fcfa`, logs two `credit_transactions`. Old coupon-reward branch retained as alternate path.
- Backfill: insert a 0-balance row for every existing profile.
- **`apply_redemption_session(p_user_id, p_redemption_ids[], p_credit_to_use, p_bill_amount, p_place_id)`** — SECURITY DEFINER RPC, GRANT EXECUTE to `authenticated`. Atomic checkout:
  1. Verifies caller is the place owner or an admin.
  2. Locks every queued redemption `FOR UPDATE`, asserts they belong to `p_user_id`, are unredeemed, belong to coupons that are active + within their date window, and belong to `p_place_id`.
  3. Splits `p_bill_amount` evenly across queued coupons; computes per-row discount from `discount_type`/`discount_value` capped at the row's share and at the remaining bill.
  4. Clamps `p_credit_to_use` to `LEAST(requested, balance, remaining_after_coupons)`, decrements `credit_balances`, logs a `credit_transactions` row.
  5. Returns a JSONB breakdown `{ bill_amount, total_discount, credit_used, customer_pays, lines: [...] }` for the client to render the success screen.
- Throws named error codes: `MIXED_CUSTOMERS`, `ALREADY_REDEEMED`, `COUPON_INACTIVE_OR_EXPIRED`, `WRONG_PLACE`, `NOT_AUTHORIZED`, `CODE_NOT_FOUND`, `INVALID_BILL`. The client maps these to localized error strings in the review modal.

### Hooks

`mobile/hooks/useCredit.ts` (new):
- `useCreditBalance()` — single row, staleTime 5s. Trigger always seeds a row, so the hook always returns one for authenticated users.
- `useCreditTransactions(limit)` — paginated history. Not surfaced in the main profile UI yet but available for transparency / debugging.

`mobile/hooks/useCouponRedemption.ts` (heavily extended):
- New QR encode/decode: `encodeCreditQrPayload({ userId })` produces `OKILI|CREDIT|1|<userId>`. `decodeScanPayload` now returns a discriminated union (`'coupon'` or `'credit'`). Legacy `decodeQrPayload` kept as a thin wrapper for any caller that only cares about coupons.
- `REDEMPTION_ERRORS` expanded with the new RPC error keys (`MIXED_CUSTOMERS`, `WRONG_PLACE`, `NOT_AUTHORIZED`, `INVALID_BILL`).
- `useMyCoupons()` — every unredeemed `coupon_redemptions` row for the current user, joined with coupon + place data. Powers the new "My coupons" section on profile. Closes the discoverability gap from the original Step 8 design.
- `fetchCouponScanDetails` / `fetchCreditScanDetails` — async, non-hook helpers the scanner calls per scan to validate and pull metadata before adding to the session.
- `useApplyRedemptionSession()` — wraps the RPC call, invalidates `credit-balance`, `my-coupons`, `redemption*`, `coupon-usage` queries on success.
- Removed the old `useRedeemCode` + `useScanContext` hooks — no consumers remain since the scanner now handles the whole session itself.

`mobile/hooks/useReferrals.ts`:
- `ReferralSettings.reward_type` extended to `'welcome_credit' | 'coupon' | 'points' | 'none'`.
- `reward_credit_fcfa: number | null` added.

### Scanner rewrite — `mobile/app/restaurant-admin/scanner.tsx`

Completely new component. No more one-shot scan + modal handoff to the coupons page.

- Camera stays open across scans. Each scan calls `fetchCouponScanDetails` or `fetchCreditScanDetails` and either:
  - Adds the item to the session if valid + customer matches.
  - Shows a transient red toast (`scanErrorToast`) explaining why it was rejected (different customer / wrong place / already redeemed / inactive). Toast dismissible by tap.
- Session state locks to the first customer's `user_id`. Subsequent scans must match. Coupon items dedup by `redemptionId`; credit items refresh balance silently if rescanned.
- Bottom sheet shows the customer's name/email + horizontal scrollable chip row of queued items (each removable). Big orange **Review & apply (N)** CTA opens the embedded review modal.
- Review modal: customer card, per-coupon discount preview (with live calculation), optional credit-amount input (defaults to "use max available"), running `Discount −X · Credit −Y · Customer pays Z`. **Apply all** calls the RPC; success swaps the modal into a checkmark+summary state; **Done** resets everything and pops back.
- Inline `KeyboardAvoidingView` + `ScrollView` so the modal remains usable when the keyboard is up.
- Old `ScanResultModal.tsx` deleted; old `coupons.tsx` route-param handoff stripped.

### Profile screen — `mobile/app/(tabs)/profile.tsx`

- Wrapped body in a `ScrollView` (the screen now holds enough content that it overflows).
- **Welcome credit card**: large orange balance, friendly hint ("Spend it at any O'Kili restaurant"), primary button = **Mon QR de crédit** which opens a modal showing the user's credit QR + balance + "show this at checkout" instruction. Secondary button = **Share my code** (kept the existing system Share API for the referral message). Footer line: `Code: ABC23XYZ · 2 friends invited`. Replaces the old referral-only card.
- **My coupons section**: every unredeemed coupon the user holds. Each card has a place-name eyebrow + coupon title + discount pill + expiry; tap → `/place/{placeId}` where the existing CouponsBlock handles the QR flow. Only rendered when the user has at least one — no empty state taking up space.
- **Owner section** gains a new prominent **Scan a coupon** row above "Manage my restaurant", with a `scan` icon and a subtitle explaining it validates customer coupons and credits. Lets owners reach the scanner from anywhere in the app, not just `/restaurant-admin/coupons`.
- Credit QR modal uses `react-native-qrcode-svg` (already a dep from Step 7).

### Admin referral settings

Both surfaces now show three reward-type options: **Welcome credit (FCFA)** (recommended), **Coupon at a place**, **No reward (track only)**. Points-based is still post-MVP.

- **Web** (`web/app/admin/referrals/ReferralsClient.tsx`): three-button segmented control. When **Welcome credit** is selected, an FCFA amount input appears with debounced save on blur. When **Coupon** is selected, the existing coupon picker shows. Switching reward type nulls the other field on save.
- **Mobile** (`mobile/app/admin/referrals.tsx`): same three-button row + FCFA `TextInput` + the existing Alert.alert coupon picker. Same defaults (1 000 FCFA when switching to credit, null otherwise).

### Types

Mobile `database.types.ts` updated:
- `coupons` row: gained `max_total_redemptions`, `discount_type`, `discount_value` (from migration 016, already present).
- `coupon_redemptions` row: gained `bill_amount`, `discount_applied` (already present).
- `referral_settings.reward_type` widened to include `'welcome_credit'`; `reward_credit_fcfa` field added.
- `credit_balances` + `credit_transactions` tables defined.
- `Functions.apply_redemption_session` typed with Args + Returns matching the RPC's JSONB shape.
- `cp`'d to `web/lib/database.types.ts` so both apps stay in sync.

### tsc

Mobile + web `npx tsc --noEmit` both clean (modulo the pre-existing `@expo/vector-icons` resolver warning).

### Files touched / created
- `supabase/migrations/018_welcome_credit_and_session_redeem.sql` (new, applied)
- `mobile/lib/database.types.ts` + `web/lib/database.types.ts` (synced)
- `mobile/hooks/useCredit.ts` (new)
- `mobile/hooks/useCouponRedemption.ts` (extended; removed old single-coupon helpers)
- `mobile/hooks/useReferrals.ts` (widened types)
- `mobile/app/restaurant-admin/scanner.tsx` (full rewrite — session/cart with embedded review modal)
- `mobile/app/restaurant-admin/coupons.tsx` (stripped ScanResultModal wiring)
- `mobile/components/restaurant-admin/ScanResultModal.tsx` (deleted)
- `mobile/app/(tabs)/profile.tsx` (credit card, My coupons section, owner scan entry, credit QR modal, wrapped in ScrollView)
- `mobile/app/admin/referrals.tsx` (welcome_credit + FCFA input)
- `web/app/admin/referrals/ReferralsClient.tsx` (welcome_credit + FCFA input)
- `web/app/admin/referrals/page.tsx` (defaults patched for new field)
- `docs/PLAN.md` (this entry)

### What changes for the next session
- The default referral reward is now `welcome_credit` (1 000 FCFA each side). Admin can switch to `coupon` if they want a partner-promo style reward, but credits are the recommended path for the small-restaurant guide app.
- A new user with a valid referral code gets credit on signup → it appears on their profile immediately. They show their credit QR at any participating restaurant; the owner scans it during checkout. The reward is no longer tied to one specific place.
- `useRedeemCode` is gone. All single + multi-item redemptions now go through `useApplyRedemptionSession` → `apply_redemption_session` RPC. The RPC is the single source of truth for "finalize a checkout" — owners cannot bypass quotas, place authorization, customer locking, or credit balance limits from the client.
- The scanner is now reached from BOTH `/restaurant-admin/coupons` (header scan button, existing) AND the Profile tab (owner-only "Scan a coupon" row, new). Both push to `/restaurant-admin/scanner`.
- The credit QR encodes only the user's id (`OKILI|CREDIT|1|<uuid>`). Anyone with that QR can let an owner pull the user's credit balance into their checkout session — but the actual deduction still requires the owner to authenticate + own the place. There is no other security concern: the user_id alone is not enough to do anything bypassing the RPC's checks.
- For analytics later: `credit_transactions` is the audit trail. Sum positives = earnings, sum negatives = spends. `reason` field tells you why each row exists. Useful when we build the renewals/stats screens (Step 9 / 11).

---

## 2026-05-12 — Activity surfaces: user / owner / admin transparency

Founder raised that the data was all being tracked but **nothing was visible to anyone**. The DB had complete audit trails (`credit_transactions`, `coupon_redemptions`) but none of the three roles could actually see their own history. He's right — a credit/discount system without transparent activity is broken trust.

Shipped three new feeds + admin analytics + one tiny schema add, end-to-end.

### Migration 019 (applied)

`supabase/migrations/019_credit_tx_place_link.sql`:
- Added `credit_transactions.place_id uuid REFERENCES places ON DELETE SET NULL`. Partial index `credit_transactions_place_idx ... WHERE place_id IS NOT NULL`.
- Updated `apply_redemption_session` RPC to pass `p_place_id` through into the `credit_transactions` row it inserts on credit deduction. Now owners can query "all credit spent at my place" by a single `place_id` filter rather than deriving it from timestamps.

### Hooks (new — `mobile/hooks/useActivity.ts`)

Four hooks, all React Query-backed:
- `useUserActivity(limit)` — merges the current user's `credit_transactions` + their redeemed `coupon_redemptions` into one chronological feed. Resolves referrer/referee names for `referral_invite` rows via a follow-up `IN` lookup.
- `useOwnerActivity(placeId, limit)` — for a given place, merges `coupon_redemptions` where the joined coupon belongs to that place + `credit_transactions` with `place_id = X AND reason = 'redemption_session'`. Joined with the customer's profile (full_name + email).
- `useReferralAnalytics()` — totals: credit issued (sum of positive deltas), credit spent (abs sum of negative deltas), outstanding (sum of `credit_balances.balance_fcfa`), total referral links. Plus top-10 referrers ranked by count, name + email + their referral_code.
- `useAdminActivity(limit)` — same shape as user activity but cross-platform, joined with the actor's profile name/email + the place. Powers the global admin feed.

All four use sensible `staleTime`s (5s for user/owner, 10–30s for admin) so navigation between screens doesn't refetch unnecessarily.

### User-side — Profile activity

`mobile/app/account/activity.tsx` (new):
- Top stat card: current credit balance + "Lifetime earned" sub-line.
- Chronological feed with per-event icon, title, subtitle, amount, timestamp. Five event kinds (welcome gift / invite reward / admin adjust / credit spend / coupon redemption), each with its own copy, icon, and amount tinting.
- Tap any row that has a `placeId` → navigate to that place's detail page.
- Empty state explains what'll show up.

`mobile/app/(tabs)/profile.tsx`: added a discreet "Voir mon activité / View my activity" link inside the welcome-credit card. Routes to `/account/activity`.

### Owner-side — Restaurant-admin history

`mobile/app/restaurant-admin/history.tsx` (new):
- Period filter chips: Today / 7 days / 30 days / All.
- Aggregate strip when the filter has results: Transactions count · Total discounts · Total credit used.
- Per-row entries: customer name + email, coupon title (or "Credit used"), bill share, discount applied (or credit amount), timestamp. Icons + tints separate coupon redemptions from credit deductions.
- Owner gets a clean revenue picture: every coupon-driven discount AND every credit deduction at their place, in one feed.

`mobile/app/restaurant-admin/index.tsx`: added a **Historique / History** tile in the Actions section (open to all tiers — it's basic transparency, not a paid feature).

### Admin — full visibility on `/admin/referrals` + new `/admin/activity`

**Web `/admin/referrals` (`page.tsx`):**
- 4 hero stat cards on top: Referral links · Credit issued · Credit spent · Outstanding.
- 2-column layout: settings (existing client component) on the left 2/3, **Top referrers** ranked list on the right 1/3.
- Below: **Recent credit activity** table — 15 most recent credit transactions, with user, reason, place, amount, timestamp. "View all →" link to the full activity page.

**Web `/admin/activity` (new `page.tsx`):**
- Full searchable timeline: pulls the last 200 credit_transactions + the last 200 redeemed coupon_redemptions, merges client-side.
- Filter chips: All / Credit movements / Coupon redemptions.
- Search box: filters by user / place / coupon title (substring match, case-insensitive).
- Table: kind badge, user, event label, place, amount (green for credit earn, orange for spend/coupon), timestamp.
- Sidebar nav entry added in `web/app/admin/layout.tsx` under the "Général" group.

**Mobile `/admin/referrals` (`mobile/app/admin/referrals.tsx`):**
- 2×2 grid of mini-stat cards mirroring the web hero (Links / Credit issued / Credit spent / Outstanding).
- Top referrers card with rank pill + name + email + count.
- "Voir l'activité complète" link to `/admin/activity`.

**Mobile `/admin/activity` (new):**
- Same filter chips + search input as web.
- Compact rows: tint + icon, title, customer/place subtitle, timestamp, amount.
- Reachable from `/admin` dashboard header (new clock icon, added alongside the gift / settings / users icons).

### tsc

Both `npx tsc --noEmit` runs clean (modulo the pre-existing `@expo/vector-icons` warning).

### Files touched / created
- `supabase/migrations/019_credit_tx_place_link.sql` (new, applied)
- `mobile/lib/database.types.ts` + `web/lib/database.types.ts` (synced — added `place_id` to `credit_transactions`)
- `mobile/hooks/useActivity.ts` (new — four hooks)
- `mobile/app/account/activity.tsx` (new)
- `mobile/app/(tabs)/profile.tsx` (added activity link inside the credit card)
- `mobile/app/restaurant-admin/history.tsx` (new)
- `mobile/app/restaurant-admin/index.tsx` (added History tile)
- `mobile/app/admin/referrals.tsx` (stats grid, top referrers list, full-activity link)
- `mobile/app/admin/activity.tsx` (new)
- `mobile/app/admin/index.tsx` (clock-icon header button)
- `web/app/admin/referrals/page.tsx` (4-card hero, top referrers, recent activity table)
- `web/app/admin/activity/page.tsx` (new)
- `web/app/admin/layout.tsx` (Activity sidebar entry)
- `docs/PLAN.md` (this entry)

### What changes for the next session
- The trio (user / owner / admin) now sees everything. No more "the data is there but nowhere to look at it."
- All new feeds are read-only and React-Query cached. No new write paths beyond the RPC update in migration 019.
- Search on `/admin/activity` is client-side substring match across user/place/coupon. Fine for the current data volume; if rows blow past a few thousand, paginate or move to a Postgres `ilike` query with proper indexes.
- The user-side activity hook merges streams client-side and caps at `limit` rows. If a user has a lot of activity, "Load more" pagination is a small follow-up but not urgent.
- `credit_transactions.place_id` is set for `redemption_session` reason; null for `referral_signup` / `referral_invite` / `admin_adjust`. Owner-side filter relies on that.

---

## 2026-05-12 (cont.) — Platform coupons + admin coupons UI at scale

Founder pointed out two real gaps:
1. Admins should be able to create coupons that are **not** tied to a single restaurant — global promos (Christmas / launch / holiday), and "valid at this subset of partners" promos.
2. The admin coupons UI was built for ~tens of rows; at 500 it falls apart, especially on mobile.

Shipped both end-to-end. No business-model enforcement (who funds the discount stays a real-world arrangement between admin + restaurants); the code just records the discount applied.

### Migration 020 + 020b (applied)

`supabase/migrations/020_platform_coupons.sql`:
- `coupons.place_id` now nullable. `NULL` = platform coupon.
- New `coupon_places (coupon_id, place_id, created_at)` join table. Empty for a platform coupon = "valid everywhere"; rows = "valid at this subset."
- RLS on `coupon_places`: public read (so place-detail pages can render the right ones), admin-only write.
- Existing `coupons` RLS already handles the new case correctly: the owner-side check requires `places.owner_id = auth.uid()`, which fails when `place_id IS NULL`, so platform coupons are effectively admin-only by construction.

`supabase/migrations/020b_redeem_session_accepts_platform_coupons.sql`:
- Updated `apply_redemption_session` RPC place-match logic:
  - `coupon.place_id IS NOT NULL` → must equal `p_place_id` (existing single-place case).
  - `coupon.place_id IS NULL` → valid if no `coupon_places` rows exist OR a matching `coupon_places` row exists for `p_place_id`. Otherwise throws `WRONG_PLACE`.
- Everything else (quotas / active / expiry / authz / credit / bill math) unchanged.

### Types

Mobile `database.types.ts` (synced to web):
- `coupons.place_id: string | null`.
- Added `coupon_places` table type.

### Hooks

`mobile/hooks/useCoupons.ts`:
- `Coupon.place_id` is now nullable. Comment clarifies what the null means.
- `useActiveCouponsForPlace` now merges per-place coupons with platform coupons. Two parallel queries — place-tied + platform — then for the platform set we resolve scope from `coupon_places` and keep only the ones valid at that place (no rows = everywhere; rows = check membership).
- New `useAdminCoupons({ page, perPage, search, filter })` — paginated cross-place query, server-side filter chips (`all` / `live` / `inactive` / `expired` / `platform`), server-side title `ilike` search + client-side place-name search. Returns `{ rows, totalCount, hasMore }` plus per-coupon `scopeKind` (single | platform_all | platform_subset) and redemption counts.
- `useCreatePlatformCoupon` mutation — inserts with `place_id = null`, then bulk-inserts `coupon_places` if scope is "subset." Rolls back the parent row if scope insertion fails.
- `useDeletePlatformCoupon`, `useAllPlacesLite` helpers.

`mobile/hooks/useCouponRedemption.ts`:
- `useMyCoupons` now left-joins the place (`places ( id, name )` without `!inner`) so platform coupons surface for the user. The returned `MyCouponEntry` gains `isPlatform` boolean, `placeId` / `placeName` are nullable.

### Mobile admin

New `mobile/app/admin/coupons/index.tsx`:
- Header with **+** button → `/admin/coupons/new`.
- Filter chips (All / Live / Platform / Inactive / Expired) + search input. Both reset to page 0 when changed.
- Cards show the discount pill, scope label (place name / "Tous les restaurants" / "N restaurants"), status pill, expiry, used / generated counts. Platform coupons rendered with a violet globe icon to visually separate them from owner coupons.
- Trash button only on platform coupons (admin-managed); owner coupons have to be managed from the owner side.
- Prev/Next paginator at 25 per page.

New `mobile/app/admin/coupons/new.tsx`:
- Form: FR + EN titles, details, expiry (with +1w / +1m / +3m quick chips), per-customer limit, total quota, discount type (None / % / FCFA) + value, scope toggle (All / Selected). Selected mode shows a searchable multi-select of every place.
- Validates: title required, expiry future, % between 1-100, scope-subset requires at least one place.

`mobile/app/admin/index.tsx`: new ticket icon in the header opens `/admin/coupons`.

`mobile/app/admin/referrals.tsx`: replaced the `Alert.alert` reward-coupon picker with a proper `<Modal presentationStyle="pageSheet">` containing a search box + scrollable list + "No reward" option + "Selected" highlight. `Alert.alert` breaks past ~10 entries on iOS; the modal scales to hundreds.

### Mobile end-user

`mobile/components/place/CouponsBlock.tsx`:
- Platform coupons render with a violet left-border + violet eyebrow label "**Promo O'Kili**" instead of orange "Coupon" + a globe icon. Discount pill also flips to violet. Makes the distinction obvious to users who aren't familiar with the underlying model.

`mobile/app/(tabs)/profile.tsx`:
- "My coupons" cards handle `isPlatform === true` rows: header label is "Promo O'Kili" instead of a place name; meta line says "Valid at any restaurant"; tap on the card is a no-op when there's no specific place to route to. Chevron is hidden in that case.

### Web admin

`web/app/admin/coupons/page.tsx` (rewritten):
- Pagination (25 per page, prev/next with disabled states + total count).
- Server-side title search via `ilike` + client-side place-name post-filter.
- New "Platform" filter chip.
- New "+ New platform coupon" CTA top-right → `/admin/coupons/new`.
- Scope column visually distinguishes single-place coupons (linked place name) from platform-all and platform-subset variants (violet pill).
- URL state preserved via search params so navigation back retains filter + page.

New `web/app/admin/coupons/new/page.tsx` + `NewCouponClient.tsx`:
- Server component loads every undeleted place once; passes to a client form.
- Client form mirrors the mobile flow: titles, details, expiry, quotas, discount, scope toggle, place multi-select (searchable). Rollback-on-error logic for scope inserts.

### tsc

Both `npx tsc --noEmit` runs clean.

### Files touched / created
- `supabase/migrations/020_platform_coupons.sql` (new, applied)
- `supabase/migrations/020b_redeem_session_accepts_platform_coupons.sql` (new, applied)
- `mobile/lib/database.types.ts` + `web/lib/database.types.ts` (synced)
- `mobile/hooks/useCoupons.ts` (platform-aware list + admin hooks)
- `mobile/hooks/useCouponRedemption.ts` (left-join, `isPlatform` in MyCouponEntry)
- `mobile/app/admin/coupons/index.tsx` (new)
- `mobile/app/admin/coupons/new.tsx` (new)
- `mobile/app/admin/index.tsx` (added Coupons header icon)
- `mobile/app/admin/referrals.tsx` (modal-based coupon picker)
- `mobile/app/(tabs)/profile.tsx` (platform-coupon handling in My Coupons)
- `mobile/components/place/CouponsBlock.tsx` (violet platform badge)
- `web/app/admin/coupons/page.tsx` (rewritten with pagination + search + scope)
- `web/app/admin/coupons/new/page.tsx` (new)
- `web/app/admin/coupons/new/NewCouponClient.tsx` (new)
- `docs/PLAN.md` (this entry)

### What changes for the next session
- The admin can now publish promos that aren't tied to one restaurant. They show up automatically on every place's detail page that's in scope, side-by-side with the place's own coupons, marked visually as "Promo O'Kili."
- The reward-coupon picker on `/admin/referrals` no longer breaks at scale.
- `/admin/coupons` (web + mobile) is now ready for hundreds of coupons. Same pagination + search treatment should be applied to `/admin/activity` and the existing `/admin/users` next time someone scales them — same pattern.
- Place owners cannot edit or delete platform coupons (enforced by RLS via the existing owner-or-admin policy — the owner check requires the joined place row, which doesn't exist for `place_id IS NULL`).
- Business model is still a real-world decision: who absorbs the discount on a platform coupon (the platform via reimbursement, or partner restaurants who agreed up front) is not enforced in code. The RPC simply records the discount applied — accounting lives elsewhere.

---

## 2026-05-13 — Handoff: end of long session

Long session approaching context limit. This entry hands the work over to a fresh chat so the next session can pick up cleanly from git.

### Tell the next session
The project is at `/Users/roch/Desktop/Gabon-guide`, branch `dev`, latest commit `3776ad4` on `origin/dev`. Read this PLAN.md from the bottom up — the last ~five session entries cover everything from coupons quota (Step 7+) through platform coupons + admin UI scaling. Nothing important lives only in chat; everything is in git.

### Commits since the last handoff (2026-05-10 → 2026-05-13)
- `75b1f0a` Coupons quotas + welcome credit + activity surfaces (migrations 016 → 019)
- `77f4cef` Platform coupons + admin coupons UI at scale (migrations 020 + 020b)
- `888cafd` Admin UI fixes: decluttered Places header, fixed Publish-button overlap on new coupon page, fixed filter chips that were rendering as 600pt-tall vertical capsules
- `3776ad4` Fix PostgREST PGRST201 ambiguity on `coupons` ↔ `places` after migration 020 — six query sites updated to use explicit FK names

All five new migrations (016 / 017 / 018 / 019 / 020 / 020b) are **applied to the live Supabase project** (`fvmzsxmlpwvtnszmuowc`) via the MCP `apply_migration` tool. The next session does NOT need to re-apply anything.

### Current functional state

**Working + verified by the founder on the iPhone build:**
- Coupon QR scanning (after the native `ExpoCameraBarcodeScanning` pod was added in earlier session).
- Coupon redemption with quotas, discount math, bill capture — single-coupon flow.
- Welcome credit signup + balance display.
- Profile screen layout (credit card, My coupons section, Activity link).
- Admin Places page (decluttered header).
- Admin coupons list (after the PGRST201 fix in `3776ad4`).

**In the code + DB but NOT yet end-to-end verified by founder:**
- **Multi-item session scanner** — owner scans coupon QR + credit QR for same customer → atomic Apply All. Needs founder to actually do a multi-scan to confirm.
- **Platform coupon creation** from the new `/admin/coupons/new` page (web + mobile). Needs founder to create one and verify it appears on the right place(s) detail page(s).
- **Platform coupon redemption** — when the customer redeems a platform coupon at a place, the RPC's place-match logic kicks in. The RPC update is `apply_redemption_session` from `020b`.
- **Activity feeds** — `/account/activity` (user), `/restaurant-admin/history` (owner), `/admin/activity` + `/admin/referrals` analytics (admin). All wired but the founder hasn't sat down and clicked through them in order.
- **My coupons** section on Profile — listing every unredeemed coupon. Should now correctly include platform coupons (place is left-joined).

### Critical things to know about the code

These are non-obvious if the next session re-reads the code cold:

1. **Coupon redemption goes through `apply_redemption_session` RPC.** The old `useRedeemCode` + `useScanContext` hooks were deleted. `useApplyRedemptionSession` is the only client entry point now. The RPC is in migration `020b` — its body lives at `supabase/migrations/020b_redeem_session_accepts_platform_coupons.sql`.

2. **`useUserRedemption` only returns UNREDEEMED rows.** Anyone reading "is this coupon ever redeemed by me?" needs `useLastUserRedemption` or `useCouponUsage`. Don't rely on `useUserRedemption.data?.redeemed_at` — it's always null.

3. **PostgREST coupons ↔ places ambiguity.** Migration 020 added `coupon_places`, creating a second FK path from `coupons` to `places`. Every embedded join from `coupons` to `places` MUST use the explicit FK name: `places!coupons_place_id_fkey(...)`. The six existing sites are fixed in commit `3776ad4` — but any NEW query that joins these tables will hit `PGRST201` if the FK isn't named.

4. **Admin home is Profile → Admin section, not the Places page.** I refactored this session: the Places-management page (`/admin`) is now only about places — back, title, Users icon (for quick owner assignment), `+` for new place. Every other admin domain (Coupons, Activity, Referrals, Tier settings, Users) is a labeled row in Profile → Admin. If you need to add a new admin domain, append a row there; do NOT add an icon to the Places page header.

5. **Scanner is a session/cart, not one-shot.** `mobile/app/restaurant-admin/scanner.tsx` queues items in a locked-to-one-customer session and finalizes via the RPC. The QR decoder `decodeScanPayload` returns a tagged union (`{ kind: 'coupon' }` or `{ kind: 'credit' }`).

6. **Welcome credit QR encodes only the user_id** as `OKILI|CREDIT|1|<uuid>`. The user_id alone has no power without authenticated owner + RPC check, so the QR is safe to share publicly.

7. **Welcome credit is the DEFAULT referral reward.** Migration 018 bumped existing `referral_settings` to `reward_type='welcome_credit'`, 1 000 FCFA each side. Coupon-based rewards still work (admin can switch) but are not the default.

8. **Native deps haven't moved since 2026-05-10.** `expo-camera` 55.0.18 + `ExpoCameraBarcodeScanning` pod + `ZXingObjC` with `:modular_headers => true`. The config plugin `mobile/plugins/withExpoCameraBarcodeScanning.js` keeps the pod linked across `expo prebuild` runs. If a fresh prebuild is ever needed, the plugin auto-injects the pod into the regenerated Podfile.

9. **`mobile/ios/` is gitignored.** Native rebuilds happen on the founder's Mac. Don't expect to find `Podfile.lock` or anything iOS-build-state in git. JS reloads on Metro are enough for almost everything we've shipped since the pod install.

### Open issues / observations to keep in mind

- **React Query hooks silently swallow errors in the UI.** The PGRST201 bug looked like "no data" because the hooks throw but the UI only checks `isLoading` + `rows.length === 0`. Worth adding a tiny error banner on the admin lists (`/admin/coupons`, `/admin/activity`, `/admin/referrals`) so the next failure is loud. Not blocking — 30 min of cleanup whenever.
- **Activity feeds aren't paginated.** They cap at 50 / 200 rows. Fine at MVP scale; need pagination if a single user or place exceeds those limits. Same client-side merge pattern — would need a "Load more" cursor.
- **Quota checks are still client-side in `useStartRedemption`.** Two devices simultaneously hitting the last quota slot could race. The RPC `apply_redemption_session` enforces them server-side at redemption time, so it's not a money/correctness bug — just an "occasional one-extra-QR-generated" edge case.

### What to do next, in order

1. **Founder finishes testing what was shipped this session.** A clean walkthrough:
   - Admin (web): `/admin/coupons` should now populate with real coupons. Create a platform coupon with "All restaurants" scope, then with "Selected restaurants" scope. Both should show up on the appropriate place detail pages.
   - User (simulator): open a place that has the platform coupon → see it labeled "Promo O'Kili" in violet, alongside the place's own coupons.
   - Owner (iPhone): scan a customer's credit QR + a coupon QR in the same session → Review → Apply All → verify credit balance drops + coupon row marked redeemed.
   - Verify the three activity feeds (`/account/activity`, `/restaurant-admin/history`, `/admin/activity`) reflect all the new events with correct timestamps + amounts.
2. **Then pivot to pre-launch.** Remaining from the original PRD:
   - Re-enable Gabon bounding box check in `mobile/components/admin/PlaceForm.tsx` + `web/components/PlaceForm.tsx` (search for `TODO (pre-launch)`).
   - PRD 7.1 Share button on the place detail page (Branch.io smart links — plumbing is in `mobile/app/place/[id].tsx`).
   - PRD 7.2 Apple/Google Maps choice sheet (most logic already exists in `mobile/app/place/[id].tsx`'s map button).
   - PRD 7.4 Onboarding flow for first-time users.
   - Phase 6: app icon, splash screen, EAS Build setup, App Store + Play Store submission paperwork.
3. **Defer until post-launch:** Step 9 (stats screen — needs real user data), Step 10 (competition trends — same), Step 11 (renewals admin filter — small, do whenever), Step 12 (moderation toggle UI — small, do whenever).

### Useful pointers
- Memory at `/Users/roch/.claude/projects/-Users-roch-Desktop-Gabon-guide/memory/`:
  - `project_prelaunce_checklist.md` (Gabon bounds re-enable)
  - `project_architecture_decisions.md` (10 entries pre-dating this work)
  - `feedback_dont_propose_lesser_option.md` (don't dress up the easier-to-build option as "MVP pragmatism")
- Supabase project ID: `fvmzsxmlpwvtnszmuowc`. MCP tools work — list migrations via `mcp__claude_ai_Supabase__list_migrations`, apply via `apply_migration`, query via `execute_sql`.
- Metro ports: 8081 is held by founder's other voice-expense project. This project uses 8082 / 8083 / 8084. Expo will prompt for the port; accept the suggested alternative.
- The iPhone test device is "Senyo iPhone" (bundle ID `com.rapetoh.okili` per the dev profile workaround; pre-launch will need to revert to `com.okili.app` per `2026-05-10` handoff section).

Good luck. Everything is in git. Open the next session, point it at `/Users/roch/Desktop/Gabon-guide`, tell it to read `docs/PLAN.md` from the bottom up, and it should pick up exactly where this one left off.


---

## 2026-07-17 — Handoff: full-ownership mandate for the next session

Read this file bottom-up plus `docs/VERIFICATION_2026-07-12.md`, `docs/LOGIC_AUDIT.md`, and the memory files at `/Users/roch/.claude/projects/-Users-roch-Desktop-Gabon-guide/memory/` (MEMORY.md is the index — the feedback files are working agreements, follow them strictly: plain language, full ownership, no A/B menus when the answer is known, dev servers only in the founder's VS Code terminal via `.vscode/tasks.json`).

### The mandate (founder, 2026-07-17, verbatim intent)
The founder holds this agent 100% accountable for the project's success and will do nothing himself except device testing and credential typing. Execute, in order:

1. **Commit the 4 pending files** on `dev` (role-badge profile card, admin users avatars, admin places thumbnails, migration file `035_admin_users_list_avatar.sql` — already APPLIED to live DB).
2. **TestFlight build #6**: `cd mobile && npx eas-cli build --platform ios --profile production` then `npx eas-cli submit -p ios --latest` (pipeline facts in memory "Architecture decisions" #12; runs without Apple login; run in founder's visible terminal).
3. **Deploy the web admin** (never deployed): Vercel + 2 env vars from `web/.env.local` + add prod callback URL to Supabase Auth redirect list.
4. **In-app notifications, end-to-end** (founder-mandated): `notifications` table + triggers on coupon-redeemed / credit-applied / referral-credit / review-reply → inbox screen + unread badge on mobile + mark-read. Build as ONE system with push (audit's closing note).
5. **Push notifications, end-to-end**: expo-notifications, `push_tokens` table, `send_push` Edge Function (Expo Push API), fired by the same triggers as #4.
6. **Owner metrics dashboard, end-to-end** (founder-mandated): `place_events` table written by the app (view / WhatsApp tap / call tap), daily aggregate, "last 7 days" card on `restaurant-admin` home (audit 4.4).
7. **Sentry** on mobile + web.
8. **Server-side guards**: publish-requires-photo trigger, tier-limit triggers on photos/coupons, re-enable Gabon bounds in both PlaceForms (memory: pre-launch checklist).
9. **Privacy policy page** (Apple requires a URL) + store-listing prep.
10. **Small bugs**: i18n choice not persisting across restarts; onboarding preferences never written (audit 10.1, 6.3).

**Explicitly deferred by founder (do NOT build):** payments, owner claim flow, tier-expiry cron, help screen, admin-portal French, and everything else in the audit's "Phase 2".
**Founder-only toggles (ask, don't flip):** Supabase "Confirm email" (he deferred it — item #2 in pre-launch checklist memory) + SMTP provider; leaked-password protection.

### State snapshot
- DB migrations applied through 038 (two 035s exist — `035_owner_credit_scan_lookup` from the parallel audit session + `035_admin_users_list_avatar` from this one; both live). Parallel session also shipped: server-side quotas/idempotency (036), referral cap + late claim `claim_referral_code` (037), admin tools/history protection (038), global audit doc (commit 0d879a4).
- TestFlight: build #5 live at Apple (predates ~2 weeks of UI fixes). ascAppId pinned → non-interactive submit works.
- The 2026-07-12 verification pass + fixes are in `docs/VERIFICATION_2026-07-12.md` and the memory file of the same date — read before touching auth/RLS/coupons.

### Hard-won conventions (violating these has bitten us)
- RLS: NEVER subquery `profiles` in a policy — use `is_admin()` / `is_blocked()` / SECURITY DEFINER helpers (`owner_redeemed_customer`, `owner_place_in_coupon_scope`). Policies ON profiles must not reference other RLS tables.
- Any PostgREST embed between `coupons` and `places` MUST name the FK (`places!coupons_place_id_fkey`) — else PGRST201.
- `apply_redemption_session` RPC is the only redemption write path.
- Reviewer identity comes from `profiles_public`; OAuth name/photo inherit at signup (033).
- After changing profile data in the app, invalidate React Query keys `['profile']` + `['reviews']`.
- `database.types.ts` (mobile+web) was regenerated by the parallel session — verify it includes `get_all_users_for_admin.avatar_url` (changed in 035_admin_users_list_avatar AFTER that regen; likely needs a re-gen).

### Operational rig (how to verify like these sessions did)
- Dev servers: VS Code task "Start O'Kili dev servers" (web :3000, Metro :8082). Simulator: iPhone 17 Pro, app scheme `okili://`, reconnect via `xcrun simctl openurl booted "okili://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8082"`.
- UI driving: macOS Accessibility is granted to VS Code. Use `cliclick` (installed). Map device-px (1206×2622) → screen: `x=1140.3+0.29*devx, y=124.8+0.29*devy` — VALID ONLY while the Simulator window sits at (1117,48) size 395×850; recalibrate via `screencapture -R` landmark comparison if moved (technique: two landmarks, solve scale+offset). Always `osascript activate Simulator` + sleep ≥2s before clicking (Space-switch animation swallows early clicks).
- DB tests: SQL sims in DO-blocks with `set_config('role','authenticated')` + jwt claims, ending in `RAISE EXCEPTION` (prints results AND rolls back). Throwaway accounts: `*@okili-test.local` via signup API (email auto-confirms — confirmation is OFF), always delete after.
- Supabase project `fvmzsxmlpwvtnszmuowc` via MCP tools (execute_sql / apply_migration / advisors / logs).

Everything is in git + these docs. Founder types passwords when prompted and tests on devices; the agent does everything else and verifies by driving the app, not by assuming.

---

## 2026-07-18 — Session record: mandate execution (items 1–10)

All work is on `dev`, commits 113f903..c57c0bc+. Verified means "SQL sim with rollback and/or driven on the simulator", not "code written".

### Shipped
1. **Types regen** — `get_all_users_for_admin.avatar_url` was indeed missing (handoff's suspicion); fixed in both apps.
2. **TestFlight build #9** (v1.0.0) built + submitted non-interactively. NOTE: EAS remote buildNumber ran 9→13 this session (failed attempts increment too); "build #6" in the mandate = build #9 at Apple.
3. **Web admin deployed**: https://okili-admin.vercel.app (Vercel project `okili-admin`, account `rapetoh`; NEXT_PUBLIC_SUPABASE_URL/ANON_KEY set for production+preview). Email/password login works now; **Google OAuth needs the founder to add `https://okili-admin.vercel.app/auth/callback` to Supabase Auth → URL Configuration → Redirect URLs** (no CLI/API path without a personal access token — CLI login is impossible from this harness, see memory).
4. **In-app notifications end-to-end** (migrations 039, 040): `notifications` table, RLS own-select + read_at-only update (column grants), SECURITY DEFINER triggers on coupon-redeemed / credit_transactions / review-reply. Client: bell + unread badge on home header, `/notifications` inbox, FR/EN rendered client-side from payload. **Driven on simulator: badge 1 → inbox shows row → mark-read lands in DB → badge clears.**
5. **Push, one system with in-app**: `push_tokens`, `profiles.preferred_language` (synced by app), `pushed_at` dedup; pg_net AFTER INSERT trigger → `send_push` Edge Function (deployed; Expo Push API; FR/EN server-rendered; dead-token pruning). **Server pipeline verified live** (insert → pushed_at stamped). Device delivery needs the push-capable build (below) + a real device.
6. **Owner metrics end-to-end** (041, 043): insert-only `place_events` (view/whatsapp/call), `get_place_metrics` RPC (owner/admin-gated, zero-filled 7 days, anon revoked), app logs events (real tap on simulator produced a row), "Last 7 days" cards on restaurant-admin home. Card UI still needs an eyeball with an owner login (no owned place on the simulator's account).
7. **Server guards** (042, all SQL-sim verified): publish requires ≥1 gallery photo (everyone); tier photo cap; coupons/videos tier-feature gates (admin bypass on commercial rules only). **Gabon bounds re-enabled in both PlaceForms** (test-place creation from abroad now needs a pasted Libreville link).
8. **Privacy policy live**: https://okili-admin.vercel.app/privacy (bilingual). **Store listing draft**: `docs/STORE_LISTING.md`.
9. **Sentry wired, dormant**: mobile `lib/sentry.ts` (native-module probe + `EXPO_PUBLIC_SENTRY_DSN` gate), web instrumentation files (`NEXT_PUBLIC_SENTRY_DSN` gate). Founder creates the Sentry org; then set both DSNs (EAS env + Vercel env) and rebuild/redeploy.
10. **Bug fixes**: onboarding preferences now sync to profile on first login (`useOnboardingPrefsSync` — onboarding runs pre-signup, that was the real 6.3 gap). i18n persistence was already fixed by the parallel session (6d12756).

### Push-capable build (the hard-won part)
- expo-notifications added; **first build failed**: stored provisioning profile lacked Push capability; `--non-interactive` can't regenerate it.
- **Fix that worked**: run `eas build` under a pty (expect), answer **No** to "log in to Apple account", then accept defaults — EAS reused the founder's existing Apple Push Key **423ZGLXN46** (stored on Expo servers from his other apps) and assigned it to com.okili.app. No Apple password needed.
- BUT assigning the key does NOT regenerate the provisioning profile — builds 13/14 (c8b6d15a) failed with the same missing-capability error. Profile regeneration requires the founder's Apple ID login (2FA); no automated path exists (ASC submit key doesn't cover Developer-Portal capability sync).
- **Interim ship**: expo-notifications plugin temporarily removed from app.config.js (see TODO there) so TestFlight gets ALL of tonight's features now; in-app notifications work via 60s polling. Push banners activate after the founder's one interactive build (checklist item 3).
- **expo-device is BANNED from this repo**: PostHog eagerly requires it if present in node_modules → crashes every binary built before it existed. Same class of bug: probe `requireOptionalNativeModule()` before importing any newly-added native package (see `usePushRegistration`, `lib/sentry.ts`).

### Founder checklist (in his lane: clicks + credentials + devices)
1. Supabase dashboard → Auth → URL Configuration → add `https://okili-admin.vercel.app/auth/callback` to Redirect URLs.
2. Create Sentry account + 2 projects (React Native, Next.js), paste both DSNs in chat.
3. **Push build (2 min)**: restore `'expo-notifications'` in `mobile/app.config.js` plugins (TODO comment marks the spot), run `cd mobile && npx eas-cli build -p ios --profile production` in your terminal, answer **Yes** to "log in to your Apple account" and complete 2FA. EAS regenerates the profile with the Push capability (key 423ZGLXN46 already assigned) and the build proceeds; then `npx eas-cli submit -p ios --latest`. After it's on your iPhone: accept the push prompt and have the agent fire a test notification.
4. Log in as the owner test account once to eyeball the "Last 7 days" card.
5. Review `docs/STORE_LISTING.md` wording (2 ⚠ items: age rating answer, support URL).
6. Still deferred (unchanged): payments, owner claim flow, tier-expiry cron, help screen, admin FR, email-confirmation toggle + SMTP, leaked-password protection.

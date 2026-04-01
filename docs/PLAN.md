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

### Phase 7 — QA Gate (run before marking Phase 7 complete)

- [ ] Share: share sheet appears + correct content + analytics fires
- [ ] Maps choice: all 4 map tests pass
- [ ] Menu photos: all 4 menu tests pass
- [ ] Onboarding: all 6 onboarding tests pass
- [ ] Restaurant owner role: all 6 role tests pass
- [ ] Video feed: all 18 video QA tests pass (see 7.6 above)
- [ ] No regressions: favorites, map, place detail, admin — all still work
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors

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

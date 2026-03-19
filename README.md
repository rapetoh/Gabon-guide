# O'Kili

A mobile city guide for Libreville, Gabon.
Discover restaurants, bars, and activities — curated and confirmed by the O'Kili team.

---

## Project Structure

```
okili/
├── mobile/       # React Native app (Expo) — iOS + Android
├── web/          # Next.js 16 admin dashboard
├── supabase/     # Database migrations and seed data
└── docs/         # PRD, build plan
```

---

## Current Status

| Phase | Description | Status |
|---|---|---|
| Phase 0 | Project setup, Supabase schema, auth config | ✅ Done |
| Phase 1 | Navigation, data hooks, auth (Email/Google/Apple) | ✅ Done |
| Phase 2 | Home screen, Explore, Place detail, Map, Favorites, Reviews | ✅ Done |
| Phase 3 | Mobile admin (create/edit places, photos, promotions) | ✅ Done |
| Phase 4 | Web admin dashboard | ✅ Done |
| Phase 5 | i18n audit | 🔜 Next |
| Phase 6 | Polish, App Store submission | 🔜 Upcoming |

See [docs/PLAN.md](docs/PLAN.md) for the full technical build plan and QA checklists.

---

## Prerequisites

- **Node.js** 18+
- **Expo Go** app on your iPhone (for testing the mobile app)
- A Supabase account with access to the O'Kili project

---

## 1. Clone and install

```bash
git clone <repo-url>
cd okili
```

**Mobile:**
```bash
cd mobile
npm install
```

> **Note:** If `npm install` fails with peer dependency errors, this is a known Expo SDK 55 / npm 10 conflict.
> A `.npmrc` file with `legacy-peer-deps=true` is already in `/mobile` — it should resolve automatically.
> If not, run: `npm install --legacy-peer-deps`

**Web admin:**
```bash
cd web
npm install
```

---

## 2. Environment variables

```bash
cp mobile/.env.example mobile/.env
cp web/.env.example web/.env.local
```

Fill in the values:

**`mobile/.env`**
```
EXPO_PUBLIC_SUPABASE_URL=        # Supabase project URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon/public key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY= # Google Maps API key (iOS) — see admin for this
```

> PostHog and Branch.io keys are not required yet — they are deferred to Phase 6.
> Leave `EXPO_PUBLIC_POSTHOG_KEY` and `EXPO_PUBLIC_BRANCH_KEY` empty or remove them.

**`web/.env.local`**
```
NEXT_PUBLIC_SUPABASE_URL=       # Same Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Same anon/public key
```

---

## 3. Database setup

Migrations are plain SQL files applied manually via the Supabase SQL Editor.
Go to your Supabase project → **SQL Editor** and run each file in order:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_profiles_trigger.sql
supabase/migrations/004_places_extended.sql
supabase/migrations/005_reviews.sql          # (if exists)
supabase/migrations/006_promoted_places.sql  # Adds is_promoted, promoted_label_fr/en
```

Then run the seed data:
```
supabase/seed.sql
```

This inserts the categories (Restaurant, Bar, Nightlife, Cafés, Activities) and zones (Centre-ville, Akanda, Owendo, Libreville Nord, Libreville Sud).

**Storage bucket:**
Go to Supabase → Storage → create a bucket named `place-photos` and set it to **Public**.

---

## 4. Admin account setup

After creating your account in the mobile app (sign up with Google or email):

1. Go to Supabase dashboard → **Table Editor** → `profiles`
2. Find your row by user ID (check Supabase → Authentication → Users)
3. Set `is_admin = true`
4. You now have access to the admin section in both the mobile app and the web dashboard

---

## 5. Web admin — Google Sign-In setup

The web admin login uses Google OAuth. For this to work locally:

1. Go to your Supabase project → **Authentication → URL Configuration**
2. Under **Redirect URLs**, add: `http://localhost:3000/auth/callback`
3. Save

That's all — the Google Cloud Console OAuth client was already configured for the mobile app and covers the web OAuth flow too (Supabase handles the Google redirect).

---

## 6. Run the apps

**Mobile app:**
```bash
cd mobile
npx expo start
```
Scan the QR code with the Expo Go app on your iPhone, or press `i` for iOS simulator.

**Web admin:**
```bash
cd web
npm run dev
```
Opens at `http://localhost:3000` → redirects to `/admin` → redirects to `/login` if not authenticated.

---

## 7. Run tests

```bash
cd mobile
npx jest
```

Tests cover `isOpenNow` (open/closed logic with Libreville timezone) and `formatWhatsAppNumber` (phone number normalization).

---

## Key technical notes

- **Mobile JS engine:** Hermes — `crypto.randomUUID()` is not available. Use the `uuidv4()` helper in `mobile/components/admin/PlaceForm.tsx` instead.
- **Timezone:** All open/closed calculations use Libreville time (UTC+1 / WAT), hardcoded — not the device timezone.
- **Gabon bounds check:** GPS coordinate validation that restricts to Gabon's bounding box is currently **disabled** for development. See `TODO (pre-launch)` comment in `mobile/components/admin/PlaceForm.tsx` and `web/components/PlaceForm.tsx`. Must be re-enabled before App Store submission.
- **Next.js version:** The web app uses Next.js 16. Key differences from 15: `middleware.ts` is now `proxy.ts` (export named `proxy`), `searchParams` is a Promise in server components (must be awaited).
- **Promotion / Trending Now:** Places with `is_promoted = true` appear first in the home screen "Trending Now" section with a badge. Set via the admin PlaceForm (mobile or web).

---

## Docs

- [PRD — Product Requirements](docs/PRD.md)
- [PLAN — Technical Build Plan with QA checklists](docs/PLAN.md)

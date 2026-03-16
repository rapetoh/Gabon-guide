# O'Kili

A mobile city guide for Libreville, Gabon.
Discover restaurants, bars, and activities — curated and confirmed by the O'Kili team.

---

## Project Structure

```
okili/
├── mobile/       # React Native app (Expo) — iOS + Android
├── web/          # Next.js admin dashboard
├── supabase/     # Database migrations, seed data, RLS policies
└── docs/         # PRD, build plan, research
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Supabase CLI: `npm install -g supabase`
- EAS CLI: `npm install -g eas-cli`

### Environment Variables

Copy the example env files and fill in your keys:

```bash
cp mobile/.env.example mobile/.env
cp web/.env.example web/.env.local
```

Required variables:
- `EXPO_PUBLIC_SUPABASE_URL` — from Supabase project settings
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — from Supabase project settings
- `EXPO_PUBLIC_POSTHOG_KEY` — from PostHog project settings
- `EXPO_PUBLIC_BRANCH_KEY` — from Branch.io dashboard
- `NEXT_PUBLIC_SUPABASE_URL` — same Supabase URL (for web admin)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same anon key (for web admin)

### Run the mobile app

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with your iPhone (Expo Go app) or press `i` for iOS simulator.

### Run the web admin

```bash
cd web
npm install
npm run dev
```

Opens at `http://localhost:3000`

### Apply database migrations

```bash
cd supabase
supabase db push
```

---

## Admin Setup

After creating your first admin user account in the app:
1. Go to Supabase dashboard → Table Editor → `profiles`
2. Find the user row by their user ID
3. Set `is_admin = true`
4. The user now has access to the admin section in the mobile app and web dashboard

---

## Docs

- [PRD — Product Requirements](docs/PRD.md)
- [PLAN — Technical Build Plan](docs/PLAN.md)

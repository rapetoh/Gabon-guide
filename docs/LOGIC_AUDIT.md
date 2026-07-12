# O'Kili — End-to-End Logic Audit (v2, merged)

**Date:** 2026-05-14
**Author:** Claude (deep-pass review for Roch)
**Scope:** Mobile (Expo/React Native), Web (Next.js admin), Supabase backend (project `fvmzsxmlpwvtnszmuowc`, eu-west-1)
**Method:** Five parallel domain audits, plus my own verification pass against the live DB and current source files.

This is v2. It replaces the v1 draft and includes corrections (some v1 claims were wrong — explicitly called out below), the missing-domain audits (map / search / i18n / offline / image pipeline / storage RLS / auth / deployment / artifacts), the user-journey walks, and the DB-verified facts pulled directly from the production schema.

---

## Progress log

**2026-05-17/18 — fixes applied** (each verified against the live DB; mobile: 0 TS errors + 20/20 tests; web: 0 TS errors + production build passes):

- ✅ **9.4 / 9.5** Junk files deleted (3 × `.ips` crash logs, Windows-path artifact); `.gitignore` updated.
- ✅ **10.3** Web admin metadata fixed (`O'Kili Admin`, description, `lang="fr"`).
- ✅ **9.1** All 7 `search_path` security warnings fixed (migrations 023 + 026).
- ✅ **3.2** Welcome/referral credit now granted only after email confirmation, idempotent, OAuth-aware (migrations 024 + 028 cleanup).
- ✅ **1.5** Profiles leak closed: leaky policy dropped; safe `profiles_public` view (id, name, avatar only); owner-of-customer read policy; `referral_code_exists()` RPC for signup validation (migration 025). App code migrated (useReviews, useReferrals, useActivity, CouponsBlock, profile tab, web activity).
- ✅ **1.1 / 1.2 / 1.7** Account screen shipped (`mobile/app/account/edit.tsx`): name, avatar upload (new capped `avatars` bucket), email change, password change, delete-account (`delete_my_account()` RPC; reviews kept under snapshot name — FK now SET NULL) (migration 027).
- ✅ **1.3** Web admin **Users** pages built: list with search + role/blocked filters, detail with role editor, place linking, block toggle, activity stats. Nav link added.
- ✅ **1.4** Block/suspend shipped: `profiles.is_blocked` + `is_blocked()` helper; blocked users cannot write reviews, favorites, or claim coupons (migration 029).
- ✅ **Bonus bug fix** (found while building Users page): admin credit-ledger visibility — the web activity/referrals pages could only see the *admin's own* transactions due to missing read policies; now admins see all (migration 029).
- ⏸️ **2.5** Gabon bounds check stays off until launch week (founder tests from abroad; see pre-launch checklist).

Advisor note: the one remaining `security_definer_view` ERROR on `profiles_public` is **intentional** — documented in migration 026_round_2.

---

## How to read this

- **P0** = ship-blocker or active security/abuse issue
- **P1** = important: hurts ops, UX, or trust within the first weeks
- **P2** = polish / growth

Each finding cites the file or DB object that was verified. Items marked **(DB-verified)** were checked against the live database, not just the source.

Where v1 was wrong, it's flagged with **[v1 correction]**.

---

## Status — what's been fixed (2026-05-17, "Pile 1" pass)

Six items below were applied to both the codebase and the live Supabase database in one session. Migration files committed under `supabase/migrations/` (023, 024, 025, 026). All are live now.

- **DONE — 1.5** Profile-leak shut down. Dropped the `profiles_public_read USING (true)` policy. Replaced with a `profiles_public` view exposing only (id, full_name, avatar_url), a new `profiles_owner_read_customers` policy so restaurant owners can still read customers they served, and a `referral_code_exists(text)` SECURITY DEFINER RPC for the pre-signup code check. App code updated in `useReviews.ts`, `useReferrals.ts`, `useActivity.ts`. (Migration 025.)
- **DONE — 3.2** Welcome credit now waits for email confirmation. Reorganized `handle_new_user` to defer the credit grant; added a second trigger `on_auth_user_email_confirmed` that grants on the email-confirmed transition. Both call the new idempotent `grant_referral_reward(uuid)` helper. Throwaway-email farming is closed. (Migration 024.)
- **DONE — 9.1** All seven flagged database functions now have a pinned `search_path = public, pg_temp`: `generate_referral_code`, `set_referral_code_on_profile`, `get_all_users_for_admin`, `generate_coupon_redemption_code`, `handle_user_email_change`, `is_admin`, `update_updated_at`. The search-path mutability advisory is cleared. (Migrations 023 + 026.)
- **DONE — 9.4 / 9.5** Three iOS crash logs and the Windows-path file deleted from the repo. `.gitignore` updated to ignore `*.ips` and accidental `C:\*` artifacts in the future.
- **DONE — 10.3** Web app metadata fixed. Browser tab now reads "O'Kili Admin" instead of "Create Next App". `<html lang>` switched from `"en"` to `"fr"`.
- **SKIPPED (intentional) — 2.5** Gabon bounds check stays off for now. Turning it on right now would block you from saving test places from outside Gabon. This is a launch-week task.

**Remaining advisor findings (intentional or out of scope):**
- `security_definer_view` on `profiles_public` — flagged by Supabase as an ERROR. This is intentional: the view's whole job is to expose a safe 3-column projection regardless of who's asking, so SECURITY DEFINER is the correct setting. Leaving as-is.
- `public_bucket_allows_listing` on `place-videos` — anyone can list all video filenames in the bucket. Not catastrophic; URLs still work without it. Will be addressed when the storage RLS gets its proper second pass (see 2.4 below).
- `pg_graphql_anon_table_exposed` — pgGraphQL may be exposing tables. Will check next session.

---

## TL;DR — the eight things to fix first

1. **`profiles_public_read` RLS policy leaks every column to every authenticated user** — including `email`, `role`, `is_admin`, `referral_code`, `referred_by`, `preferred_zones`, `preferred_vibes`, `phone`. (DB-verified.) **P0 security.**
2. **No push-notification infrastructure.** `expo-notifications` isn't installed. The founder's canonical "coupon scanned, user never notified" issue lives here. (Confirmed in `mobile/package.json`.) **P0.**
3. **No Users page in web admin.** [web/app/admin/](web/app/admin/) has no `users/` subroute. Founder can only manage users from mobile. **P0.**
4. **No profile-edit screen and no account-deletion path on mobile.** Apple will reject. (Confirmed via inspection of [mobile/app/account/](mobile/app/account/) — only `activity.tsx`.) **P0.**
5. **`handle_new_user` grants welcome credit before email confirmation.** No `email_confirmed_at` check. Throwaway-email referral farming is live. (DB-verified — full function read.) **P0.**
6. **Restaurant-owner storage upload policy is broken.** The RLS clause references `places.name` instead of the storage object's name. Owners likely cannot upload photos/videos to storage via the API — only admins can. (DB-verified.) **P0 if owners are actually using the upload flow.**
7. **Tier limits are 100% client-side.** No triggers, no constraints, no server-side enforcement on photos, coupons, or videos. (DB-verified — only triggers on places/profiles/reviews are `updated_at` and referral-code.) **P0 if you ever charge for tiers.**
8. **Two macOS crash logs and one Windows-path file are committed to the repo.** [supabase/migrations/OKili-2026-03-31-225952.ips](supabase/migrations/OKili-2026-03-31-225952.ips) (+ two siblings) are iOS crash JSON, not migrations. [C:\Users\rapetoh\.claude\plans\floofy-honking-cocke.md](C:%5CUsers%5Crapetoh%5C.claude%5Cplans%5Cfloofy-honking-cocke.md) is a 15.9 KB file with a literal Windows path as its name at the repo root. **P1 cleanup.**

---

## v1 corrections (things I had wrong)

These are listed once at the top so you can recalibrate trust. The bodies below carry the corrected versions.

- **[v1 1.6 — `profiles_public_read_minimal` RLS policy needed for review names]** Wrong direction. There already IS a `profiles_public_read` policy with `USING (true)` — added by a later migration that wasn't in the file I read in v1. Review author names render fine. The new problem is that the policy is too permissive (entire profile leaks). See P0 #1 above.
- **[v1 2.10 — `is_promoted` has no expiration enforcement]** Half wrong. The CHECK constraint `promoted_requires_premium` DOES exist and prevents `is_promoted = true` when the tier isn't `premium`. (DB-verified.) What's still missing: no nightly job to demote a place when `subscription_expires_at` passes. Tracked below as P1.
- **[v1 3.5 — verify server-side expiry on redemption]** Confirmed: `apply_redemption_session` raises `COUPON_INACTIVE_OR_EXPIRED` if `expires_at <= now()`. Server-side expiry works. Drop this finding.
- **[v1 5.6 — Branch.io smart links]** No change to severity; just noting `react-native-branch` is indeed absent (verified in `mobile/package.json`).
- **[v1 scanner-is-a-stub]** Was already corrected in v1 close-out, but to repeat: [mobile/app/restaurant-admin/scanner.tsx](mobile/app/restaurant-admin/scanner.tsx) is 783 lines and fully functional (expo-camera QR decode, session-locked customer, RPC apply).

---

## What's solid (verified)

To keep this honest — these things work. Don't rebuild them.

- **Auth state persistence** ([mobile/lib/supabase.ts](mobile/lib/supabase.ts)) — `AsyncStorage` backed, `autoRefreshToken`, `persistSession: true`, `flowType: 'pkce'`. Sessions survive restarts and OAuth callbacks work correctly.
- **"Open now" timezone** ([mobile/utils/isOpenNow.ts](mobile/utils/isOpenNow.ts)) — hardcoded `LIBREVILLE_UTC_OFFSET = 1`. Overnight bars handled. PRD §9 met.
- **Server-side coupon expiry + place-scope enforcement** in `apply_redemption_session` RPC (DB-verified).
- **`promoted_requires_premium` CHECK constraint** on `places` (DB-verified).
- **Realtime redemption signals** — `coupon_redemptions` and `credit_transactions` in `supabase_realtime` publication with `REPLICA IDENTITY FULL` (migration 022, DB-verified).
- **Owner reply** displayed on user place detail at line 931 of [mobile/app/place/[id].tsx](mobile/app/place/%5Bid%5D.tsx); `set_review_owner_reply` SECURITY DEFINER function correctly checks owner or admin (DB-verified).
- **User-side coupon wallet + credit balance** rendered on profile tab via `useMyCoupons()` + `useCreditBalance()` at [mobile/app/(tabs)/profile.tsx](mobile/app/(tabs)/profile.tsx) lines 60–61.
- **Foreign keys with reasonable cascade rules** (DB-verified):
  - `favorites.user_id` → CASCADE
  - `credit_balances.user_id`, `credit_transactions.user_id` → CASCADE
  - `reviews.user_id` → CASCADE (reviews disappear with user — see 1.2 to decide if you want anonymize-instead)
  - `coupon_redemptions.user_id` → SET NULL (history preserved)
  - `places.owner_id` → SET NULL (place survives owner deletion)
  - `profiles.referred_by` → SET NULL
- **Scanner** ([mobile/app/restaurant-admin/scanner.tsx](mobile/app/restaurant-admin/scanner.tsx)) — 783-line full implementation with both coupon and credit QR payloads, customer-locked sessions.
- **Place CRUD on web admin** — PlaceForm, PhotoManager, soft-delete via `is_deleted`.
- **PostHog analytics integrated** — events for views, CTAs, filters fired (`mobile/hooks/useAnalytics.ts`).
- **Tier feature flags admin-editable** — `tier_features` and `tier_limits` tables read at runtime via `usePlaceTier`/`useTierFeatures`. No deploy needed to change gates.

---

# Domain 1 — Users & Auth

## P0

### 1.1 No profile-edit screen for users on mobile
Only [mobile/app/account/activity.tsx](mobile/app/account/activity.tsx) exists. No name/avatar/email/password/language edit screen. `profiles.avatar_url` column exists but is only ever populated by OAuth metadata.
**Fix:** create `mobile/app/account/edit.tsx` with name + avatar upload + email change (`supabase.auth.updateUser`) + password change + language picker. Avatar upload needs a new storage bucket (see 3.7).

### 1.2 No account-deletion path
No `delete_account` RPC, no "Delete account" UI in either app. (Confirmed by grep across mobile/web/supabase.) Apple App Store requires this for any app with account creation. Also: `reviews.user_id` is `ON DELETE CASCADE` — deleting a user removes their reviews entirely. Decide: anonymize-and-keep ("Utilisateur supprimé") vs. delete-with-recompute. Anonymize is the right answer (preserves the record, looks normal).
**Fix:** SECURITY DEFINER `delete_my_account()` RPC that (a) writes `reviews.user_id = NULL` (after changing the FK to `SET NULL` with an `author_display_name` snapshot column) for anonymization, (b) lets the CASCADEs do the rest for favorites/credit/etc., (c) calls `auth.admin.deleteUser()`. Wire UI in the new account-edit screen.

### 1.3 No Users page in web admin
[web/app/admin/](web/app/admin/) has only `places`, `coupons`, `activity`, `referrals`, `tier-settings`. Mobile has [mobile/app/admin/users/[id].tsx](mobile/app/admin/users/%5Bid%5D.tsx) + `index.tsx`. Founder can't manage users from desktop.
**Fix:** port mobile Users page to web. Needs list + search + filter + single-user detail (reviews, coupons redeemed, credit balance, referrals sent, places owned, role editor, block toggle).

### 1.4 No block/suspend mechanism
No `is_blocked` column on profiles (DB-verified). No RLS gate. Bad-actor response = SQL access only.
**Fix:** `profiles.is_blocked boolean default false` migration + extend `is_admin()` helper into `can_act()` that returns false for blocked users + wire into INSERT policies on `reviews`, `favorites`, `coupon_redemptions`. Surface as toggle in web Users page.

### 1.5 `profiles_public_read` leaks every column **(DB-verified, new finding in v2)**
A policy with `USING (true)` allows any authenticated user to read every column of every profile, including: `email`, `phone` (if present), `is_admin`, `role`, `referral_code`, `referred_by`, `preferred_zones`, `preferred_vibes`, plus any future PII columns. This is a real GDPR-ish exposure and an info-leak that lets anyone enumerate referral codes and admin accounts.
**Fix:** drop `profiles_public_read`. Replace with either a `profiles_public_read_minimal` policy column-list (not natively supported in Postgres RLS — needs a view) OR — cleaner — create a `public.profiles_public` view that exposes only `(id, full_name, avatar_url)` and switch all client joins from `profiles` to `profiles_public`. Keep `profiles_own_read` + `profiles_admin_read_all` for the full table.

## P1

### 1.6 Onboarding preferences are write-once and never read downstream
Migration 008 added `preferred_zones` and `preferred_vibes`. They're set in onboarding and never read by any home/feed personalization hook.
**Fix:** add "Edit preferences" in new profile-edit screen + use the preferences in trending/explore ordering (boost places in preferred zones).

### 1.7 Restaurant owner has no own account-settings screen
No "Mon compte" inside `restaurant-admin/_layout.tsx`. Owner can't change email/password from there.
**Fix:** add account tab in restaurant-admin pointing to the same edit screen as regular users.

### 1.8 `is_admin` and `role` are dual sources of truth
`profiles.is_admin boolean` (legacy) + `profiles.role text` (from 009). Helper `is_admin()` checks both, RLS policies use one or the other inconsistently across migrations (DB-verified — both styles present).
**Fix:** keep `is_admin()` helper as the single read path, add a trigger that mirrors `role='admin'` into `is_admin=true`, plan removal of the legacy column in a later migration.

### 1.9 Magic-link not implemented (PRD §4 mentions it)
Only email/password + OAuth. Skip for MVP, but log it.

### 1.10 Referral code on signup is silently dropped if invalid
[supabase/migrations/018](supabase/migrations/018_welcome_credit_and_session_redeem.sql) lines 87–94 — if no profile matches `referral_code`, `v_referrer_id` is null and the signup just proceeds without telling the user. User pastes a typo, gets no credit, gets no error.
**Fix:** add a client-side `validate_referral_code(code)` RPC + show inline error before submit.

## P2

### 1.11 Signup-without-email-confirm orphans profile rows
Profile row created via trigger on `auth.users` insert; if user never confirms, sits dormant. Low cost but messy.
**Fix:** scheduled job to delete profile + cascades if `auth.users.email_confirmed_at IS NULL AND created_at < now() - interval '14 days'`.

---

# Domain 2 — Places & Content

## P0

### 2.1 Publishing a place is not gated on having a photo
PRD §5 requires it. Neither [web/components/PlaceForm.tsx](web/components/PlaceForm.tsx) nor [mobile/components/admin/PlaceForm.tsx](mobile/components/admin/PlaceForm.tsx) refuse `is_active=true` when `photos` is empty.
**Fix:** server-side trigger `BEFORE UPDATE OF is_active ON places` that refuses the flip when zero non-deleted photos exist. Don't trust the client.

### 2.2 Storage objects orphaned on place soft-delete
[supabase/migrations/002_rls_policies.sql](supabase/migrations/002_rls_policies.sql) line 53: `places_public_read` requires `is_active = true AND is_deleted = false`. When admin soft-deletes a place, photos table rows aren't marked deleted, and storage objects are never removed. Storage costs grow forever; users could potentially still URL-guess at old photos (buckets are public — DB-verified).
**Fix:** Edge Function or scheduled job: on `places.is_deleted` flip, mark photos `is_deleted = true` AND remove from storage. Or convert soft-delete to a true cascade after a 30-day grace.

### 2.3 Restaurant-owner storage upload policy is broken **(DB-verified, new finding in v2)**
The policies "Restaurant owners can upload photos/videos" use:
```
(storage.foldername(p.name))[1] = (p.id)::text
```
where `p` is aliased to `places`. So `p.name` is the place's *name column*, not the storage object name. Either the policy never grants permission (and owners can't upload, only admins can) or it does on a happy coincidence. Either way it's not what was intended.
**Fix:** rewrite as `(storage.foldername(name))[1] = (p.id)::text` (referencing the storage object's `name`). Test with an owner account.

### 2.4 Storage buckets have NO size or mime-type limits **(DB-verified, new finding in v2)**
`place-photos` and `place-videos` buckets both have `file_size_limit = NULL` and `allowed_mime_types = NULL`. Any authenticated uploader can push a 5 GB blob or a `.exe` renamed to `.jpg`.
**Fix:** set `file_size_limit = 5_242_880` (5 MB) on photos, `52_428_800` (50 MB) on videos. `allowed_mime_types = ['image/jpeg','image/png','image/webp']` and `['video/mp4','video/quicktime']`. Set via `UPDATE storage.buckets SET ...`.

### 2.5 Re-enable Gabon bounds check
Already in [project_prelaunce_checklist.md](../.claude/projects/-Users-roch-Desktop-Gabon-guide/memory/project_prelaunce_checklist.md). Uncomment in `validate()` of both PlaceForm files before submission.

## P1

### 2.6 No restaurant-owner claim flow
`places.owner_id` exists. No `place_claim_requests` table, no "Claim this restaurant" UI, no approval queue. Owners only get linked via manual admin edit in [mobile/app/admin/users/[id].tsx](mobile/app/admin/users/%5Bid%5D.tsx).
**Fix:** migration `place_claim_requests(id, place_id, user_id, message, status, decided_by, decided_at, created_at)` + "Claim this restaurant" button on place detail + admin approval surface (both mobile and the new web Users page).

### 2.7 Reviews are still readable when their place is unpublished
`reviews_public_read` policy is `USING (true)` (DB-verified). When admin sets `places.is_active = false`, reviews stay readable if you know the place ID.
**Fix:** rewrite `reviews_public_read` to `USING (EXISTS (SELECT 1 FROM places p WHERE p.id = reviews.place_id AND p.is_active AND NOT p.is_deleted))`.

### 2.8 Favorites for deactivated places show as broken cards
Favorite row survives; place query returns nothing. UI shows a card with null name (verified via flow audit).
**Fix:** filter `useFavorites` to active places, or show "Unavailable" badge. Decide.

### 2.9 No owner-reply moderation; no length cap
`set_review_owner_reply()` (DB-verified) trims and stores any string with no length cap, no profanity check, no admin moderation queue. Inappropriate reply sits live.
**Fix:** cap length in the function (e.g. 1000 chars), add `reviews_moderation_status` column, build admin moderation page in web.

### 2.10 No CRUD UI for categories / subcategories / zones
Tables exist (migrations 001, 004) but only SQL or Supabase Studio can manage them. Content team can't iterate.
**Fix:** simple admin CRUD pages on web `/admin/categories`, `/admin/subcategories`, `/admin/zones`. Two-day task.

### 2.11 No mobile video upload UI
[mobile/components/admin/PlaceForm.tsx](mobile/components/admin/PlaceForm.tsx) handles photos but not videos. Web has it; mobile doesn't. Field workflow is photo-first but videos drive the feed.
**Fix:** add `mobile/app/admin/place/[id]/videos.tsx` paralleling the photos editor.

### 2.12 No "Report this place" / "Permanently closed" path
No `place_reports` table, no UI. Users can't tell you a venue closed.
**Fix:** `place_reports(place_id, reason, message, reporter_id, status, created_at)` + report button on place detail + admin moderation page.

### 2.13 No promoted-place expiration enforcement **[v1 correction — constraint exists]**
The `promoted_requires_premium` CHECK constraint exists (DB-verified). What's still missing: when `subscription_expires_at` passes, nothing flips `subscription_tier` back to `free` and nothing flips `is_promoted` to `false`. Tier and promotion remain "paid" forever after a single admin set.
**Fix:** nightly job (Edge Function on a cron) that runs `UPDATE places SET subscription_tier='free', is_promoted=false WHERE subscription_expires_at < now() AND subscription_tier <> 'free'`.

## P2

### 2.14 No place-edit audit log
`updated_at` only; no record of who changed what.

### 2.15 `weekly_feed` table + hook are dead code
[mobile/hooks/useWeeklyFeed.ts](mobile/hooks/useWeeklyFeed.ts) exists; no component imports it. Per [project_architecture_decisions.md](../.claude/projects/-Users-roch-Desktop-Gabon-guide/memory/project_architecture_decisions.md), Trending Now replaced it.
**Fix:** drop the hook and the table, or repurpose.

### 2.16 Place avg-rating not aggregated on the place row
Reviews are joined every time. Add `places.avg_rating` + `places.review_count` maintained by a trigger once volume justifies.

---

# Domain 3 — Coupons, Credits, Referrals

## P0

### 3.1 No persistent confirmation that a redemption succeeded
The realtime channel works — but the success is trapped inside the `QrModal` in [mobile/components/place/CouponsBlock.tsx](mobile/components/place/CouponsBlock.tsx) at lines 208–229. Close the modal mid-scan → user sees nothing afterward. This is the founder's canonical example.
**Fix (layered):**
- Short-term: persist a 5–10s toast after modal dismiss, and write a "Recently used" row to a local cache.
- Real fix (paired with 5.1): on every `coupon_redemptions` UPDATE where `redeemed_at` becomes non-null, insert a row in a new `notifications` table; the user's app subscribes to that table and shows an in-app inbox + push notification.

### 3.2 Welcome credit granted before email confirmation **(DB-verified)**
`handle_new_user()` (DB-verified — full source read) fires on `auth.users` insert and immediately credits both the new user and the referrer. There's no `email_confirmed_at` check. Throwaway-email referral farming works.
**Fix:** add `IF NEW.email_confirmed_at IS NULL THEN RETURN NEW; END IF` at the top of the credit branch. Add a second trigger on `UPDATE OF email_confirmed_at` that runs the credit branch when the column transitions from NULL → not NULL.

### 3.3 No referral-abuse prevention beyond uniqueness
Same device, same IP, same email domain are not tracked. Combined with 3.2 this is a fully open faucet.
**Fix:** log signup IP into `auth.users.raw_app_meta_data` (Supabase Auth lets you do this via a hook), reject `referred_by` if referrer and referee share IP within 24h or email domain. Admin override flag in profiles.

## P1

### 3.4 No expiration notifications
A coupon expires tomorrow; user gets nothing. No daily job, no badge.
**Fix:** "Expires soon" badge on coupon cards in wallet now; daily job + push when 5.1 lands.

### 3.5 No dispute / refund path
No `dispute_status` on `coupon_redemptions`. If staff scans but doesn't apply the discount, there's no way to reverse it.
**Fix:** add `dispute_status`, build admin "Reverse this redemption" RPC that re-credits if applicable.

### 3.6 Redemption-session has no client-side timeout
QR modal waits forever for owner to scan. Owner crashes → modal hangs.
**Fix:** 10-minute client timeout with friendly "Try again" message.

### 3.7 Logged-out users on a place page never see the coupon exists
[mobile/components/place/CouponsBlock.tsx](mobile/components/place/CouponsBlock.tsx) renders null when there's no session. Lost signup conversion.
**Fix:** if `!session && coupons.length > 0`, show "Connectez-vous pour débloquer ce coupon" with CTA.

### 3.8 Owner cannot see per-coupon redemption history
`useCouponRedemptions` hook exists; no screen consumes it.
**Fix:** tap a coupon in restaurant-admin → drawer with `redeemed_at` + customer first-name + bill/discount.

### 3.9 User cannot see credit transaction history
`useCreditTransactions` exists; never called.
**Fix:** Historique section in the new account-edit screen.

### 3.10 Referral code share UX is unfinished
Code visible in profile but no Copy button and no Share-to-WhatsApp. Given WhatsApp is the viral loop, this is leaving growth on the table.

### 3.11 Raw INSERT on `coupon_redemptions` is allowed
RLS lets any authenticated user insert a row for themselves with no coupon-validity check (the RPC is the only thing that validates). A bad client could spam rows.
**Fix:** narrow the policy to deny direct inserts except via the RPC, OR add a `BEFORE INSERT` trigger that validates `coupon_id` is active and not expired.

## P2

### 3.12 Admin coupon analytics (fraud patterns, hot times)
Nice-to-have.

### 3.13 Platform coupons on home feed
Carousel of active platform coupons on home.

---

# Domain 4 — B2B / Tiers / Owners

## P0

### 4.1 No self-service owner signup / claim flow
Covered above (2.6). 100% manual onboarding.

### 4.2 No payment integration
No Stripe, no Airtel Money, no Moov Money. `subscription_tier` and `subscription_expires_at` are admin-set strings.
**Fix (incremental):**
- Near-term: nightly job that flips expired tiers back to free + un-promotes (also covers 2.13).
- Real fix: integrate Stripe (cards) + an Airtel/Moov Money option for local owners. Until then, ship the admin manual-mark UI cleanly.

### 4.3 Tier limits enforced client-side only **(DB-verified)**
No triggers on photos/coupons/places enforce tier limits (DB-verified — only triggers are `*_updated_at` and referral-code generation). A patched client or direct REST call can ignore them.
**Fix:** add `BEFORE INSERT` trigger on `photos` that counts existing photos for the place and compares to `tier_limits.max_photos`. Same logic for coupons (`tier_features.coupons_create`).

## P1

### 4.4 Owner dashboard has no metrics card
PostHog collects the events but no owner-facing surface. Standard tier promises "+ analytics" — currently theater.
**Fix:** quickest path is a `place_events_daily` materialized view fed by a periodic job that counts events from a new `place_events` table that the mobile app writes to directly (no PostHog round-trip). Show "Last 7 days: X views, Y WhatsApp taps, Z calls" on the restaurant-admin home.

### 4.5 No multi-place support
[mobile/app/restaurant-admin/index.tsx](mobile/app/restaurant-admin/index.tsx) ~line 40 calls `.single()`. One owner = one place.
**Fix:** convert to `useOwnedPlaces` returning a list, add a place-picker on the restaurant-admin root.

### 4.6 No tier-downgrade safe-handling
Over-limit photos/coupons silently hide; no warning, no decision UX.
**Fix:** confirmation dialog before downgrade; hide-not-delete; show "Unlock these on Standard" UI on the data that's hidden.

### 4.7 No B2B sales pipeline view
No kanban / table of prospects. Lives in a spreadsheet.
**Fix:** `b2b_prospects(place_name, contact, status, notes, last_touch)` migration + web admin page.

## P2

### 4.8 Owner-side review-request flow (Yelp-style)
**4.9 Owner messaging inbox** for O'Kili → owner.

---

# Domain 5 — Cross-cutting: Notifications, Observability, Abuse, Support

## P0

### 5.1 No push-notification system
`expo-notifications` not in `mobile/package.json` (verified). No push token capture, no OneSignal, no Edge Function for fanout.
**Fix:**
1. `npx expo install expo-notifications`
2. New table `push_tokens(user_id, token, device_id, platform, updated_at)`
3. Edge Function `send_push(user_id, payload)` calling Expo Push API
4. First subscribers: coupon-redeemed, credit-redeemed, referral-credit-earned, review-replied, coupon-expiring.

### 5.2 No in-app notifications inbox
No screen, no table, no unread badge.
**Fix:** `notifications(id, user_id, type, payload jsonb, read_at, created_at)` + `mobile/app/account/notifications.tsx` + badge on profile tab. The same trigger that fires push (5.1) also inserts here.

### 5.3 No error / crash reporting
Sentry/Bugsnag/Crashlytics not installed (verified in `mobile/package.json`). Crashes invisible.
**Fix:** install `@sentry/react-native` on mobile and Sentry on web before App Store submission.

### 5.4 No admin audit log
Admin can change roles, delete places, reverse redemptions — no record.
**Fix:** `admin_audit_log(admin_id, action, entity_type, entity_id, before jsonb, after jsonb, created_at)` + a thin `audit()` helper called from every admin RPC.

## P1

### 5.5 No abuse-reporting UI
No buttons, no `reports` table. `system_settings.moderation_enabled` flag in migration 014 is unused.
**Fix:** generic `reports(reporter_id, target_type, target_id, reason, status, created_at)` + buttons on reviews/places/users + moderation page.

### 5.6 Activity feed is polling, not realtime
`useActivity` uses React Query with `staleTime` 5–30 s. Migration 022 enabled realtime for `coupon_redemptions` and `credit_transactions`, so the activity feed could subscribe directly.
**Fix:** swap the polling for a realtime subscription in `mobile/hooks/useActivity.ts`.

### 5.7 Operational dashboard missing
Admin sees activity but no DAU, signups today, redemptions today, top-10 places this week. Flying blind on day 2.
**Fix:** `/web/admin/dashboard` page with materialized-view-backed counters.

### 5.8 No support / help surface
No Help screen, no FAQ, no "Contact us." User confused → user gone.
**Fix:** Help screen in profile with WhatsApp contact + short FAQ (FR primary, EN secondary).

### 5.9 No transactional email beyond Supabase Auth defaults
Welcome email, redemption receipt, tier-expiring warning — none exist.
**Fix:** Resend.dev or SendGrid + Edge Function templates.

### 5.10 Branch.io smart links not implemented (PRD §4)
Plain native share. Loses web previews + analytics. P1 if growth matters; otherwise post-launch.

---

# Domain 6 — UX state, i18n, validation, accessibility *(new in v2)*

## P0

### 6.1 Web admin is English-only
Entire [web/app/admin/page.tsx](web/app/admin/page.tsx) and most other admin pages have hardcoded English strings ("Overview", "Add place", "Total places", "Tier distribution"). A French-speaking owner (your target market) can't read the dashboard.
**Fix:** wire i18n on web (next-intl or similar) and translate to FR.

### 6.2 Photo compression has no error handling
[mobile/components/admin/PlaceForm.tsx](mobile/components/admin/PlaceForm.tsx) ~lines 272–284: `expo-image-manipulator` can throw, no try/catch, silent loss.
**Fix:** wrap in try/catch with user-facing Alert.

## P1

### 6.3 i18n choice doesn't persist across app restarts
[mobile/lib/i18n.ts](mobile/lib/i18n.ts) sets `lng` from `expo-localization` once. The toggle in profile.tsx calls `i18n.changeLanguage()` but never writes to AsyncStorage; next launch resets to device locale.
**Fix:** add a custom `languageDetector` plugin that reads/writes `lang` to AsyncStorage; init lng from AsyncStorage with fallback to device locale.

### 6.4 Missing loading skeletons (six screens)
[mobile/app/(tabs)/explore.tsx](mobile/app/(tabs)/explore.tsx) (New in Town), [mobile/app/restaurant-admin/edit.tsx](mobile/app/restaurant-admin/edit.tsx), [mobile/app/(tabs)/map.tsx](mobile/app/(tabs)/map.tsx), [mobile/app/admin/place/[id].tsx](mobile/app/admin/place/%5Bid%5D.tsx), [web/app/admin/page.tsx](web/app/admin/page.tsx) (Recently added), [mobile/app/(tabs)/favorites.tsx](mobile/app/(tabs)/favorites.tsx).
**Fix:** skeleton/spinner components while `isLoading`.

### 6.5 Missing or weak empty states (four screens)
Coupons admin index, restaurant-admin history (filtered empty), map (no mappable places), account/activity (zero activity).

### 6.6 Silent error handling in five places
- `mobile/hooks/usePlaces.ts` — error thrown with no boundary.
- `mobile/app/restaurant-admin/edit.tsx` — update error not checked.
- `mobile/app/place/[id].tsx` — directions fetch falls back silently.
- `web/components/PlaceForm.tsx` — reference data load has no try/catch.
- See 6.2 for photo compression.

### 6.7 No offline indicator UI, no optimistic favorites
No `NetInfo` integration. Heart tap on slow network feels broken.
**Fix:** offline banner + optimistic toggle on `useFavorites`.

### 6.8 Form validation incomplete on web PlaceForm
Required fields not validated before submit; submit always enabled. Phone/website validators exist but aren't called on blur.

### 6.9 Missing destructive-action confirmations
Logout in `(tabs)/profile.tsx`, delete-photo / delete-menu-photo / delete-video in mobile PlaceForm.

### 6.10 Missing toast feedback on favorite add/remove and admin coupon delete

## P2

### 6.11 Icon-only buttons lack `accessibilityLabel`
Search-clear, favorite heart, filter chips. Screen-reader users blocked.

---

# Domain 7 — Flows verified end-to-end *(new in v2)*

## What works end-to-end

1. **Favorites** save → unsave → browse → navigate.
2. **Coupon redemption** wallet → QR scan → realtime feedback **while the modal is open** → history on user side. (Not while modal is closed — see 3.1.)
3. **Owner coupon creation** form → insert.
4. **Owner reply to review** review list → reply RPC → owner_reply rendered on user place detail at line 931.
5. **Place detail view** hero + photos + info + hours (Libreville TZ) + coupons + reviews + directions.
6. **Explore search + filters** name search + filter compose + infinite scroll. (Search is name-only — see 7.1.)
7. **Admin tier-settings** live toggle of feature flags + photo cap.
8. **Onboarding** welcome → areas → location → preferences → saved. (Preferences never read after — 1.6.)
9. **Map browsing** pan + tap → card → detail. (No pin clustering — 7.3.)
10. **Auth state persistence** survives app restarts (verified in [mobile/lib/supabase.ts](mobile/lib/supabase.ts)).

## Flows that break or are incomplete (deltas not already listed)

### 7.1 Search is name-only
[mobile/hooks/usePlaces.ts](mobile/hooks/usePlaces.ts) ~line 104 only matches `p.name`. No description / category / zone matching, no diacritic fold.
**Fix:** Postgres full-text search column on `places` (immutable index) + diacritic fold via `unaccent` extension.

### 7.2 Search-as-you-pan on map missing
Not in scope for MVP, but flag.

### 7.3 No pin clustering on map
Multiple pins at same coords stack invisibly.
**Fix:** small clustering component or `react-native-maps-super-cluster`.

### 7.4 Place detail has no Videos section
Videos exist in feed only. The single-place screen has no video player block.

### 7.5 Reviews list has no pagination / sort / filter
On a popular place all reviews load at once. Sorted by `created_at` desc only.

### 7.6 Hardcoded strings in `mobile/app/(tabs)/explore.tsx` lines 176–227
"Ouvert maintenant" / "Open now", "Près de moi" / "Near me" written as conditionals rather than `t()` keys.

### 7.7 Activity feed event scope is narrow
`useActivity` only surfaces 5 reasons (credit signup / invite / adjust / spend / coupon_redemption). Missing: reviews written, places favorited, profile changes, place edits. New event types from migrations 020–022 already mapped — that part works.

### 7.8 Home `weekly_feed_opened` event not fired anywhere
PRD §11 lists it; nothing emits it. Either remove from the PRD or wire it in.

---

# Domain 8 — User journeys *(new in v2)*

These trace specific real-world sessions and the rough edges along the way. References back to numbered findings above.

## 8.A — New user's first 60 seconds (mobile, no referral code)

1. App launches → splash from `app.config.js` (icon, white bg). ✓
2. First-time AsyncStorage check → onboarding flow. ✓
3. User signs up via Google. → `auth.users` row created → `handle_new_user` trigger fires → `profiles` row inserted with referral_code auto-generated → `credit_balances` row seeded with 0. ✓ All correct.
4. Onboarding screens collect zones + vibes → write to `profiles.preferred_zones` / `preferred_vibes`. ✓
5. **Problem:** preferences are never used downstream (1.6). The home feed doesn't personalize.
6. Onboarding done flag stored only in AsyncStorage → if user uninstalls or clears data, the onboarding repeats but DB preferences already exist (handled — `ON CONFLICT DO UPDATE`).
7. User lands on home tab — TikTok-style video feed. **Problem:** if user denied location permission, "Near You" silently degrades (acceptable). If admin hasn't uploaded videos yet (DB has 0 places today), the feed is empty with a generic empty state. No big "Add the first listing" CTA for the first-launch admin scenario.
8. User taps the profile tab → sees credit balance "0 FCFA" + empty wallet. ✓
9. **Problem:** no welcome notification, no "Hey, invite friends to earn 1000 FCFA" prompt (3.10 / 5.2).

**Journey-level verdict:** signup and onboarding work mechanically. The post-onboarding experience is silent — preferences captured but unused, no engagement hook, no welcome to the credit/referral system.

## 8.B — Returning user redeems a coupon

1. User opens the app — session restored from AsyncStorage. ✓
2. Opens a place detail → sees the coupon block. ✓
3. Taps "Use Coupon" → QR modal opens → user shows phone to staff.
4. Staff scans on their `restaurant-admin/scanner.tsx` — coupon details fetched → applied via `apply_redemption_session` RPC (correctly validates active/scope/expiry, DB-verified).
5. RPC succeeds → `coupon_redemptions.redeemed_at` set → realtime fires → user's QR modal shows success. ✓
6. **Problem (3.1):** if the user closed the modal between step 3 and step 5, success is invisible. No toast, no inbox, no push.
7. **Problem (3.6):** if staff never scans, the user's modal waits forever.
8. After success: user navigates to profile → wallet shows the coupon as redeemed (correct, because `useMyCoupons` filters on `redeemed_at IS NULL`). ✓
9. **Problem (3.9):** user has no transaction history screen to see when/where/how much — `useCreditTransactions` exists but no UI.

**Journey-level verdict:** the happy path works thanks to realtime. Every edge case (modal closed early, staff never scans, what just happened?) is silent.

## 8.C — Restaurant owner's daily flow

1. Owner opens app — session restored. Tab visible because `profiles.role = 'restaurant_owner'`. ✓
2. Lands on `restaurant-admin/index.tsx` — tier badge + buttons + locked feature cards. ✓
3. **Problem (4.4):** no metrics. Owner sees no signal of whether anything happened yesterday.
4. Owner taps "Edit place" → edits photos. **Problem (2.3 + 2.4):** the storage policy for owner photo upload appears buggy AND there are no size/mime limits even if it works. Test this in dev — it may already be broken.
5. Owner taps "Coupons" → creates a new coupon. RLS allows it (DB-verified). **Problem (4.3):** no server-side check that this owner's tier permits coupon creation. If client is patched, free-tier owner can create unlimited coupons.
6. Owner taps "Reviews" → replies to a customer. ✓ Reply renders on user side. ✓ No moderation (2.9).
7. Owner taps "Scanner" → scans a coupon presented by a customer. ✓ Works.
8. Owner wants to see "how many coupons got redeemed today" → **no screen exists** (3.8).
9. **Problem (4.5):** owner has 2 places, but the app shows only one (`.single()`).
10. **Problem (1.7):** no settings tab to change password or delete account.

**Journey-level verdict:** core actions work mechanically. The owner has no business reason to keep coming back — no metrics, no inbox, no proof of redemption volume.

---

# Domain 9 — Deployment & repo hygiene *(new in v2)*

## P0

### 9.1 Database security advisors flagging mutable function search_paths
Supabase `get_advisors(type=security)` returned WARN-level findings for at least these functions:
- `public.generate_referral_code`
- `public.set_referral_code_on_profile`
- `public.get_all_users_for_admin`
(and others; full list in `function_search_path_mutable` advisory)

Mutable search_path on SECURITY DEFINER-adjacent code is a known attack vector.
**Fix:** add `SET search_path = public, pg_temp` to each function definition. Most newer ones (`apply_redemption_session`, `set_review_owner_reply`, `handle_new_user`) already do this.

## P1

### 9.2 `eas.json` is bare-bones
[mobile/eas.json](mobile/eas.json) has only minimal `development` / `preview` / `production` profiles. No env separation, no submission config (App Store / Play Store), no bundle-identifier overrides per env.
**Fix:** before App Store submission, add `submit.production` with `ios.appleId`, `ios.ascAppId`, `android.serviceAccountKeyPath`. Add `env` blocks per profile so dev/staging/prod hit different Supabase projects.

### 9.3 No Supabase local-dev config
No `supabase/config.toml`. You're developing against the remote project. Fine for solo work, dangerous if collaborators land. Decide.

### 9.4 Three iOS crash logs committed to migrations folder
[supabase/migrations/OKili-2026-03-31-225952.ips](supabase/migrations/OKili-2026-03-31-225952.ips) and two siblings are JSON iOS crash reports (OKili app, bundle `com.okili.app`, iPhone OS 26.2.1). They are not migrations. The Supabase CLI will ignore them, but they pollute the migrations folder and bloat the repo.
**Fix:** delete them; add `*.ips` to `.gitignore`.

### 9.5 Windows-path file at repo root
[C:\\Users\\rapetoh\\.claude\\plans\\floofy-honking-cocke.md](C:%5CUsers%5Crapetoh%5C.claude%5Cplans%5Cfloofy-honking-cocke.md) is a real 15.9 KB file. Someone (probably Claude Code on a Windows machine) wrote a literal absolute Windows path as the filename. Looks like a planning artifact that escaped.
**Fix:** delete or move to `docs/plans/`. Add a path rule to `.gitignore` to prevent recurrence.

### 9.6 Two duplicate sets of RLS policies on `photos`
DB shows BOTH "Admins can insert photos" / "Admins can delete photos" (legacy from older migration) AND `photos_admin_write` / `photos_admin_delete` (newer). Not a security issue (they're both restrictive) but noise. Same on `videos` and `storage.objects`.
**Fix:** drop the legacy named policies in a cleanup migration once you're sure nothing depends on names.

## P2

### 9.7 `.gitignore` doesn't cover `.expo` / `.eas` per-machine artifacts beyond what's listed
Inspect after first non-solo PR.

### 9.8 No CI / no automated tests beyond two utility tests
`mobile/package.json` declares jest for `isOpenNow.test.ts` + `formatWhatsApp.test.ts` only. No CI runs them.
**Fix:** GitHub Actions running `pnpm test` + `pnpm typecheck` on every PR. Low effort, high payoff.

---

# Domain 10 — Third-pass deep findings (auth, onboarding, root layout, web shell, env) *(new in v2 — added after the merge)*

## P0

### 10.1 Onboarding preferences are essentially never written to the DB
[mobile/app/onboarding/preferences.tsx](mobile/app/onboarding/preferences.tsx) line ~39 writes `preferred_vibes` and `preferred_zones` to `profiles` *only if a session exists* (`if (session) { ... }`). But the onboarding flow runs gated on AsyncStorage `ONBOARDING_KEY === 'true'`, which is set AT THE END of onboarding. The user is virtually never logged in when this code runs. The DB columns added by migration 008 are dead — they exist but nothing populates them.
**Fix:** either (a) make onboarding happen AFTER first login (re-order flow), or (b) when a logged-out user finishes onboarding, store preferences in AsyncStorage, then on first successful sign-in, migrate them into `profiles`. (b) is the lighter change.

### 10.2 Web admin gates on `is_admin` only, never `role = 'admin'`
[web/proxy.ts](web/proxy.ts) lines 40 and 52, and [web/app/auth/callback/route.ts](web/app/auth/callback/route.ts) line 46 all `SELECT is_admin`. There is no `OR role = 'admin'` fallback. If you ever onboard a founder/admin via the newer `role` field (added in migration 009) without also flipping the legacy `is_admin` column, they get locked out of the web admin without an obvious reason. This is the v1 1.8 "dual source of truth" finding actually causing a real lock-out path.
**Fix:** change both queries to `SELECT is_admin, role`, and check `profile?.is_admin || profile?.role === 'admin'`. Or canonicalize on one column and migrate.

### 10.3 Web app metadata is the Next.js scaffold default
[web/app/layout.tsx](web/app/layout.tsx) lines 16–19: `title: "Create Next App"`, `description: "Generated by create next app"`. The browser tab shows "Create Next App" and any social-share preview uses the same. Also `<html lang="en">` is hardcoded, so the entire web admin is declared English to screen readers and Google.
**Fix:** set proper title/description (e.g. `"O'Kili Admin"`, `"O'Kili — admin dashboard"`), favicon, and dynamic `lang` if/when the admin is bilingual.

## P1

### 10.4 No global error boundary, mobile or web
Grep across `mobile/app`, `mobile/components`, `web/app` finds no `ErrorBoundary` component, no `componentDidCatch`. Any uncaught render error crashes the entire app to a blank screen.
**Fix:** add `react-error-boundary` and wrap the top-level Stack on mobile and `RootLayout` on web. Pair with Sentry from 5.3 to capture the error.

### 10.5 No `.env.example` documenting required env vars
The app requires (at minimum): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`, `GOOGLE_MAPS_API_KEY_IOS`, `GOOGLE_MAPS_API_KEY_ANDROID`, plus on web: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. None are listed in a `.env.example` or README. New collaborator (or future-you) cannot bootstrap from a fresh clone.
**Fix:** add `mobile/.env.example` and `web/.env.example` with every required key + a comment about where to find each value.

### 10.6 Hardcoded vibes list bypasses i18n
[mobile/app/onboarding/preferences.tsx](mobile/app/onboarding/preferences.tsx) line 15–16 has two parallel `VIBES_FR` and `VIBES_EN` arrays. The values are stored in the DB as strings; if you ever add a vibe, you must edit code in two places and the historical user data uses the old strings. The right shape is `VIBES = [{ id: 'restaurants', fr: 'Restaurants', en: 'Restaurants' }, ...]` stored under stable IDs.
**Fix:** introduce a stable-ID list either in code or (better) as a small `vibes` table in the DB. Render label from the user's current language.

### 10.7 25+ inline `lang === 'fr' ? 'X' : 'Y'` ternaries instead of `t()`
Found across admin/coupons, admin/users, place detail, restaurant-admin, place form, video card, reviews bottom sheet. The i18n key sets are perfectly synced (97 keys each, grep-verified) but a lot of UI strings bypass them. Adding a third language requires touching every screen.
**Fix:** introduce common keys (`common.cancel`, `common.save`, `common.delete`, `common.edit`) and migrate. Mechanical.

### 10.8 OAuth Google flow on mobile has a fragile URL parser
[mobile/app/auth/login.tsx](mobile/app/auth/login.tsx) lines 157–162: the callback URL is split on `?`, then a `URLSearchParams` is created, then `.get('code')?.split('#')[0]`. This works today but relies on Supabase returning the code in exactly that shape. If Supabase changes the format (or adds a new param), this silently extracts the wrong value and `exchangeCodeForSession` fails with a confusing error.
**Fix:** use `expo-auth-session` or `Linking.parse(url)` instead of manual splitting.

### 10.9 No retry / state indicator after email-confirm sign-up
[mobile/app/auth/login.tsx](mobile/app/auth/login.tsx) lines 89–95: after signup, if Supabase requires email confirmation, the user gets an Alert and is left on the login screen — still in `mode: 'register'`. They have to manually switch to `login` mode and re-enter credentials after confirming. No "click to log in once confirmed" CTA, no auto-switch.
**Fix:** after the Alert, set `mode='login'` and pre-fill the email; show a banner "Confirm your email then sign in below."

## P2

### 10.10 `.single()` calls without consistent error handling
Many web routes use `.single()` (throws on 0 or >1 rows) where `.maybeSingle()` (returns null on 0) would be safer. Examples: `web/app/admin/places/[id]/page.tsx:19`, `[id]/videos/page.tsx:23`, `[id]/photos/page.tsx:25`, `auth/callback/route.ts:46`. The callback's `.single()` will throw if the trigger that creates `profiles` hasn't fired yet on a brand-new Google login, producing a `not_admin` redirect instead of a clean error.
**Fix:** use `.maybeSingle()` everywhere and handle `null` explicitly.

### 10.11 Three Supabase client factories on web
`web/lib/supabase.ts`, `web/lib/supabase-browser.ts`, `web/lib/supabase-server.ts` all exist. Easy to drift over time (different cookie handling, different env-var names).
**Fix:** if one is unused, delete it. Otherwise document which to import where.

### 10.12 Mobile root layout doesn't refresh `onboardingDone` on auth change
[mobile/app/_layout.tsx](mobile/app/_layout.tsx) `init()` reads AsyncStorage once. `onAuthStateChange` invalidates queries but does not re-read `ONBOARDING_KEY`. If a user signs out, the layout still thinks onboarding is done. In practice, sign-out flows return to non-tab routes so this isn't user-visible — but worth noting.

### 10.13 ThemeContext has a brief default-theme flash
[mobile/contexts/ThemeContext.tsx](mobile/contexts/ThemeContext.tsx) sets `theme='clean'` initially, then loads from AsyncStorage in `useEffect`. First render uses 'clean' colors regardless of saved choice. Users on `dark` or `vibrant` see a flash.
**Fix:** delay rendering children until AsyncStorage read completes, or use SyncStorage equivalent.

### 10.14 `StatusBar` logic doesn't distinguish 'vibrant' from 'clean'
[mobile/app/_layout.tsx](mobile/app/_layout.tsx) `<ThemedStatusBar>` checks `theme === 'dark' ? 'light' : 'dark'`. 'vibrant' falls into the 'dark text' branch — fine if vibrant uses a light background, but verify.

---

# Prioritized action list

This is one possible sequencing. Order is "ship safely" first, "run the platform" second, "real B2B" third.

## Pre-launch P0 (block App Store / Play Store / safe to open)

1. [1.1, 1.7] Profile-edit + restaurant-owner account-settings + [1.2] account-deletion (Apple requirement).
2. [1.3] Users page on web admin.
3. [1.4] Block/suspend mechanism.
4. [1.5] Lock down `profiles_public_read` (security).
5. [2.3, 2.4] Fix the restaurant-owner storage upload policy + set bucket size/mime limits.
6. [2.5] Re-enable Gabon bounds check.
7. [3.1, 5.1, 5.2] Push + in-app notifications + close the redemption loop.
8. [3.2, 3.3] Welcome-credit email-confirmation gating + IP/domain referral guard.
9. [5.3] Sentry on mobile + web.
10. [4.3] Server-side tier-limit enforcement (triggers on photos + coupons).
11. [2.1, 2.2] Publish gate (≥1 photo) + storage cascade cleanup.
12. [9.1] Fix function `search_path` advisor warnings.
13. [9.4, 9.5] Delete `.ips` files and the Windows-path artifact; update `.gitignore`.
14. [10.1] Fix onboarding-preferences DB write path (currently dead).
15. [10.2] Web admin: accept `role='admin'` as well as `is_admin`.
16. [10.3] Web app metadata (title, description, favicon, `lang`).
17. [10.4] Global error boundary on mobile + web (paired with Sentry 5.3).

## Launch week P1 (run the platform)

14. [5.4] Admin audit log.
15. [5.5] Abuse reports + moderation queue.
16. [2.6] Owner claim flow.
17. [3.8, 3.9] Owner redemption-history + user credit-history screens.
18. [3.6, 3.7] Redemption modal timeout + logged-out coupon CTA.
19. [3.5] Coupon dispute / reversal path.
20. [4.2, 2.13] Nightly tier-expiry job + promoted-place auto-demote.
21. [5.7] Ops dashboard.
22. [6.1] FR translation for web admin.
23. [6.3] i18n persistence across restarts.
24. [2.7, 2.8] Reviews + favorites cleanup when place is deactivated.
25. [2.9] Owner-reply moderation.
26. [9.2] EAS submission config.
27. [10.5] `.env.example` files for mobile + web (developer bootstrap).
28. [10.8] Replace fragile OAuth URL parser with `Linking.parse()`.
29. [10.9] Post-signup confirm-email banner + auto-switch to login mode.
30. [10.6, 10.7] Migrate inline `lang === 'fr' ? ...` ternaries to `t()` keys; stabilize vibe IDs.

## Phase 2 (real B2B + polish)

27. [4.4] Owner metrics card.
28. [4.5] Multi-place owner.
29. [4.7] Sales pipeline.
30. [2.10, 2.11, 2.12] Categories/zones admin CRUD + mobile video upload + place-reports.
31. [5.6, 5.8, 5.9] Realtime activity feed + Help screen + transactional email.
32. [7.1, 7.3, 7.4, 7.5] Search breadth + map clustering + place-detail videos + reviews pagination.
33. [6.4–6.11] UX-state polish — loading skeletons, empty states, error UI, toast feedback, confirmations, a11y labels.
34. [5.10, 7.2] Branch.io smart links + search-as-you-pan.

---

## Closing note

The codebase is in much better shape than the original question implied. Most domains have the data and the plumbing; what's missing is **the closure of every loop on the user-visible side** plus **the server-side honest layer** (tier enforcement, RLS column-scope, abuse prevention).

The structural thing worth committing to before any further feature work: build `notifications` + `push_tokens` + `send_push` Edge Function as a single shared pattern. Every future cross-actor feature (coupon redeemed, review replied, claim approved, tier expiring) then inherits "the user gets told" for free instead of reinventing it.

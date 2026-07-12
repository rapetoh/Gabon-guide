# O'Kili — Full Verification Pass

**Date:** 2026-07-12
**Run by:** Claude, autonomously, against the live Supabase project (`fvmzsxmlpwvtnszmuowc`) + local codebases.
**Method:** static checks (TypeScript, tests, production build), then live database simulations of every money/auth/security path (each in a rolled-back transaction so no live data was touched), then a real signed-in HTTP replay of the app's own queries, then web-admin route checks.

---

## Verdict

The backend and both apps are in good shape. I ran the full engine — signup, referral rewards, coupon redemption, credit, account deletion, blocking, privacy — as real users and it behaves correctly. I found **3 real bugs and 1 config gap**. I fixed the 3 bugs and re-tested each. The config gap is a Supabase dashboard toggle only you can flip.

This does **not** replace the on-device tapping in `TEST_PLAN.md` — screens, buttons, camera, and the live QR scan still need a human. What I verified is that everything *underneath* those screens is wired correctly.

---

## What I fixed (applied + re-tested)

### 1. Account deletion crashed for anyone who wrote a review — FIXED (ship-blocker)
- **Was:** deleting your account runs a database function that detaches your reviews (so they survive under your saved name). But the `reviews.user_id` column was still marked "required", so the detach hit a wall and the whole deletion **failed** for any user who had ever posted a review. This is the exact Apple-App-Store-required flow.
- **Fix:** migration `030`. Allowed the column to be empty-for-deleted-authors, with a guard so a review always keeps *either* a live author or a saved name.
- **Re-tested:** created a user, gave them a review, deleted the account → account gone, review still visible under "Jean Test". ✓

### 2. Restaurant owners couldn't upload photos or videos — FIXED
- **Was:** the storage permission rule for owners compared the wrong thing (a restaurant's *display name* instead of the uploaded file's folder), so owner uploads were silently rejected — only admins could upload. (Audit had flagged this as suspected; I proved it.)
- **Fix:** migration `031`. Rewrote the four owner upload/delete rules to match the file's folder against the places that owner actually owns.
- **Re-tested:** as the owner of Le Patio, upload to their own place folder now **succeeds**, upload to another restaurant's folder is **denied**. ✓

### 3. Storage buckets had no size or file-type limits — FIXED
- **Was:** `place-photos` and `place-videos` accepted a file of any size and any type (a 5 GB blob, or an executable renamed `.jpg`).
- **Fix:** migration `031`. Photos capped at 5 MB and restricted to image types; videos capped at 50 MB. (Existing photos are <420 KB, videos <11 MB, so nothing is affected. Video *type* was left open on purpose to avoid breaking the current upload path — a smaller follow-up.)

### 4. Web admin lock-out risk — FIXED (preventive)
- **Was:** the web admin door checked only the legacy `is_admin` flag, not the newer `role='admin'`. Both your current admins have the flag, so nobody was locked out — but a future admin created the modern way would have been.
- **Fix:** both the door (`web/proxy.ts`) and the Google-login callback now accept either. Web still typechecks and builds. ✓

> The 3 database fixes are **already live** in Supabase (migrations 030 + 031). The 2 web-code fixes are saved on disk on branch `dev`, not committed — commit when you're ready.

---

## What I verified as working (no change needed)

- **Signup + welcome/referral credit, Google path:** new user + referrer each get exactly the set amount, once — no double-pay. ✓
- **Anti-fraud gating:** with email-confirmation *required*, a referral pays **0** until the email is confirmed, then pays both sides exactly once. The database logic is correct. **(But see the config gap below — it's currently not being enforced.)**
- **Account deletion cascade:** profile, favorites, credit all removed; reviews preserved under saved name; coupon history detached not destroyed. ✓
- **Coupon redemption math:** 5% on a 10 000 bill = 500 discount; credit applied on top; customer-pays correct. ✓
- **Coupon guards:** expired coupon rejected, already-used rejected, wrong-restaurant rejected, mixed-customers rejected — all server-side, can't be bypassed by a hacked app. ✓
- **Platform ("Promo O'Kili") coupons:** "selected restaurants" works only at chosen places and is rejected elsewhere; "all restaurants" works everywhere; discount math correct. ✓
- **Privacy lockdown:** a regular user reading another user's full profile row gets **nothing** (email, admin flag, referral code all hidden), but still sees names/avatars through the safe view. Verified through the **real HTTP API** with a genuine signed-in token, not just internally. ✓
- **Blocking:** a blocked user can still browse but is refused reviews/favorites/coupon-claims; a normal user is allowed. ✓
- **Admin data access:** admin sees all 6 users and the full credit ledger; a regular user is limited to their own. ✓
- **Web admin gate:** unauthenticated `/admin` and `/admin/users` redirect to login; tab title reads "O'Kili Admin". ✓
- **Static health:** mobile TypeScript ✓, web TypeScript ✓, mobile tests ✓, web production build ✓.
- **Query safety:** all coupon↔place queries use explicit foreign-key names, so the PGRST201 ambiguity that bit us before cannot recur in the current code. ✓

---

## Founder-only items (I can't do these; you can)

### A. Decide on email confirmation (important — affects anti-fraud)
Right now **"Confirm email" is OFF** in your Supabase Auth settings: a new email/password signup is confirmed instantly. That means the anti-fraud gating (which works perfectly in code) is **not actually active** — someone could still farm referral credit with throwaway emails, and `TEST_PLAN` tests A-1/F-2 ("check your inbox") won't behave as written.
- **To turn it on:** Supabase dashboard → Authentication → Providers/Email → enable **Confirm email**. You'll also want email sending configured (the built-in sender is rate-limited; for real volume add an SMTP provider like Resend or SendGrid).
- **If you leave it off:** simpler signup, but accept the referral-farming risk and update those test expectations.
- **My recommendation:** turn it on before launch — the whole gating system was built for it.

### B. Two optional security hardening toggles (dashboard)
- **Leaked-password protection** (blocks known-breached passwords): Authentication → Policies → enable. One click, no downside.
- The GraphQL-schema-visible-to-anon advisory is low-risk (it exposes table *shapes*, not data — your RLS still guards the data). Safe to leave for post-launch.

### C. The on-device test plan still needs a human
Everything in `TEST_PLAN.md` sections A–I that involves *tapping, seeing, and scanning* — the live QR coupon scan especially. The plumbing under all of it is verified; the touch-and-camera layer is yours to walk through on the iPad + simulator.

### D. Live coupon data note (not a bug)
Your current Le Patio coupons are mostly **expired or have no discount value**, so a live redemption test today would show 0 or fail on expiry. Create a fresh coupon with a real percentage/amount (admin → coupons) before testing E-3.

---

## Not addressed here (known roadmap, from the audit — not regressions)
Push notifications, Sentry crash reporting, server-side tier-limit enforcement, the "publish needs a photo" gate, and the nightly tier-expiry job are still open items from `LOGIC_AUDIT.md`. None of them break what exists today; they're build-forward work, out of scope for a "is what we have wired correctly" pass.

# O'Kili — Global Product-Logic Audit

**Date:** 2026-07-12
**Run by:** Claude — six parallel deep reviews (customer journey, owner journey, admin/operations, money system, edge cases & failure states, docs-promises vs reality), every finding verified in code before being reported. Overlapping findings from independent reviewers were merged.
**Question answered:** "Is the app coherent as a whole, and can it go to production without major problems?"

---

## Verdict

**Not yet — but the gap is finite, known, and mostly small.** The engine underneath (redemption atomicity, credit math, privacy rules, blocking, bilingual UI) is genuinely solid. What's broken is a specific set of product-logic gaps: **5 code blockers** that kill core flows for real users (several were invisible in testing because the test account is an admin), a set of money-system holes that let people spend more than budgeted, and a batch of "the app promises X but never does X" incoherences. Nothing here is architecturally deep; almost everything is a contained fix.

---

## BLOCKERS — core flows that do not work today

**B1. The counter scanner still rejects platform "Promo O'Kili" coupons.**
Migration 034 fixed the database side, but the scanner's own screen has a client-side check comparing the coupon's restaurant to the owner's — platform coupons have no restaurant, so every valid platform QR gets "Ce coupon est d'un autre restaurant." The flow is still dead end-to-end.
`mobile/app/restaurant-admin/scanner.tsx:106` — fix: let a null placeId pass (server enforces scope).

**B2. Real owners cannot scan a customer's credit QR at all.**
The scanner reads the customer's profile and credit balance directly, but privacy rules (RLS) only allow the customer themselves or an admin to read those. A real owner gets "Utilisateur introuvable" / "Crédit indisponible" every time. **It works when the founder tests because the founder's account is an admin** — the same masking that hid B1.
`mobile/hooks/useCouponRedemption.ts` (`fetchCreditScanDetails`) — fix: a SECURITY DEFINER RPC for owner credit-scan lookup, mirroring migration 034's approach.

**B3. "Forgot password" permanently locks users out.**
The reset email links to `okili://reset-password` — a screen that does not exist anywhere in the app. Anyone who forgets their password can never get back in.
`mobile/app/auth/login.tsx:130` — fix: add `app/reset-password.tsx` consuming the recovery token.

**B4. No coupon can ever be edited after creation — by anyone.**
Wrong discount, wrong date, typo: the only remedy is delete + recreate. Web admin list has no actions at all; mobile admin has only delete; owners can only toggle active. The database already permits edits — the UI was never built.
`web/app/admin/coupons/page.tsx`, `mobile/app/admin/coupons/index.tsx` — fix: an edit screen reusing the create form.

**B5. Deleting a coupon silently erases its entire redemption history — and the dialog claims the opposite.**
`coupon_redemptions.coupon_id` is ON DELETE CASCADE, so deleting a coupon wipes every claim/redemption row; stats and the activity feed shrink retroactively. The mobile confirm dialog says "Les rachats déjà effectués restent enregistrés" — which is false.
Migration 014 line 162, `mobile/hooks/useCoupons.ts:365` — fix: soft-deactivate instead of delete (or FK → RESTRICT), and correct the dialog.

**B6. The Map opens on Port-Gentil, not Libreville.**
The constant labeled "Libreville city center" holds Port-Gentil's coordinates (~150 km away). Every user opening the Map tab sees ocean and zero pins; the recenter button flies to the same wrong spot.
`mobile/app/(tabs)/map.tsx:22` — fix: one line (`0.4162, 9.4673`) or fit-to-markers.

**Launch gates that are not code:** content is far below the PRD's launch bar (14 places, 3 mostly-expired coupons, 2 reviews vs "50+ verified listings"); Supabase must be on the Pro plan before launch (free tier auto-pauses); the web admin is not deployed anywhere (TEST_PLAN still says localhost); PostHog analytics silently no-ops if the env key is missing — verify events arrive from the production build.

---

## MAJOR — the money system can leak

1. **Coupon quotas are never enforced server-side.** "First 100 customers" is checked only in the app, at claim time, counting the wrong thing. All claims AND redemptions above the cap succeed; a modified app can skip checks entirely (RLS still allows direct claim inserts). A restaurant can end up honoring several times its budgeted discounts. Fix: count + enforce caps inside `apply_redemption_session` under lock.
2. **Referral credit is an uncapped faucet.** Each fake signup nets ~2,000 FCFA of real spendable credit (both sides), unlimited per referrer, farmable with throwaway emails even with email confirmation ON. Delete-account → re-signup also re-farms. Fix: cap rewarded invites per referrer + basic velocity guard.
3. **Account deletion destroys settlement records.** A deleted user's credit-spend rows (which carry the restaurant ID you'd use to reimburse restaurants) are CASCADE-deleted. Coupon-discount records survive; credit-spend records don't. Fix: FK → ON DELETE SET NULL like coupon_redemptions.
4. **Pure-credit payments can be double-charged.** If the network drops after a credit-only apply succeeds, the owner sees an error and retries — deducting the customer's credit twice (coupon sessions are safe; credit-only sessions have no idempotency guard). Fix: idempotency key in the RPC.
5. **Owner self-dealing is open.** An owner can review their own restaurant, claim their own coupons, and scan their own credit at their own counter — combined with (2), a free-money loop if the platform reimburses credit spends. Fix: reject self-redemption in the RPC; hide the review form on owned places.

## MAJOR — the growth loop is broken

6. **Shared links are dead for anyone without the app.** Shares send `okili://place/<id>` — not tappable in WhatsApp (the primary channel), no web fallback, no store link. The app's main viral loop produces dead ends. Fix: share an https URL (small web place page on the existing Vercel project) that deep-links or falls back.
7. **Google/Apple signups can never enter a referral code.** The code field exists only in the email/password form. Friends who take the easiest signup path get nothing, the referrer gets nothing, nobody knows why. Fix: one-time "Have a code?" prompt after first OAuth login.
8. **Platform coupons are a dead-end in the user's wallet.** The wallet card for a "Promo O'Kili" coupon can't be tapped and shows no QR; scoped promos are mislabeled "Valable dans tous les restaurants" and get refused at out-of-scope counters. Fix: wallet cards open the QR modal; show real scope.

## MAJOR — users can't trust what they see

9. **Failed actions are silent.** Reviews, review deletion, and favorites have zero error handling — offline or blocked users see a spinner stop and nothing else. Blocking (whose entire UX is "you get refused with a message") shows no message. Fix: onError alerts on five mutations.
10. **Network failure masquerades as empty content.** Every screen shows "Aucun lieu trouvé" / "Lieu introuvable" / "Aucun favori" when the network fails — users will think data was deleted. The `errors.offline` translations exist and are never used. Fix: branch on isError + retry button.
11. **Favorites and the Map only ever show the 20 newest places.** Both use page 1 of a paginated query and never fetch more. Past 20 listings, favorited places silently vanish and map pins disappear — reads as data loss. Fix: query favorites directly; give the map its own lightweight full query.
12. **The account-deletion promise is broken.** The dialog promises "your reviews stay under your first name"; the backend saves the name, but no query ever reads it — deleted users' reviews show "Utilisateur." Fix: select + display `author_display_name`.
13. **The video feed is expensive on prepaid data.** Up to 3 videos buffer at once, thumbnails exist but are never used as posters, no data-saver. On 1,000 FCFA/GB this burns goodwill in week 1. Fix: poster images + only attach video to the active card.

## MAJOR — promises to restaurants that aren't real yet

14. **Owners can't edit their opening hours** (admin-only today) — Eunice's base-tier promise and the PRD's #3 must-have.
15. **"Nombre de vues" stats don't exist anywhere** — promised at the free tier; nothing is shown to owners at any tier.
16. **Premium "Top de Liste" (top-3 in category) is not implemented** — search orders by newest only. Don't sell it until it exists (Trending Now placement does work).
17. **Upgrade is a dead end** — "À débloquer" cards have no button, price, or contact path; and a restaurateur who finds their own restaurant in the app has no "this is my restaurant" path. Both funnels end in nothing. Fix: WhatsApp/contact CTA on both.

## MAJOR — you can't operate the platform

18. **No way to remove an abusive/defamatory review** — no admin policy, no UI. Blocking stops future posts only; the review stays up until you hand-write SQL.
19. **No way to grant/adjust user credit** — the ledger supports `admin_adjust`, both activity feeds render it, but nothing can create one. Compensating a user after a bug = manual SQL on two tables.
20. **Admin can't stop a rogue place coupon** (delete button is platform-only; web has no actions) **and can't create a coupon for a specific restaurant.**
21. **Admin can't use the scanner at all** (role-gated to owners) — you can't demo redemption to a partner or cover a restaurant with no owner account; a "valid at all restaurants" promo is really valid only where an owner has a working login.
22. **Deleted places are unrestorable from the UI, and their live coupons linger in user wallets** pointing at a place that no longer exists.
23. **The web admin is English-only** — the partner/staff-facing tool is in the wrong language for Gabon.
24. **The Google Directions API key ships in client URLs** — extractable, unrestrictable for web-service calls, billable if scraped. Proxy through an edge function or drop in-app routing.

---

## MINOR (fix opportunistically)

- Language choice doesn't survive restart (`lib/i18n.ts` — no persistence).
- Apple sign-in ignores the redirect param — user loses their place (`login.tsx:202`).
- Password-change section shown to OAuth users who have no password (`account/edit.tsx`).
- "Ouvert" filter can falsely show an empty feed once a page of 15 is all-closed (`useVideoFeed` pagination).
- `isOpenNow` throws on partial `hours` JSON — one SQL-written row could crash feed render (`utils/isOpenNow.ts:46`).
- "Apple Maps" offered on Android; does nothing.
- Location permission denied = silent no-op; GPS-off = unhandled rejection ("Près de moi", "Itinéraire").
- Review text has no maxLength; emoji-leading names break the initial avatar letter.
- Coupon visibility trusts the device clock (server re-validates; confusion only).
- Coupon expiry stored as 23:59 UTC = 00:59 next day Gabon time (customer-favorable, cosmetic).
- Two-place owner degrades to "no restaurant linked" (`.single()` everywhere; no uniqueness constraint on `places.owner_id`).
- Owner sees redeemed counts but never claimed counts (demand signal invisible).
- Owner replies don't render in the video-feed reviews sheet (`ReviewsBottomSheet` omits `owner_reply`).
- Scanner errors can surface raw English to a French owner; success-then-network-loss looks like failure ("check history" hint missing).
- 1-FCFA rounding difference between scanner preview (round) and server (floor).
- Bill = 0 permanently burns coupons for zero discount, no confirmation.
- Onboarding collects zones/vibes nothing ever reads — effort for zero effect.
- Referral code not validated inline at signup (RPC exists, unwired) — typos silently cost the reward.
- Owner with role but no place: scanner opens but Apply is silently disabled forever.
- No error boundary at the app root; Supabase session auto-refresh lacks the AppState wiring.
- Duplicate migration filenames on disk (024/026/028 pairs — all applied live; ambiguous for replay-from-scratch). Menu PDF column exists, no UI. Weekly-feed hook/table are dead code. PRD/PLAN stale in places (reviews shipped, PostHog shipped, share/maps sheet shipped).

---

## Verified solid (checked and cleared)

- **Redemption engine:** atomic, row-locked, double-scan-proof; expired/used/wrong-place/mixed-customer all enforced server-side; platform-coupon scope honored in the RPC.
- **Credit floors/caps:** can't go negative, can't exceed the bill, coupon+credit rollback together.
- **Referral grant idempotent; self-referral structurally impossible.**
- **Privacy:** profiles lockdown verified over real HTTP; blocking enforced at RLS; admin gates on web and mobile both real.
- **Account deletion mechanics** (modulo the display-name and settlement-record findings): clean cascade, re-signup works.
- **Bilingual UI:** exact FR/EN key parity, consistent FCFA formatting, correct UTC+1 open-hours math regardless of device timezone.
- **Empty states, Android back button, camera/photo permission handling, WhatsApp link hygiene, 0-star prevention, one-review-per-place upsert.**
- **Owner provisioning UI exists** (role + place linking on web and mobile, contrary to the audit's fear); place lifecycle create→publish→edit coherent on both surfaces.
- **EAS/TestFlight pipeline live** (build #7 uploaded today, ascAppId pinned).

---

## Recommended order of attack

**Phase 1 — before any real owner or tester touches the counter flows (small fixes, 1 build):**
B1, B2, B3, B6 (scanner platform check, credit-scan RPC, reset-password screen, map coordinates) + the five silent-failure onError handlers (9) + deleted-reviews name display (12) + Apple sign-in redirect + i18n persistence.

**Phase 2 — before public launch:**
Money holes (1–5), coupon edit UI + soft-delete (B4/B5), share links with web fallback (6), OAuth referral entry (7), wallet platform-coupon QR (8), offline error states (10), favorites/map truncation (11), admin operations (18–22), owner hours editing (14), admin scanner access (21), Directions key proxy (24), deploy web admin, Supabase Pro, PostHog verification, content sprint.

**Phase 3 — first weeks after launch:**
Video data-saver (13), owner stats (15), top-de-liste or repitch (16), upgrade/claim CTAs (17), French web admin (23), the MINOR list, doc updates.

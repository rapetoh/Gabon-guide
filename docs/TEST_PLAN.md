# O'Kili — Manual Test Plan (pre-deployment)

**Date:** 2026-05-18
**For:** Roch — active device/browser testing before deployment
**Covers:** everything that exists in the app today, including all fixes from the 2026-05-17/18 session (account screen, privacy lock-down, welcome-credit gating, blocking, web Users page).

Check each box as you go: `[ ]` → `[x]`. If a test fails, note what you saw next to it.

---

## 0. Your test accounts (live data, as of today)

| Email | Role | Notes |
|---|---|---|
| rapetohsenyo@gmail.com | **Admin** | Your main account |
| eunicenadiay@gmail.com | **Admin** | Second admin (Eunice) |
| gadgetmaison021@gmail.com | **Restaurant owner** | Owns **Le Patio** — use for all owner tests |
| estellesovi6@gmail.com | Restaurant owner ⚠️ | **Has the owner role but owns NO place** — see test H-6 |
| rapetoh@hotmail.com | Regular user | Use for all "normal user" tests |
| (Apple private relay account) | Regular user | Sign-in-with-Apple account |

**Current content:** 14 places (13 published, 1 unpublished), 3 coupons (all at Le Patio), 2 reviews, 5 videos, 2 favorites. Every account currently has **0 FCFA credit** and **no display name set**.

### ⚠️ Three things I found in your live data that will affect your tests

1. **The referral reward is currently switched OFF** (`reward type: none`). Tests F-2/F-3 will "fail" until you turn it on. Fix first: web admin → **Referrals** → set reward type to *Welcome credit* and amount (e.g. 1000 FCFA) → save. This is also itself a test (H-4).
2. **Two of your three coupons have no discount value** ("-10% oui" and "-20% ouverture" were created before discounts became a real field — their titles say a percentage but the system has **no value stored**, so a redemption will compute **0 FCFA discount**). Either edit them and set real values, or expect 0 during tests E-3.
3. **estellesovi6@gmail.com has the owner role but no restaurant linked.** Her owner dashboard will look broken/empty. Use the new web Users page to either link her to a place or set her back to regular user (that's test H-6).

---

## A. Sign-up & sign-in (mobile)

**A-1. New account with email + password** — needs a fresh email address (or delete an old test account first via the new account screen).
- Steps: Profile tab → sign up with email, password, a full name → submit.
- Expected: message telling you to **check your inbox and click the confirmation link**. You cannot log in before clicking it. After clicking + logging in: you land back in the app, profile tab shows your name.

**A-2. Google sign-in.** Expected: browser sheet opens, pick account, returns to app logged in.

**A-3. Apple sign-in (iPhone only).** Expected: FaceID/native sheet, returns logged in.

**A-4. Log out and back in.** Expected: after force-quitting the app while logged in, reopening keeps you logged in (session survives restarts).

**A-5. Forgot password.** Steps: login screen → enter email → "Forgot password". Expected: reset email arrives.

---

## B. NEW — Account screen (mobile)

Log in as **rapetoh@hotmail.com** (regular user). Open Profile → **Mon compte / My account**.

**B-1. Set your name.** Enter a name (min 2 characters) → Save. Expected: "Enregistré ✓". Kill and reopen the app — the name is still there. *(All your accounts currently have no name — do this on each account you use, it also makes reviews look right.)*

**B-2. Avatar upload.** Tap the photo circle → pick a photo → it appears. Expected: photo visible immediately, still there after app restart. (Behind the scenes it's stored in a new `avatars` storage bucket, max 2 MB, images only.)

**B-3. Change email.** Enter a different email you control → "Changer l'email". Expected: confirmation email sent to the NEW address; the change only takes effect after you click that link.

**B-4. Change password.** Requires typing your CURRENT password + a new one (8+ chars). Expected: with a wrong current password → error "Mot de passe actuel incorrect"; with the right one → success, and next login only works with the new password.

**B-5. Delete account — the Apple-required flow.** ⚠️ Use a throwaway account, NOT your admin. Ideally: an account that has written a review first.
- Steps: Danger zone → Delete → confirm twice.
- Expected: you are signed out and back on the home screen. Logging in with that account no longer works.
- **Follow-up check:** the review that account wrote must STILL be visible on the place page, now attributed to the saved name (not vanished, not "anonymous crash").

---

## C. Browsing (mobile, works logged out too)

**C-1. Home feed.** Expected: video feed loads, category chips filter it, no blank screen.

**C-2. Explore search.** Type a place name (e.g. "Patio"). Expected: finds it. Note: search matches **names only** — searching a dish or description finding nothing is *normal today*, not a bug.

**C-3. Filters compose.** Category + zone + price + "Ouvert maintenant". Expected: results narrow with each filter; "open now" follows **Libreville time**, so test against a place whose hours you know.

**C-4. Map.** Expected: centers on Libreville, name-bubble pins, tapping a pin shows the card, tapping the card opens the place.

**C-5. Place page.** Expected: photos swipe, hours + open/closed badge correct, WhatsApp button opens WhatsApp with the right number, Call button dials, menu photos open fullscreen.

**C-6. Favorites.** Heart a place logged out → you're sent to login → after login, save works → place appears in Favorites tab → unheart removes it.

**C-7. Language toggle.** Profile → switch FR/EN. Expected: interface swaps language. ⚠️ Known limitation: the choice **resets after killing the app** (falls back to phone language) — that's on the fix list, don't count it as new breakage.

---

## D. Reviews (mobile)

**D-1. Post a review** as rapetoh@hotmail.com on Le Patio (stars + text). Expected: appears immediately with your name and correct star count; place's average updates.

**D-2. Reviewer names visible to everyone.** Log in as a DIFFERENT account (or browse logged out) → open the same place. Expected: you still see the reviewer's name and avatar on the review. *(This verifies the privacy fix didn't break name display — names/avatars are now served through a restricted view.)*

**D-3. Edit + delete your own review.** Expected: both work; average updates.

**D-4. Owner reply.** As gadgetmaison021@gmail.com → restaurant dashboard → Avis → reply to the review. Expected: reply saves. Back as the regular user: the reply is visible under the review on the place page.

---

## E. Coupons & credit (mobile — needs 2 devices or 1 device + patience)

Customer = rapetoh@hotmail.com. Staff = gadgetmaison021@gmail.com (owner of Le Patio).

**E-1. See coupons on the place page.** As customer, open Le Patio. Expected: the 3 active coupons show. ⚠️ Logged OUT the block is invisible (known gap — on the fix list).

**E-2. Claim a coupon → QR appears.** Expected: coupon shows a QR + code, sits in your Profile wallet as unused.

**E-3. Full redemption at the counter.**
- Customer: open the coupon QR.
- Staff (other device): restaurant dashboard → Scanner → scan the customer's QR → enter bill amount (e.g. 10 000) → apply.
- Expected — staff side: customer name appears after scan; totals screen shows bill, discount, what the customer pays. The "5% de reduction" coupon on a 10 000 bill = **500 FCFA discount**. The two valueless coupons (see warning #2 above) = **0 discount**.
- Expected — customer side: **if the QR screen is still open**, it flips to a success state live. ⚠️ If the customer already closed the QR, they get NO notification — known gap (push notifications not built yet), don't count as new breakage.
- Follow-up: coupon now marked used in the wallet; trying to scan the same QR again → "already used" error.

**E-4. Credit QR (if any account has credit).** Profile → credit QR → staff scans and applies a deduction. Expected: live success on customer's open screen; balance drops by the amount; the operation appears in the customer's activity history.

**E-5. Wrong-restaurant coupon.** If you create a coupon at another place (as admin) and present it at Le Patio's scanner. Expected: clear refusal — "coupon d'un autre restaurant".

---

## F. Referrals

**F-0. FIRST: turn the reward on** (see warning #1) — web admin → Referrals → Welcome credit + amount → save.

**F-1. Find your referral code.** Mobile profile shows your code. Expected: visible. (Copy/share button is a known missing nicety.)

**F-2. Sign up with a referral code — email path.** New throwaway email + the referrer's code, choose password → **do NOT click the confirmation link yet** → check as referrer: **no credit yet**. Then click the confirmation link → log in. Expected: **both** the new account and the referrer receive the reward amount, visible in profile + activity history. *(This is the anti-fraud fix: credit only lands after email confirmation.)*

**F-3. Sign up with a referral code — Google path.** Expected: credit lands immediately after signup (Google emails are pre-verified).

**F-4. Bad code.** Sign up with a made-up code. Expected: signup succeeds normally, nobody gets credit, no crash.

---

## G. Restaurant owner (mobile) — gadgetmaison021@gmail.com

**G-1. Dashboard.** Expected: shows Le Patio, tier badge, action buttons. (No stats/metrics card — known gap, not new breakage.)

**G-2. Edit place info + photos.** Change the description, add a photo. Expected: saves; visible on the public place page. ⚠️ If the photo upload FAILS with a permission/storage error, tell me — a storage security rule for owner uploads was flagged as possibly broken in the audit (admins unaffected).

**G-3. Create a coupon** (with a real percentage or amount!). Expected: appears on the public place page for customers.

**G-4. Scanner.** Covered by E-3.

**G-5. History.** After E-3, open Historique. Expected: today's redemption appears with bill + discount amounts; time filters work.

---

## H. Web admin — http://localhost:3000 (or your deployed URL)

Log in as rapetohsenyo@gmail.com.

**H-1. Login gate.** A NON-admin (rapetoh@hotmail.com) logging in → expected: rejected with "not admin", no access to /admin. Your admin account → lands on the dashboard. Browser tab reads **"O'Kili Admin"** (not "Create Next App").

**H-2. Places.** Open a place, edit a field, save. Upload + reorder photos, set primary, mark one as menu. Create a new place (must have category + zone; coordinates accept a pasted Google-Maps link). Unpublish a place → check it disappears from the mobile app's explore/home.

**H-3. Coupons.** Create a platform coupon, scope it to 2-3 places. Expected: shows on those places' pages in the mobile app, not on others.

**H-4. Referrals page.** Set the reward (F-0). Expected: totals at the top (links, credits issued/spent) are numbers, not zeros-forever; recent activity lists real transactions. *(This page previously could only see YOUR OWN transactions due to a permissions bug — fixed. If numbers still look impossibly small after F-2, tell me.)*

**H-5. NEW — Users page.** Sidebar → **Users**.
- Expected: all 6 accounts listed with name/email/join date/role badge; the counters on the filter chips add up; search by email fragment works.
- Open a user → expected: profile card, stats (reviews written, coupons used, current credit, lifetime credit), role selector, and the block switch.

**H-6. Fix Estelle (real data repair + test in one).** Open estellesovi6@gmail.com in Users.
- Either: keep owner role → pick a restaurant in the dropdown → save. Expected: logging in as her on mobile now shows that restaurant's dashboard.
- Or: set role to "Utilisateur" → save. Expected: owner dashboard gone for her.

**H-7. Role change round-trip.** Promote rapetoh@hotmail.com to owner + link a place → check mobile shows the owner dashboard → set back to user → dashboard gone.

**H-8. NEW — Block a user.** In Users, open rapetoh@hotmail.com → block switch ON → save.
- On mobile as that user: browsing still works, BUT posting a review → **refused with an error**; adding a favorite → refused; claiming a new coupon → refused.
- Unblock → all three work again.
- The Users list shows the red "Bloqué" badge while blocked.

**H-9. Activity page.** Expected: shows transactions from ALL users (not just yours) — e.g. the redemptions from E-3 made by rapetoh@hotmail.com.

**H-10. Tier settings.** Flip a feature off for a tier (e.g. coupons for Standard) → check the owner's mobile dashboard respects it → flip back.

---

## I. Mobile admin (quick pass — parity check)

**I-1. Admin section** visible for your admin account, invisible for a regular user.
**I-2. Users list + role editor** work (same behaviors as H-5/H-7).
**I-3. Create/edit a place from the phone,** photo from camera.
*(Note: the block switch exists only on the WEB Users page for now — the mobile users screen just shows what exists. If you want the toggle on mobile too, say so.)*

---

## J. Do NOT test (not built yet — known, on the roadmap)

- **Push notifications** (coupon scanned while app closed, etc.) — biggest next build.
- "Claim this restaurant" self-service flow for owners.
- Owner stats/metrics card ("views this week").
- In-app notifications inbox; support/help screen; report-a-place/review.
- Language choice surviving app restart (known bug, on the list).
- Coupon expiry warnings; credit history detail screen for users.
- Anything payments/subscriptions.

---

## If a test fails

Note: (1) test number, (2) account used, (3) what you saw vs. expected, (4) screenshot if easy. Bring the list back to me and I'll fix them in one pass.

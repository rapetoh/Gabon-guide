# O'Kili — External Services & Cost Overview

**Last Updated:** March 2026
This document lists every external service the app depends on, what we use it for, and the real cost.

---

## 1. Supabase
**What we use it for:** Everything backend — PostgreSQL database (all app data), authentication (email/password, Google, Apple), photo storage, Row Level Security policies.

| Tier | Price | Limits |
|---|---|---|
| Free | $0/month | 500MB DB, 1GB storage, 50MB file uploads, 2GB bandwidth/month, 50,000 MAU |
| Pro | $25/month | 8GB DB, 100GB storage, removes auto-pause, daily backups |

**Current status:** Free tier. Upgrade to Pro before launch — the free tier auto-pauses projects after 1 week of inactivity, which would break the app in production.
**Action required:** Upgrade to Pro ($25/month) before public launch.

---

## 2. Google Cloud Platform
**What we use it for:** Two separate things.

### 2a. Google OAuth (Login)
- Used for: "Continue with Google" sign-in in the mobile app and web admin
- **Cost: Free.** Google OAuth has no usage fee.

### 2b. Google Maps SDK
- Used for: The map screen in the mobile app (react-native-maps)
- Pricing: Google gives a **$200/month credit** automatically → covers ~28,500 map loads/month for free
- After the credit: $7 per 1,000 map loads
- **Realistic cost at MVP scale (< 1,000 users): $0/month** — well within the free credit
- **Action required:** Two API keys already configured (iOS + Android). Keys stored in `.env` — never committed to git.

---

## 3. Apple Developer Program
**What we use it for:** Required to submit to the App Store, enable Apple Sign-In, and build production iOS apps.

| Item | Cost |
|---|---|
| Apple Developer membership | **$99/year** (mandatory) |

**Status:** Must be active before TestFlight submission.
**Note:** This is non-negotiable — no Apple Developer account = no iOS app.

---

## 4. Google Play Developer
**What we use it for:** Required to publish to the Google Play Store.

| Item | Cost |
|---|---|
| Google Play Developer registration | **$25 one-time** |

**Status:** Pay once, publish forever. No annual fee.

---

## 5. PostHog
**What we use it for:** Product analytics — tracking events like `place_viewed`, `cta_whatsapp_tapped`, `filter_used`, etc. Tells you what users are actually doing in the app.

| Tier | Price | Limits |
|---|---|---|
| Free | $0/month | **1,000,000 events/month** — resets monthly |
| Paid | ~$0.0003/event | Above 1M events/month |

**Realistic cost at MVP scale: $0/month.** 1M events/month is enormous for a new app — you'd need ~33,000 daily active users each doing 1 event/day to hit the limit.
**Status:** Not yet integrated. Ready to set up — just needs a PostHog account and API key.
**Website:** posthog.com

---

## 6. Branch.io
**What we use it for:** Smart deep links for the Share button — if the recipient has O'Kili installed, the link opens the app directly on the right place. If not, it opens a web page with place info + download prompt.

| Tier | Price | Limits |
|---|---|---|
| Free | $0/month | Up to **10,000 MAU** |
| Starter | ~$59–299/month | Depends on MAU + features |

**Realistic cost at MVP scale: $0/month** — 10,000 MAU is more than enough for a Libreville launch.
**Important caveat:** Branch.io requires non-trivial setup:
- Account + dashboard configuration
- iOS Universal Links (Apple Developer Portal entitlements)
- Android App Links (intent filters)
- Cannot be fully tested without a production build (not Expo Go)

**Status:** Deferred. Setup will happen during Phase 6 (pre-launch), alongside EAS build configuration.
**Website:** branch.io

---

## 7. Vercel
**What we use it for:** Hosting the Next.js web admin dashboard (`/web`).

| Tier | Price | Limits |
|---|---|---|
| Hobby (Free) | $0/month | 100GB bandwidth, custom domain, generous for low-traffic tools |
| Pro | $20/user/month | Team features, more bandwidth |

**Realistic cost:** $0/month. The web admin is an internal tool used only by your team — Hobby tier is more than sufficient.
**Status:** Not yet deployed. Deployment happens in Phase 6.
**Website:** vercel.com

---

## 8. Expo / EAS Build
**What we use it for:** Building production iOS and Android app binaries (.ipa / .apk). You cannot submit to the App Store or Play Store without going through a proper build service.

| Tier | Price | Limits |
|---|---|---|
| Free | $0/month | 30 iOS builds + 30 Android builds/month, slower queue |
| Production | $99/month | Unlimited builds, priority queue, custom build workers |

**Realistic cost at MVP scale: $0/month.** 30 builds/month is plenty during development and initial launch — you won't be rebuilding the app more than a few times per month.
**Status:** EAS build config (`eas.json`) not yet written. Happens in Phase 6.
**Website:** expo.dev

---

## 9. WhatsApp (wa.me links)
**What we use it for:** The WhatsApp CTA button on place detail pages — opens a WhatsApp conversation with the venue's number.

- **Cost: Free.** This uses the public `https://wa.me/XXXX` URL scheme — no WhatsApp Business API, no account required.

---

## Summary Table

| Service | What for | Monthly Cost (MVP) | Action Required |
|---|---|---|---|
| Supabase | Database, Auth, Storage | **$0** (upgrade to $25 before launch) | Upgrade to Pro pre-launch |
| Google OAuth | Login with Google | **$0** | ✅ Already configured |
| Google Maps SDK | Map screen | **$0** (within $200 credit) | ✅ Already configured |
| Apple Developer | App Store + Apple Sign-In | **$8.25/mo** ($99/year) | Must be active |
| Google Play Developer | Play Store | **$2.08/mo** ($25 one-time) | Pay once |
| PostHog | Analytics | **$0** (up to 1M events) | Needs account + API key |
| Branch.io | Smart deep links / Share | **$0** (up to 10K MAU) | Complex setup — Phase 6 |
| Vercel | Web admin hosting | **$0** (Hobby tier) | Deploy in Phase 6 |
| Expo / EAS | Production builds | **$0** (30 builds/month) | Config in Phase 6 |
| WhatsApp (wa.me) | CTA button | **$0** | ✅ No setup needed |

**Total estimated monthly cost at MVP launch: ~$25/month** (Supabase Pro only).
**Annual fixed costs: ~$124/year** (Apple Developer $99 + Google Play $25 one-time).

---

## Notes
- All API keys and secrets are stored in `.env` files — never committed to git.
- Supabase free tier **will auto-pause** the project after inactivity. Do not launch on the free tier.
- Google Maps $200/month credit resets monthly and covers well beyond MVP scale.
- Branch.io and PostHog both have free tiers that are genuinely useful — not just trial periods.

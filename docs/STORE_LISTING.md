# App Store listing — O'Kili

Draft prepared 2026-07-17. Founder: review wording, then paste into App Store
Connect → App Information / the version page. Values marked ⚠ need a founder
decision or action.

## Identity

| Field | Value |
|---|---|
| App name | O'Kili |
| Subtitle (30 chars max) | FR: `Sortir au Gabon` · EN: `Going out in Gabon` |
| Bundle ID | com.okili.app (already registered, ASC app ID 6761446724) |
| Primary category | Food & Drink |
| Secondary category | Travel |
| Age rating | 4+ (questionnaire: no restricted content; alcohol references are venue listings → answer "None" to alcohol *sale*; if reviewer pushes back, 17+ is the fallback) ⚠ |
| Privacy policy URL | https://okili-admin.vercel.app/privacy |
| Support URL | https://okili-admin.vercel.app/privacy (⚠ replace with a real support/landing page when one exists) |

## Description — FR (primary, Gabon storefront)

O'Kili, c'est le guide des bonnes adresses du Gabon : restaurants, bars,
brunchs, sorties en famille et soirées — le tout en vidéo.

DÉCOUVREZ
• Un fil vidéo des meilleurs établissements de Libreville et d'ailleurs
• Recherche par catégorie, quartier, budget et « ouvert maintenant »
• Fiches complètes : photos, menu, horaires, itinéraire, avis

PROFITEZ
• Coupons de réduction à faire scanner directement au restaurant
• Crédit O'Kili : parrainez vos amis, gagnez du crédit, dépensez-le
  dans n'importe quel établissement partenaire
• Notifications quand un coupon est validé ou qu'un crédit arrive

POUR LES ÉTABLISSEMENTS
• Répondez aux avis de vos clients
• Suivez vos statistiques : vues, appels, contacts WhatsApp
• Créez des coupons pour attirer de nouveaux clients

O'Kili est gratuit. Bonnes découvertes !

## Description — EN

O'Kili is the guide to the best spots in Gabon: restaurants, bars, brunches,
family outings and nightlife — all in video.

DISCOVER
• A video feed of the best venues in Libreville and beyond
• Search by category, neighborhood, budget and "open now"
• Full listings: photos, menu, opening hours, directions, reviews

ENJOY
• Discount coupons scanned right at the restaurant
• O'Kili credit: refer friends, earn credit, spend it at any partner venue
• Notifications when a coupon is redeemed or credit arrives

FOR VENUES
• Reply to customer reviews
• Track your stats: views, calls, WhatsApp contacts
• Create coupons to bring in new customers

O'Kili is free. Enjoy!

## Keywords (100 chars max, FR storefront)

`restaurant,gabon,libreville,bar,sortir,coupon,réduction,brunch,livraison,avis,guide`

## App Privacy (ASC questionnaire) — what we actually collect

- Contact info: email (account) — linked to identity
- User content: photos (profile avatar), reviews — linked to identity
- Identifiers: user ID — linked to identity
- Usage data: product interaction (PostHog, place_events) — linked to identity
- Location: precise location — used for app functionality (nearby places), NOT stored
- No tracking across other companies' apps (no ATT prompt needed)

## Remaining assets ⚠

- Screenshots: 6.9" (iPhone 17 Pro Max) + 6.5" sets — capture after build #12
  is on TestFlight; home feed, place page, coupons wallet, map, owner stats.
- App icon 1024×1024: already in repo (`mobile/assets/icon.png`).

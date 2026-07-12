-- Migration 030: make account deletion actually work for users who wrote reviews.
--
-- Ship-blocker found in full verification (2026-07-12):
-- Migration 027 changed reviews.user_id FK to ON DELETE SET NULL and added
-- reviews.author_display_name so a deleted user's reviews stay attributed.
-- BUT reviews.user_id was left NOT NULL. So delete_my_account() -> DELETE
-- auth.users -> cascade tries to SET NULL on the user's reviews -> the
-- NOT NULL constraint aborts the whole RPC. Result: any user who has ever
-- written a review CANNOT delete their account. This is the Apple
-- App-Store-required flow, so it blocks submission.
--
-- Fix: drop NOT NULL on reviews.user_id. A NULL user_id now means
-- "author deleted their account"; author_display_name preserves the name.
--
-- Guard: to keep review rows readable/attributable, ensure any row that
-- ends up with a NULL user_id has a non-null author_display_name. We use a
-- CHECK that a review must have EITHER a user_id OR an author_display_name
-- (both-null would be an orphan with no attribution).

ALTER TABLE public.reviews
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_attribution_present;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_attribution_present
  CHECK (user_id IS NOT NULL OR author_display_name IS NOT NULL);

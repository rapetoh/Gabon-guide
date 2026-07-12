-- Migration 028: remove leftovers from the superseded first draft of the
-- welcome-credit gating work. (Applied to the live DB on 2026-05-18; this
-- file is the local record of that change.)
--
-- Both 024 migrations were applied during an interrupted session:
--   * 024_gate_welcome_credit_on_email_confirm  (first draft)
--   * 024_welcome_credit_after_email_confirm    (rewrite — the live one)
--
-- The rewrite redefined handle_new_user / handle_email_confirmed to call
-- grant_referral_reward(), whose idempotency comes from checking for an
-- existing 'referral_signup' credit transaction. That left two dead
-- artifacts from the first draft:
--
--   1. grant_referral_credits(uuid) — no trigger or app code called it.
--   2. profiles.referral_processed_at — only the dead function wrote it;
--      the live function does not read or write it, and no app code
--      referenced it.
--
-- Verified before applying: zero references in mobile/, web/, or any live
-- function body.

DROP FUNCTION IF EXISTS public.grant_referral_credits(uuid);

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS referral_processed_at;

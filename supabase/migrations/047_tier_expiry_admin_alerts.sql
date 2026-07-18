-- 047: Tier-expiry alerts for ADMINS ONLY (founder request 2026-07-18).
--
-- Payments are collected outside the app, so the app must warn the admins
-- when a paid place's subscription is ending: once when it enters the last
-- 7 days ('soon'), once when it lapses ('expired'). Rows go through the
-- normal notifications pipeline (inbox + push on admin devices). Owners are
-- NOT notified — they already see the expiry hint on their own dashboard.
--
-- pg_cron runs the check daily at 06:00 UTC (07:00 Libreville). Dedup key:
-- (admin, place, milestone, expires_at) — renewing to a new date re-arms
-- both alerts for the next cycle. Email delivery is a future add-on once an
-- email provider (SMTP/Resend) exists; the founder tracks payments from
-- push + inbox until then.

ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'coupon_redeemed', 'credit_spent', 'credit_received',
    'referral_reward', 'review_reply',
    'new_review', 'new_coupon', 'place_activated',
    'tier_expiry'
  ));

CREATE OR REPLACE FUNCTION public.check_tier_expiries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, payload)
  SELECT
    a.id,
    'tier_expiry',
    jsonb_build_object(
      'place_id',   pl.id,
      'place_name', pl.name,
      'tier',       pl.subscription_tier,
      'expires_at', pl.subscription_expires_at::text,  -- ::text so the dedup comparison below matches exactly
      'milestone',  m.milestone,
      'days_left',  (pl.subscription_expires_at::date - current_date)
    )
  FROM places pl
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN pl.subscription_expires_at::date - current_date <= 0 THEN 'expired'
      WHEN pl.subscription_expires_at::date - current_date <= 7 THEN 'soon'
    END AS milestone
  ) m
  JOIN profiles a ON a.is_admin AND NOT a.is_blocked
  WHERE pl.subscription_tier <> 'free'
    AND NOT pl.is_deleted
    AND pl.subscription_expires_at IS NOT NULL
    AND m.milestone IS NOT NULL
    -- expired alerts stop repeating after a week past expiry
    AND pl.subscription_expires_at::date - current_date > -8
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = a.id
        AND n.type = 'tier_expiry'
        AND n.payload->>'place_id' = pl.id::text
        AND n.payload->>'milestone' = m.milestone
        AND n.payload->>'expires_at' = pl.subscription_expires_at::text
    );
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'tier-expiry-admin-alerts',
  '0 6 * * *',   -- daily 06:00 UTC = 07:00 Libreville
  $$SELECT public.check_tier_expiries()$$
);

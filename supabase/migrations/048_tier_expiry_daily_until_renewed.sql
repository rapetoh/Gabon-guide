-- 048: expired subscriptions nag admins DAILY until renewed (founder request
-- 2026-07-23).
--
-- 047 fired 'soon' once and 'expired' once, then went silent 8 days after
-- expiry — an unpaid restaurant could slip through if the admin missed two
-- notifications. New behavior:
--   • 'soon' (≤7 days left): still fires once per expiry date — a heads-up.
--   • 'expired': fires EVERY DAY, with no cutoff, until an admin renews
--     (sets a new subscription_expires_at, e.g. via the web dashboard's
--     Abonnements panel). Renewal changes the payload's expires_at, which
--     both re-arms 'soon' for the next cycle and ends the daily nag.
--
-- Same function name + pg_cron schedule as 047; only the dedup changes:
-- 'expired' now dedups per-day instead of forever.

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
      'expires_at', pl.subscription_expires_at::text,
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
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = a.id
        AND n.type = 'tier_expiry'
        AND n.payload->>'place_id' = pl.id::text
        AND n.payload->>'milestone' = m.milestone
        AND n.payload->>'expires_at' = pl.subscription_expires_at::text
        -- 'soon' warns once per expiry date; 'expired' re-fires daily
        AND (m.milestone = 'soon' OR n.created_at::date = current_date)
    );
END;
$$;

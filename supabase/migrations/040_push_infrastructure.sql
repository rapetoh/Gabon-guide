-- 040: Push notification infrastructure.
--
-- In-app notifications (039) are the single source of truth. This migration
-- adds the delivery layer: device tokens, the user's language for push text,
-- and an AFTER INSERT trigger on notifications that asks the send_push Edge
-- Function to deliver the row to the user's devices via Expo's Push API.
--
-- pg_net is async (queued HTTP from a background worker), so inserting a
-- notification never blocks or fails on network problems.
--
-- The Authorization header below is the project's ANON key — it is a public
-- client key (it ships inside the mobile app binary); it only satisfies the
-- Edge Function's verify_jwt gate. The function itself authorizes nothing
-- from the caller: it re-reads the notification by id with the service role
-- and marks pushed_at, so replaying the call cannot spam or forge content.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Device push tokens ──────────────────────────────────────────────────────
CREATE TABLE public.push_tokens (
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token      text NOT NULL,  -- ExponentPushToken[...]
  platform   text NOT NULL DEFAULT 'ios' CHECK (platform IN ('ios', 'android')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, token)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_tokens_own ON public.push_tokens
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.push_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;

-- ── Language for server-rendered push text ──────────────────────────────────
-- The in-app inbox renders text client-side in the current UI language, but
-- push text is composed server-side, so the choice must live in the DB. The
-- app writes this whenever the user switches language.
ALTER TABLE public.profiles
  ADD COLUMN preferred_language text NOT NULL DEFAULT 'fr'
  CHECK (preferred_language IN ('fr', 'en'));

-- ── Push dedup marker ───────────────────────────────────────────────────────
ALTER TABLE public.notifications ADD COLUMN pushed_at timestamptz;

-- ── Fire push on every new notification ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://fvmzsxmlpwvtnszmuowc.supabase.co/functions/v1/send_push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2bXpzeG1scHd2dG5zem11b3djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2Nzg0MjAsImV4cCI6MjA4OTI1NDQyMH0.pmKi6CJZHtyX59wQbEQvHvTI4CbpKSUsr5WbTFyLBUM'
    ),
    body    := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.push_on_notification();

-- 041: Owner metrics — raw engagement events + aggregated read API.
--
-- The app fire-and-forgets one row per meaningful engagement:
--   view      — place detail screen opened
--   whatsapp  — WhatsApp CTA tapped
--   call      — call button tapped
--
-- Raw rows are write-only for clients (no SELECT policy): owners read their
-- numbers through get_place_metrics(), which authorizes against
-- places.owner_id / is_admin() and returns zero-filled daily counts, so the
-- app never touches per-user rows. v1 counts repeat views by the same user;
-- good enough to show an owner their reach, revisit if it needs de-duping.

CREATE TABLE public.place_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  place_id   uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('view', 'whatsapp', 'call')),
  user_id    uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX place_events_place_time_idx
  ON public.place_events (place_id, created_at DESC);

ALTER TABLE public.place_events ENABLE ROW LEVEL SECURITY;

-- Anonymous browsing exists, so anon may log too. Insert-only either way.
CREATE POLICY place_events_insert ON public.place_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);

REVOKE ALL ON public.place_events FROM anon, authenticated;
GRANT INSERT ON public.place_events TO anon, authenticated;

-- ── Aggregated read API for the owner dashboard ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_place_metrics(p_place_id uuid)
RETURNS TABLE (day date, views bigint, whatsapp_taps bigint, calls bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM places pl
      WHERE pl.id = p_place_id AND pl.owner_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  RETURN QUERY
  SELECT
    d.day::date,
    count(*) FILTER (WHERE e.event_type = 'view'),
    count(*) FILTER (WHERE e.event_type = 'whatsapp'),
    count(*) FILTER (WHERE e.event_type = 'call')
  FROM generate_series(current_date - 6, current_date, interval '1 day') AS d(day)
  LEFT JOIN place_events e
    ON e.place_id = p_place_id
   AND e.created_at >= d.day
   AND e.created_at <  d.day + interval '1 day'
  GROUP BY d.day
  ORDER BY d.day;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_metrics(uuid) TO authenticated;

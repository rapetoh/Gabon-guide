-- Migration 015: Owner replies on reviews
-- Adds the ability for a place's owner (or admin) to publicly respond
-- to a review. Per the founder's PDF, this is a Base/Free-tier feature
-- — every restaurant owner gets it, regardless of subscription tier.

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS owner_reply text,
  ADD COLUMN IF NOT EXISTS owner_reply_at timestamptz;

COMMENT ON COLUMN public.reviews.owner_reply IS
  'Public text response from the place owner to this review. Visible to all readers.';
COMMENT ON COLUMN public.reviews.owner_reply_at IS
  'When the reply was last edited. Set automatically by the owner_reply update policy in app code.';

-- RLS: only the place owner (or admin) can update owner_reply on reviews
-- of their own place. We can't restrict UPDATE to specific columns at the
-- policy level in Postgres, so we expose a SECURITY DEFINER function instead
-- and grant ONLY that function the right to write the owner_reply column.
-- This keeps the rest of the row (rating, comment, user_id) untouched by
-- owners.

CREATE OR REPLACE FUNCTION public.set_review_owner_reply(
  p_review_id uuid,
  p_reply     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_place_id  uuid;
  v_owner_id  uuid;
  v_is_admin  boolean;
BEGIN
  -- Fetch the place owner for the review's place
  SELECT p.id, p.owner_id INTO v_place_id, v_owner_id
  FROM public.reviews r
  JOIN public.places  p ON p.id = r.place_id
  WHERE r.id = p_review_id;

  IF v_place_id IS NULL THEN
    RAISE EXCEPTION 'Review not found';
  END IF;

  -- Is the caller an admin?
  SELECT (is_admin = true OR role = 'admin') INTO v_is_admin
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT (v_owner_id = auth.uid() OR COALESCE(v_is_admin, false)) THEN
    RAISE EXCEPTION 'Not authorized: only the place owner or an admin can reply to this review';
  END IF;

  -- Empty / null string clears the reply
  UPDATE public.reviews
  SET owner_reply    = NULLIF(trim(p_reply), ''),
      owner_reply_at = CASE WHEN NULLIF(trim(p_reply), '') IS NULL THEN NULL ELSE now() END
  WHERE id = p_review_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.set_review_owner_reply(uuid, text) TO authenticated;

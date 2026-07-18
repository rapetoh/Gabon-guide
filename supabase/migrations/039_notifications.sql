-- 039: In-app notifications.
--
-- One row per user-facing event. The client renders the text from
-- (type, payload) so a notification always displays in the user's CURRENT
-- language — we never freeze French text into a row for a user who later
-- switches to English.
--
-- Rows are written exclusively by SECURITY DEFINER trigger functions on the
-- source-of-truth tables (coupon_redemptions, credit_transactions, reviews).
-- Clients can only read their own rows and set read_at.
--
-- Push notifications (migration 040) hang off this same table: an AFTER
-- INSERT trigger on notifications calls the send_push Edge Function, so
-- in-app + push are one system with one write path.

CREATE TABLE public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN (
               'coupon_redeemed',   -- your coupon was scanned+applied at a place
               'credit_spent',      -- credit deducted in a redemption session
               'credit_received',   -- credit granted (signup referral bonus, admin adjust)
               'referral_reward',   -- someone you invited signed up
               'review_reply'       -- an owner replied to your review
             )),
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at    timestamptz
);

CREATE INDEX notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx
  ON public.notifications (user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

-- Mark-read is the only client write. Column-level grants below stop a user
-- from rewriting type/payload even though this row-level policy passes.
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.notifications FROM anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;

-- ── Trigger 1: coupon redeemed ──────────────────────────────────────────────
-- apply_redemption_session (036) is the only path that flips redeemed_at.
CREATE OR REPLACE FUNCTION public.notify_coupon_redeemed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_place_name text;
  v_title_fr   text;
  v_title_en   text;
BEGIN
  IF OLD.redeemed_at IS NULL AND NEW.redeemed_at IS NOT NULL
     AND NEW.user_id IS NOT NULL THEN
    SELECT name INTO v_place_name FROM places WHERE id = NEW.place_id;
    SELECT title_fr, title_en INTO v_title_fr, v_title_en
      FROM coupons WHERE id = NEW.coupon_id;

    INSERT INTO notifications (user_id, type, payload)
    VALUES (
      NEW.user_id,
      'coupon_redeemed',
      jsonb_build_object(
        'place_id',         NEW.place_id,
        'place_name',       v_place_name,
        'coupon_title_fr',  v_title_fr,
        'coupon_title_en',  v_title_en,
        'discount_applied', NEW.discount_applied
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_coupon_redeemed
  AFTER UPDATE ON public.coupon_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_coupon_redeemed();

-- ── Trigger 2: credit movements ─────────────────────────────────────────────
-- credit_transactions is append-only and covers every credit event:
--   redemption_session (negative delta) → credit_spent
--   referral_invite                     → referral_reward (you = referrer)
--   referral_signup                     → credit_received (you = new user)
--   admin_adjust                        → credit_received (either sign)
CREATE OR REPLACE FUNCTION public.notify_credit_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type       text;
  v_place_name text;
BEGIN
  IF NEW.user_id IS NULL OR NEW.delta_fcfa = 0 THEN
    RETURN NEW;
  END IF;

  v_type := CASE NEW.reason
    WHEN 'redemption_session' THEN 'credit_spent'
    WHEN 'referral_invite'    THEN 'referral_reward'
    WHEN 'referral_signup'    THEN 'credit_received'
    WHEN 'admin_adjust'       THEN 'credit_received'
    ELSE NULL
  END;
  IF v_type IS NULL THEN
    RETURN NEW; -- unknown future reason: no notification rather than a wrong one
  END IF;

  IF NEW.place_id IS NOT NULL THEN
    SELECT name INTO v_place_name FROM places WHERE id = NEW.place_id;
  END IF;

  INSERT INTO notifications (user_id, type, payload)
  VALUES (
    NEW.user_id,
    v_type,
    jsonb_build_object(
      'delta_fcfa', NEW.delta_fcfa,
      'reason',     NEW.reason,
      'place_id',   NEW.place_id,
      'place_name', v_place_name
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_credit_transaction
  AFTER INSERT ON public.credit_transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_credit_transaction();

-- ── Trigger 3: owner replied to a review ────────────────────────────────────
-- set_review_owner_reply (015) is the only path that writes owner_reply.
CREATE OR REPLACE FUNCTION public.notify_review_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_place_name text;
BEGIN
  IF NEW.owner_reply IS NOT NULL
     AND NEW.owner_reply IS DISTINCT FROM OLD.owner_reply
     AND NEW.user_id IS NOT NULL
     AND NEW.user_id IS DISTINCT FROM auth.uid() THEN  -- replying to your own review: skip
    SELECT name INTO v_place_name FROM places WHERE id = NEW.place_id;

    INSERT INTO notifications (user_id, type, payload)
    VALUES (
      NEW.user_id,
      'review_reply',
      jsonb_build_object(
        'place_id',      NEW.place_id,
        'place_name',    v_place_name,
        'review_id',     NEW.id,
        'reply_excerpt', left(NEW.owner_reply, 140)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_review_reply
  AFTER UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_review_reply();

-- Migration 035: let restaurant owners look up a customer from a credit QR.
--
-- The scanner read profiles + credit_balances directly, but RLS only allows
-- own-row (018) or admin (029) reads of credit_balances, and profile reads
-- require a prior redemption relationship (025/034). So a real owner scanning
-- a customer's credit QR got "user not found" / balance 0 — the flow only
-- worked for admin accounts, which masked the bug in testing.
--
-- Same approach as migration 034: a narrow SECURITY DEFINER lookup, callable
-- only by admins and profiles that own at least one live place, returning
-- exactly the three fields the counter flow needs.

CREATE OR REPLACE FUNCTION public.get_credit_scan_details(p_user_id uuid)
RETURNS TABLE (full_name text, email text, balance_fcfa int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller   uuid := auth.uid();
  v_is_admin boolean;
  v_is_owner boolean;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT p.is_admin INTO v_is_admin FROM public.profiles p WHERE p.id = v_caller;
  SELECT EXISTS (
    SELECT 1 FROM public.places pl
    WHERE pl.owner_id = v_caller AND pl.is_deleted = false
  ) INTO v_is_owner;

  IF NOT COALESCE(v_is_admin, false) AND NOT v_is_owner THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  RETURN QUERY
  SELECT pr.full_name, pr.email, COALESCE(cb.balance_fcfa, 0)
  FROM public.profiles pr
  LEFT JOIN public.credit_balances cb ON cb.user_id = pr.id
  WHERE pr.id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_credit_scan_details(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_credit_scan_details(uuid) TO authenticated;

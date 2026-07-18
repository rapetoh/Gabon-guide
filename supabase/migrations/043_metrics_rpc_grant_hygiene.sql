-- 043: get_place_metrics was created with Postgres' default EXECUTE-to-PUBLIC
-- grant, so anon could invoke it over /rest/v1/rpc (it self-authorizes and
-- raises NOT_AUTHORIZED, but it shouldn't be reachable at all). Advisors
-- flagged it; owners/admins are authenticated, so only that role needs it.

REVOKE EXECUTE ON FUNCTION public.get_place_metrics(uuid) FROM PUBLIC, anon;

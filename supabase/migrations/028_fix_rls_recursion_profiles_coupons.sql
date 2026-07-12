-- Migration 028: fix infinite RLS recursion between profiles and the coupon tables.
--
-- Symptom: EVERY read of public.profiles (and of coupon_redemptions) failed with
-- 42P17 "infinite recursion detected in policy for relation profiles".
-- Web admin login always bounced to /login?error=not_admin because the
-- auth callback could not read is_admin for anyone; mobile reads of
-- profiles / coupon_redemptions were equally broken.
--
-- Cause: migration 025 added `profiles_owner_read_customers`, a SELECT policy
-- on profiles that subqueries coupon_redemptions/coupons/places. But the
-- SELECT policy on coupon_redemptions (and the FOR ALL policy on coupons)
-- checked admin-ship by subquerying profiles DIRECTLY. Postgres detects the
-- cycle profiles → coupon_redemptions → profiles and aborts.
--
-- Fix, two layers so this can't come back:
--   1. profiles policies must not reference RLS-protected tables directly:
--      wrap the owner-reads-customer check in a SECURITY DEFINER helper.
--   2. No policy anywhere should check admin-ship by opening profiles
--      directly: use the existing SECURITY DEFINER is_admin() instead.
--      (Live data verified: everyone with role='admin' also has
--      is_admin=true, so dropping the role='admin' variant loses nothing.)
--
-- Bonus fix: the old coupons_owner_or_admin_write required the joined places
-- row even for admins, so admins could not INSERT/UPDATE platform coupons
-- (place_id IS NULL) through the client. With is_admin() OR-ed at the top
-- level, admins can manage platform coupons; owners still cannot (their
-- branch still requires the joined place row, absent when place_id IS NULL).

-- ─── 1. Helper: does the current user own a place where p_profile redeemed? ──

create or replace function public.owner_redeemed_customer(p_profile uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.coupon_redemptions cr
    join public.coupons c on c.id = cr.coupon_id
    join public.places  p on p.id = c.place_id
    where cr.user_id = p_profile
      and p.owner_id = auth.uid()
  );
$$;

revoke all on function public.owner_redeemed_customer(uuid) from public;
grant execute on function public.owner_redeemed_customer(uuid) to authenticated;

-- ─── 2. profiles: same rule as 025 intended, now recursion-free ─────────────

drop policy if exists "profiles_owner_read_customers" on public.profiles;
create policy "profiles_owner_read_customers" on public.profiles
  for select
  using (public.owner_redeemed_customer(profiles.id));

-- ─── 3. coupon_redemptions: admin check via is_admin() ──────────────────────

drop policy if exists "coupon_redemptions_owner_admin_read" on public.coupon_redemptions;
create policy "coupon_redemptions_owner_admin_read" on public.coupon_redemptions
  for select
  using (
    is_admin()
    or exists (
      select 1
      from public.coupons c
      join public.places p on p.id = c.place_id
      where c.id = coupon_redemptions.coupon_id
        and p.owner_id = auth.uid()
    )
  );

drop policy if exists "coupon_redemptions_owner_admin_update" on public.coupon_redemptions;
create policy "coupon_redemptions_owner_admin_update" on public.coupon_redemptions
  for update
  using (
    is_admin()
    or exists (
      select 1
      from public.coupons c
      join public.places p on p.id = c.place_id
      where c.id = coupon_redemptions.coupon_id
        and p.owner_id = auth.uid()
    )
  );

-- ─── 4. coupons: admin check via is_admin() ─────────────────────────────────

drop policy if exists "coupons_owner_or_admin_write" on public.coupons;
create policy "coupons_owner_or_admin_write" on public.coupons
  for all
  using (
    is_admin()
    or exists (
      select 1 from public.places p
      where p.id = coupons.place_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from public.places p
      where p.id = coupons.place_id
        and p.owner_id = auth.uid()
    )
  );

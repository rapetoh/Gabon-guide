-- Migration 016: total redemption quota, discount value model, bill tracking
--
-- Adds:
--   coupons.max_total_redemptions     int, nullable (null = unlimited)
--   coupons.discount_type             text, nullable ('percentage' | 'amount')
--   coupons.discount_value            int,  nullable (% 1-100 OR FCFA amount)
--   coupon_redemptions.bill_amount       int, nullable (FCFA, captured by owner at redeem time)
--   coupon_redemptions.discount_applied  int, nullable (FCFA, computed at redeem time)
--
-- Constraints enforce that discount_type and discount_value are set/unset together
-- and that values fall in valid ranges. max_total_redemptions must be positive
-- when set. Adds an index supporting fast (coupon_id, redeemed_at IS NOT NULL)
-- counts used by the per-user and per-coupon quota gates.

alter table coupons
  add column max_total_redemptions int,
  add column discount_type text,
  add column discount_value int;

alter table coupons
  add constraint coupons_max_total_positive
    check (max_total_redemptions is null or max_total_redemptions > 0);

alter table coupons
  add constraint coupons_discount_pair_consistent
    check (
      (discount_type is null and discount_value is null)
      or (discount_type is not null and discount_value is not null)
    );

alter table coupons
  add constraint coupons_discount_type_allowed
    check (discount_type is null or discount_type in ('percentage', 'amount'));

alter table coupons
  add constraint coupons_discount_value_in_range
    check (
      discount_value is null
      or (discount_type = 'percentage' and discount_value between 1 and 100)
      or (discount_type = 'amount' and discount_value > 0)
    );

alter table coupon_redemptions
  add column bill_amount int,
  add column discount_applied int;

alter table coupon_redemptions
  add constraint coupon_redemptions_bill_amount_nonneg
    check (bill_amount is null or bill_amount >= 0);

alter table coupon_redemptions
  add constraint coupon_redemptions_discount_applied_nonneg
    check (discount_applied is null or discount_applied >= 0);

-- Index used by quota checks: count redeemed rows by coupon (total quota) and
-- by (coupon, user) (per-user limit). Partial index keeps it small.
create index if not exists coupon_redemptions_redeemed_idx
  on coupon_redemptions (coupon_id, user_id)
  where redeemed_at is not null;

-- Migration 014: 3-tier monetization + coupons + referrals + system settings
-- Logged in docs/PLAN.md under "2026-05-06 — 3-Tier Monetization + Coupons + Referrals (planned)".
--
-- This migration introduces:
--   1. subscription_tier on places (free / standard / premium)
--   2. social links + menu PDF path on places
--   3. is_promoted gated to Premium tier via check constraint
--   4. tier_features matrix + tier_limits — both admin-editable at runtime
--   5. coupons + coupon_redemptions (Standard+ owners create; QR-code redemption)
--   6. referral_code + referred_by on profiles + referral_settings (admin-configurable)
--   7. system_settings (single-row config; currently just moderation_enabled)
--   8. search_trends_weekly (backing table for Premium "competition trends")
--   9. RLS policies for every new table + auto-generation of referral codes on signup

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tier + extra fields on places
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'standard', 'premium')),
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS social_instagram text,
  ADD COLUMN IF NOT EXISTS social_facebook text,
  ADD COLUMN IF NOT EXISTS social_tiktok text,
  ADD COLUMN IF NOT EXISTS menu_pdf_path text;

CREATE INDEX IF NOT EXISTS places_subscription_tier_idx
  ON public.places (subscription_tier);

CREATE INDEX IF NOT EXISTS places_subscription_expires_at_idx
  ON public.places (subscription_expires_at)
  WHERE subscription_expires_at IS NOT NULL;

-- Only Premium places may be promoted (Trending Now / top-3 in category).
-- Backfill: any place currently promoted is implicitly Premium — upgrade them
-- before the constraint is added so existing data stays valid.
UPDATE public.places
SET subscription_tier = 'premium'
WHERE is_promoted = true
  AND subscription_tier <> 'premium';

ALTER TABLE public.places
  DROP CONSTRAINT IF EXISTS promoted_requires_premium;
ALTER TABLE public.places
  ADD CONSTRAINT promoted_requires_premium
  CHECK (NOT is_promoted OR subscription_tier = 'premium');

COMMENT ON COLUMN public.places.subscription_tier IS
  'B2B subscription tier: free | standard | premium. Drives feature gating via tier_features.';
COMMENT ON COLUMN public.places.subscription_expires_at IS
  'NULL = evergreen (free or admin-granted). Otherwise the date the paid tier expires.';
COMMENT ON COLUMN public.places.menu_pdf_path IS
  'Storage path of an uploaded menu PDF (Standard+). Photos remain in the photos table.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. tier_features matrix + tier_limits (both admin-editable at runtime)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tier_features (
  feature_key text NOT NULL,
  tier        text NOT NULL CHECK (tier IN ('free', 'standard', 'premium')),
  enabled     boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (feature_key, tier)
);

CREATE TABLE IF NOT EXISTS public.tier_limits (
  tier       text PRIMARY KEY CHECK (tier IN ('free', 'standard', 'premium')),
  max_photos int NOT NULL DEFAULT 5  -- 9999 = effectively unlimited
);

-- Seed tier_limits per agreed mapping
INSERT INTO public.tier_limits (tier, max_photos) VALUES
  ('free',     5),
  ('standard', 9999),
  ('premium',  9999)
ON CONFLICT (tier) DO NOTHING;

-- Seed tier_features per agreed mapping (2026-05-06)
-- Free has nothing enabled here. Profile basics + reply-to-reviews are open to all
-- tiers and do NOT live in this matrix (they're not gated).
INSERT INTO public.tier_features (feature_key, tier, enabled) VALUES
  -- Standard+ features
  ('whatsapp_cta',       'free',     false),
  ('whatsapp_cta',       'standard', true),
  ('whatsapp_cta',       'premium',  true),

  ('call_cta',           'free',     false),
  ('call_cta',           'standard', true),
  ('call_cta',           'premium',  true),

  ('website_cta',        'free',     false),
  ('website_cta',        'standard', true),
  ('website_cta',        'premium',  true),

  ('social_links',       'free',     false),
  ('social_links',       'standard', true),
  ('social_links',       'premium',  true),

  ('menu',               'free',     false),
  ('menu',               'standard', true),
  ('menu',               'premium',  true),

  ('verified_badge',     'free',     false),
  ('verified_badge',     'standard', true),
  ('verified_badge',     'premium',  true),

  ('views_stat',         'free',     false),
  ('views_stat',         'standard', true),
  ('views_stat',         'premium',  true),

  ('coupons_create',     'free',     false),
  ('coupons_create',     'standard', true),
  ('coupons_create',     'premium',  true),

  -- Premium-only features
  ('video',              'free',     false),
  ('video',              'standard', false),
  ('video',              'premium',  true),

  ('trending_eligible',  'free',     false),
  ('trending_eligible',  'standard', false),
  ('trending_eligible',  'premium',  true),

  ('competition_trends', 'free',     false),
  ('competition_trends', 'standard', false),
  ('competition_trends', 'premium',  true)
ON CONFLICT (feature_key, tier) DO NOTHING;

COMMENT ON TABLE public.tier_features IS
  'Admin-editable feature gating. Mobile + web read this at runtime via usePlaceTier / useTierFeatures.';
COMMENT ON TABLE public.tier_limits IS
  'Per-tier numeric limits (photo cap today; future limits added as columns).';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Coupons + redemptions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coupons (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id                 uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  title_fr                 text NOT NULL,
  title_en                 text,
  description_fr           text,
  description_en           text,
  starts_at                timestamptz NOT NULL DEFAULT now(),
  expires_at               timestamptz NOT NULL,
  max_redemptions_per_user int NOT NULL DEFAULT 1,
  is_active                boolean NOT NULL DEFAULT true,
  is_system                boolean NOT NULL DEFAULT false,  -- true = O'Kili-issued (e.g. referral reward)
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coupons_place_id_idx ON public.coupons (place_id);
CREATE INDEX IF NOT EXISTS coupons_active_idx ON public.coupons (is_active, expires_at);

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id       uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redemption_code text NOT NULL,
  redeemed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, user_id, redemption_code)
);

CREATE INDEX IF NOT EXISTS coupon_redemptions_user_idx ON public.coupon_redemptions (user_id);
CREATE INDEX IF NOT EXISTS coupon_redemptions_code_idx ON public.coupon_redemptions (redemption_code);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Referrals
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_referred_by_idx ON public.profiles (referred_by);

-- Generator: 8 chars, uppercase letters + digits, prefixed for recognizability
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- omit 0/O/1/I to avoid confusion
  result    text;
  i         int;
  attempts  int := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    -- Collision-check
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = result) THEN
      RETURN result;
    END IF;
    attempts := attempts + 1;
    IF attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate unique referral code after 10 attempts';
    END IF;
  END LOOP;
END;
$$;

-- Trigger: auto-set referral_code when a profile row is inserted without one
CREATE OR REPLACE FUNCTION public.set_referral_code_on_profile()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_referral_code ON public.profiles;
CREATE TRIGGER profiles_set_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_referral_code_on_profile();

-- Backfill referral codes for any existing profile that doesn't have one
UPDATE public.profiles
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL;

-- Single-row referral configuration (admin edits this)
CREATE TABLE IF NOT EXISTS public.referral_settings (
  id                      int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  reward_type             text NOT NULL DEFAULT 'coupon'
    CHECK (reward_type IN ('coupon', 'points', 'none')),
  referrer_reward_value   int NOT NULL DEFAULT 0,
  referee_reward_value    int NOT NULL DEFAULT 0,
  reward_coupon_id        uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  is_active               boolean NOT NULL DEFAULT true,
  updated_at              timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.referral_settings (id) VALUES (1) ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. System settings (currently just the moderation toggle)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.system_settings (
  id                  int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  moderation_enabled  boolean NOT NULL DEFAULT false,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.system_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

COMMENT ON COLUMN public.system_settings.moderation_enabled IS
  'When TRUE (post-MVP), owner edits enter a pending-review queue. MVP ships toggle only.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Search-trends backing table (Premium "competition trends")
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.search_trends_weekly (
  week_of      date NOT NULL,
  category_id  uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  search_count int NOT NULL DEFAULT 0,
  PRIMARY KEY (week_of, category_id)
);

CREATE INDEX IF NOT EXISTS search_trends_weekly_week_idx ON public.search_trends_weekly (week_of DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS policies
-- ─────────────────────────────────────────────────────────────────────────────

-- tier_features + tier_limits: world-readable, admin-only writes
ALTER TABLE public.tier_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tier_limits   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tier_features_read_all" ON public.tier_features;
CREATE POLICY "tier_features_read_all" ON public.tier_features
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "tier_features_admin_write" ON public.tier_features;
CREATE POLICY "tier_features_admin_write" ON public.tier_features
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  );

DROP POLICY IF EXISTS "tier_limits_read_all" ON public.tier_limits;
CREATE POLICY "tier_limits_read_all" ON public.tier_limits
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "tier_limits_admin_write" ON public.tier_limits;
CREATE POLICY "tier_limits_admin_write" ON public.tier_limits
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  );

-- coupons: world-readable; place owner (or admin) can write
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coupons_read_all" ON public.coupons;
CREATE POLICY "coupons_read_all" ON public.coupons
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "coupons_owner_or_admin_write" ON public.coupons;
CREATE POLICY "coupons_owner_or_admin_write" ON public.coupons
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.places p
            WHERE p.id = coupons.place_id
              AND (p.owner_id = auth.uid()
                   OR EXISTS (SELECT 1 FROM public.profiles
                              WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.places p
            WHERE p.id = coupons.place_id
              AND (p.owner_id = auth.uid()
                   OR EXISTS (SELECT 1 FROM public.profiles
                              WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))))
  );

-- coupon_redemptions: user can read/insert their own; place owner/admin can read+update redeemed_at
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coupon_redemptions_user_read_own" ON public.coupon_redemptions;
CREATE POLICY "coupon_redemptions_user_read_own" ON public.coupon_redemptions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "coupon_redemptions_owner_admin_read" ON public.coupon_redemptions;
CREATE POLICY "coupon_redemptions_owner_admin_read" ON public.coupon_redemptions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.coupons c
            JOIN public.places p ON p.id = c.place_id
            WHERE c.id = coupon_redemptions.coupon_id
              AND (p.owner_id = auth.uid()
                   OR EXISTS (SELECT 1 FROM public.profiles
                              WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))))
  );

DROP POLICY IF EXISTS "coupon_redemptions_user_insert_own" ON public.coupon_redemptions;
CREATE POLICY "coupon_redemptions_user_insert_own" ON public.coupon_redemptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Owner / admin can mark redeemed_at
DROP POLICY IF EXISTS "coupon_redemptions_owner_admin_update" ON public.coupon_redemptions;
CREATE POLICY "coupon_redemptions_owner_admin_update" ON public.coupon_redemptions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.coupons c
            JOIN public.places p ON p.id = c.place_id
            WHERE c.id = coupon_redemptions.coupon_id
              AND (p.owner_id = auth.uid()
                   OR EXISTS (SELECT 1 FROM public.profiles
                              WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))))
  );

-- referral_settings: world-readable, admin-only writes
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referral_settings_read_all" ON public.referral_settings;
CREATE POLICY "referral_settings_read_all" ON public.referral_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "referral_settings_admin_write" ON public.referral_settings;
CREATE POLICY "referral_settings_admin_write" ON public.referral_settings
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  );

-- system_settings: world-readable (clients need moderation_enabled), admin-only writes
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_settings_read_all" ON public.system_settings;
CREATE POLICY "system_settings_read_all" ON public.system_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "system_settings_admin_write" ON public.system_settings;
CREATE POLICY "system_settings_admin_write" ON public.system_settings
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  );

-- search_trends_weekly: read for authenticated (UI gates Premium-only client-side); admin writes
ALTER TABLE public.search_trends_weekly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "search_trends_read_authenticated" ON public.search_trends_weekly;
CREATE POLICY "search_trends_read_authenticated" ON public.search_trends_weekly
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "search_trends_admin_write" ON public.search_trends_weekly;
CREATE POLICY "search_trends_admin_write" ON public.search_trends_weekly
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  );

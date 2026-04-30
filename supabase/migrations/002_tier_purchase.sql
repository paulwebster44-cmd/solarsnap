-- ============================================================
-- SolarSnap — Migration 002: Tier Purchase Fields
-- Run in Supabase dashboard: SQL Editor → New Query
-- ============================================================

-- Add 'free' as a valid licence tier and a timestamp for when a tier was purchased.
-- 'free' is now the default for new registrations; users are promoted to 'basic'
-- or 'premium' after a validated in-app purchase.

-- 1. Drop the existing constraint so we can extend it
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_licence_tier_check;

-- 2. Change the column default to 'free' for new sign-ups
ALTER TABLE profiles
  ALTER COLUMN licence_tier SET DEFAULT 'free';

-- 3. Re-add the constraint with 'free' included
ALTER TABLE profiles
  ADD CONSTRAINT profiles_licence_tier_check
  CHECK (licence_tier IN ('free', 'basic', 'premium', 'commercial'));

-- 4. Record when the tier was last purchased/upgraded (NULL = never purchased)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tier_purchased_at TIMESTAMPTZ;

-- Note: existing rows keep their current licence_tier value (likely 'basic'
-- from development / testing). In a production reset you would set them to
-- 'free' with:  UPDATE profiles SET licence_tier = 'free';

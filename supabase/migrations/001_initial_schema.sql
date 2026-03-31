-- ============================================================
-- SolarSnap — Initial Schema
-- Run this in the Supabase dashboard: SQL Editor → New Query
-- ============================================================

-- User profiles: extends Supabase auth.users with app-specific fields
CREATE TABLE profiles (
  id                 UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  home_latitude      DOUBLE PRECISION,
  home_longitude     DOUBLE PRECISION,
  credits_remaining  INTEGER       NOT NULL DEFAULT 10,
  licence_tier       TEXT          NOT NULL DEFAULT 'basic'
                                   CHECK (licence_tier IN ('basic', 'premium', 'commercial')),
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Row Level Security: users can only access their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create a profile row when a new user registers
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update the updated_at timestamp on every profile change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Atomic credit deduction
-- Called via supabase.rpc('deduct_assessment_credit')
-- Returns the new credit balance, or -1 if already at zero.
-- Using a stored procedure prevents race conditions from
-- concurrent assessments.
-- ============================================================
CREATE OR REPLACE FUNCTION deduct_assessment_credit()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_credits INTEGER;
BEGIN
  UPDATE profiles
  SET credits_remaining = credits_remaining - 1
  WHERE id = auth.uid()
    AND credits_remaining > 0
  RETURNING credits_remaining INTO new_credits;

  -- RETURNING sets new_credits to NULL if no row was updated (0 credits)
  RETURN COALESCE(new_credits, -1);
END;
$$;

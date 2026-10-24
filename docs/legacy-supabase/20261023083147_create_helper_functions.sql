/*
# Jalaram Real Estate — Helper Functions

Creates is_admin() and is_staff() SECURITY DEFINER helper functions
that check the current user's role in the profiles table.
These must exist before any policies reference them.

## Functions
- is_admin(): returns true if current user has role='admin' and is not suspended
- is_staff(): returns true if current user has role in ('broker','admin') and is not suspended
*/

-- We need a minimal profiles table for the functions to reference
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'broker', 'admin')),
  avatar_url text,
  is_suspended boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_suspended = false
  );
$$;

REVOKE EXECUTE ON FUNCTION is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('broker', 'admin')
    AND is_suspended = false
  );
$$;

REVOKE EXECUTE ON FUNCTION is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_staff() TO authenticated;

-- updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

/*
# Jalaram Real Estate — Complete Database Schema

## Overview
Creates the full database schema for a property brokerage platform targeting Ahmedabad, Gujarat.
Supports property owners, brokers, and admins with role-based access control.

## Tables
1. profiles — extends auth.users with role, name, phone, suspension status (already created in helper migration, adding RLS + policies)
2. localities — Ahmedabad neighbourhoods with slugs for SEO landing pages
3. properties — core listing table with sale/rent, type, price, area, bedrooms, status workflow
4. property_images — gallery images per property with cover image flag and sort order
5. amenities — reference data for property amenities
6. leads — CRM leads from enquiry forms, WhatsApp, social, etc. with pipeline status
7. lead_activities — activity timeline per lead
8. site_visits — scheduled visits linked to leads and properties
9. deals — transaction records with brokerage tracking
10. audit_logs — audit trail for sensitive admin actions

## Security
- RLS enabled on every table
- Public read access on published properties, localities, amenities
- Owner-scoped CRUD on own properties and images
- Staff/admin access on leads, activities, site visits, deals, audit logs
- Lead creation open to public (anon + authenticated)
*/

-- ============ PROFILES: RLS + POLICIES ============
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR is_admin());

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ LOCALITIES ============
CREATE TABLE IF NOT EXISTS localities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  image_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE localities ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON localities TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON localities TO authenticated;

DROP POLICY IF EXISTS "localities_public_read" ON localities;
CREATE POLICY "localities_public_read" ON localities FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "localities_admin_write" ON localities;
CREATE POLICY "localities_admin_write" ON localities FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "localities_admin_update" ON localities;
CREATE POLICY "localities_admin_update" ON localities FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "localities_admin_delete" ON localities;
CREATE POLICY "localities_admin_delete" ON localities FOR DELETE
  TO authenticated USING (is_admin());

-- ============ PROPERTIES ============
CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  description text NOT NULL DEFAULT '',
  listing_type text NOT NULL CHECK (listing_type IN ('sale', 'rent')),
  property_type text NOT NULL CHECK (property_type IN ('apartment', 'independent_house', 'villa', 'plot')),
  locality_id uuid REFERENCES localities(id) ON DELETE SET NULL,
  public_address text NOT NULL DEFAULT '',
  private_address text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  maintenance_charges numeric(12,2),
  area_sqft integer NOT NULL DEFAULT 0,
  bedrooms integer,
  bathrooms integer,
  furnishing text CHECK (furnishing IN ('unfurnished', 'semi_furnished', 'fully_furnished')),
  amenities text[] NOT NULL DEFAULT '{}',
  listing_status text NOT NULL DEFAULT 'draft' CHECK (listing_status IN ('draft', 'pending', 'published', 'rejected', 'suspended', 'closed')),
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  rejection_reason text,
  reference_id text NOT NULL UNIQUE,
  published_at timestamptz,
  expiry_date date,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_properties_listing_status ON properties(listing_status);
CREATE INDEX IF NOT EXISTS idx_properties_listing_type ON properties(listing_type);
CREATE INDEX IF NOT EXISTS idx_properties_locality ON properties(locality_id);
CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_slug ON properties(slug);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON properties TO authenticated;

DROP POLICY IF EXISTS "properties_public_read" ON properties;
CREATE POLICY "properties_public_read" ON properties FOR SELECT
  TO anon, authenticated
  USING (
    listing_status = 'published'
    AND deleted_at IS NULL
    AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
  );

DROP POLICY IF EXISTS "properties_owner_read" ON properties;
CREATE POLICY "properties_owner_read" ON properties FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id OR is_admin());

DROP POLICY IF EXISTS "properties_owner_insert" ON properties;
CREATE POLICY "properties_owner_insert" ON properties FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "properties_owner_update" ON properties;
CREATE POLICY "properties_owner_update" ON properties FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id OR is_admin())
  WITH CHECK (auth.uid() = owner_id OR is_admin());

DROP POLICY IF EXISTS "properties_owner_delete" ON properties;
CREATE POLICY "properties_owner_delete" ON properties FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id OR is_admin());

DROP TRIGGER IF EXISTS trg_properties_updated_at ON properties;
CREATE TRIGGER trg_properties_updated_at BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ PROPERTY IMAGES ============
CREATE TABLE IF NOT EXISTS property_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_images_property ON property_images(property_id);

ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON property_images TO authenticated;

DROP POLICY IF EXISTS "property_images_public_read" ON property_images;
CREATE POLICY "property_images_public_read" ON property_images FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_images.property_id
      AND properties.listing_status = 'published'
      AND properties.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "property_images_owner_read" ON property_images;
CREATE POLICY "property_images_owner_read" ON property_images FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_images.property_id
      AND (properties.owner_id = auth.uid() OR is_admin())
    )
  );

DROP POLICY IF EXISTS "property_images_owner_insert" ON property_images;
CREATE POLICY "property_images_owner_insert" ON property_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_images.property_id
      AND (properties.owner_id = auth.uid() OR is_admin())
    )
  );

DROP POLICY IF EXISTS "property_images_owner_update" ON property_images;
CREATE POLICY "property_images_owner_update" ON property_images FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_images.property_id
      AND (properties.owner_id = auth.uid() OR is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_images.property_id
      AND (properties.owner_id = auth.uid() OR is_admin())
    )
  );

DROP POLICY IF EXISTS "property_images_owner_delete" ON property_images;
CREATE POLICY "property_images_owner_delete" ON property_images FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_images.property_id
      AND (properties.owner_id = auth.uid() OR is_admin())
    )
  );

-- ============ AMENITIES ============
CREATE TABLE IF NOT EXISTS amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE amenities ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON amenities TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON amenities TO authenticated;

DROP POLICY IF EXISTS "amenities_public_read" ON amenities;
CREATE POLICY "amenities_public_read" ON amenities FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "amenities_admin_write" ON amenities;
CREATE POLICY "amenities_admin_write" ON amenities FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "amenities_admin_update" ON amenities;
CREATE POLICY "amenities_admin_update" ON amenities FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "amenities_admin_delete" ON amenities;
CREATE POLICY "amenities_admin_delete" ON amenities FOR DELETE
  TO authenticated USING (is_admin());

-- ============ LEADS ============
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  phone text NOT NULL,
  email text,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  lead_type text NOT NULL DEFAULT 'enquiry' CHECK (lead_type IN ('buy', 'rent', 'sell', 'enquiry')),
  source text NOT NULL DEFAULT 'website' CHECK (source IN ('website', 'whatsapp', 'instagram', 'facebook', 'google', 'referral', 'other')),
  budget_min numeric(12,2),
  budget_max numeric(12,2),
  preferred_locality text,
  notes text,
  assigned_broker_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'site_visit', 'negotiation', 'closed', 'lost')),
  next_follow_up timestamptz,
  consent_marketing boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_property ON leads(property_id);
CREATE INDEX IF NOT EXISTS idx_leads_broker ON leads(assigned_broker_id);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE, DELETE ON leads TO authenticated;
GRANT INSERT ON leads TO anon, authenticated;

DROP POLICY IF EXISTS "leads_public_insert" ON leads;
CREATE POLICY "leads_public_insert" ON leads FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "leads_staff_read" ON leads;
CREATE POLICY "leads_staff_read" ON leads FOR SELECT
  TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "leads_staff_update" ON leads;
CREATE POLICY "leads_staff_update" ON leads FOR UPDATE
  TO authenticated USING (is_staff()) WITH CHECK (is_staff());

DROP POLICY IF EXISTS "leads_staff_delete" ON leads;
CREATE POLICY "leads_staff_delete" ON leads FOR DELETE
  TO authenticated USING (is_admin());

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ LEAD ACTIVITIES ============
CREATE TABLE IF NOT EXISTS lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  activity_type text NOT NULL DEFAULT 'note',
  description text NOT NULL,
  performed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id);

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON lead_activities TO authenticated;

DROP POLICY IF EXISTS "lead_activities_staff_read" ON lead_activities;
CREATE POLICY "lead_activities_staff_read" ON lead_activities FOR SELECT
  TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "lead_activities_staff_insert" ON lead_activities;
CREATE POLICY "lead_activities_staff_insert" ON lead_activities FOR INSERT
  TO authenticated WITH CHECK (is_staff());

-- ============ SITE VISITS ============
CREATE TABLE IF NOT EXISTS site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_visits_lead ON site_visits(lead_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_property ON site_visits(property_id);

ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON site_visits TO authenticated;

DROP POLICY IF EXISTS "site_visits_staff_read" ON site_visits;
CREATE POLICY "site_visits_staff_read" ON site_visits FOR SELECT
  TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "site_visits_staff_insert" ON site_visits;
CREATE POLICY "site_visits_staff_insert" ON site_visits FOR INSERT
  TO authenticated WITH CHECK (is_staff());

DROP POLICY IF EXISTS "site_visits_staff_update" ON site_visits;
CREATE POLICY "site_visits_staff_update" ON site_visits FOR UPDATE
  TO authenticated USING (is_staff()) WITH CHECK (is_staff());

-- ============ DEALS ============
CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  deal_status text NOT NULL DEFAULT 'negotiation' CHECK (deal_status IN ('negotiation', 'closed', 'cancelled')),
  transaction_value numeric(14,2) NOT NULL DEFAULT 0,
  brokerage_amount numeric(12,2) NOT NULL DEFAULT 0,
  brokerage_payer text NOT NULL DEFAULT 'buyer' CHECK (brokerage_payer IN ('buyer', 'seller', 'landlord', 'tenant')),
  brokerage_payment_status text NOT NULL DEFAULT 'pending' CHECK (brokerage_payment_status IN ('pending', 'partial', 'received')),
  closure_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deals_property ON deals(property_id);
CREATE INDEX IF NOT EXISTS idx_deals_lead ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(deal_status);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON deals TO authenticated;

DROP POLICY IF EXISTS "deals_staff_read" ON deals;
CREATE POLICY "deals_staff_read" ON deals FOR SELECT
  TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "deals_staff_insert" ON deals;
CREATE POLICY "deals_staff_insert" ON deals FOR INSERT
  TO authenticated WITH CHECK (is_staff());

DROP POLICY IF EXISTS "deals_staff_update" ON deals;
CREATE POLICY "deals_staff_update" ON deals FOR UPDATE
  TO authenticated USING (is_staff()) WITH CHECK (is_staff());

DROP TRIGGER IF EXISTS trg_deals_updated_at ON deals;
CREATE TRIGGER trg_deals_updated_at BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ AUDIT LOGS ============
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON audit_logs TO authenticated;

DROP POLICY IF EXISTS "audit_logs_admin_read" ON audit_logs;
CREATE POLICY "audit_logs_admin_read" ON audit_logs FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "audit_logs_staff_insert" ON audit_logs;
CREATE POLICY "audit_logs_staff_insert" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (is_staff());

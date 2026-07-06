-- 033_quotient_integration.sql
-- Implement installers and quote settings tables, and alter quotes/comments for Quotient integration.

-- 1. Create installers table
CREATE TABLE IF NOT EXISTS installers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT CHECK (status IN ('Active', 'Inactive')) DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for org_id lookup
CREATE INDEX IF NOT EXISTS idx_installers_org ON installers(org_id);

-- Enable RLS for installers
ALTER TABLE installers ENABLE ROW LEVEL SECURITY;

-- Allow public/authenticated CRUD on installers
CREATE POLICY "Allow authenticated installers CRUD" ON installers FOR ALL TO authenticated USING (org_id = public.user_org_id()) WITH CHECK (org_id = public.user_org_id());


-- 2. Create quote_settings table
CREATE TABLE IF NOT EXISTS quote_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organisations(id) ON DELETE CASCADE UNIQUE,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  default_deposit NUMERIC DEFAULT 15,
  xero_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for org_id lookup
CREATE INDEX IF NOT EXISTS idx_quote_settings_org ON quote_settings(org_id);

-- Enable RLS for quote_settings
ALTER TABLE quote_settings ENABLE ROW LEVEL SECURITY;

-- Allow public/authenticated CRUD on quote_settings
CREATE POLICY "Allow public select settings" ON quote_settings FOR SELECT USING (true);
CREATE POLICY "Allow authenticated settings CRUD" ON quote_settings FOR ALL TO authenticated USING (org_id = public.user_org_id()) WITH CHECK (org_id = public.user_org_id());


-- 3. Alter quotes table
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS assigned_installer_id UUID REFERENCES installers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS install_date DATE,
  ADD COLUMN IF NOT EXISTS use_splits BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS split_ratio_a NUMERIC DEFAULT 50,
  ADD COLUMN IF NOT EXISTS split_ratio_b NUMERIC DEFAULT 50,
  ADD COLUMN IF NOT EXISTS xero_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS xero_sync_status TEXT DEFAULT 'Unsynced';

-- Index for assigned_installer_id lookup
CREATE INDEX IF NOT EXISTS idx_quotes_assigned_installer ON quotes(assigned_installer_id);


-- 4. Alter quote_comments table
ALTER TABLE quote_comments
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;


-- 5. Setup real-time replication for installers and quote_settings
ALTER PUBLICATION supabase_realtime ADD TABLE installers;
ALTER PUBLICATION supabase_realtime ADD TABLE quote_settings;

-- 6. Alter quote_acceptances to add signature_data_b for dual signatures
ALTER TABLE quote_acceptances ADD COLUMN IF NOT EXISTS signature_data_b TEXT;

-- 7. Multi-tenant isolation remediation
ALTER TABLE quote_comments ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
ALTER TABLE quote_acceptances ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;

-- Drop old insecure policies
DROP POLICY IF EXISTS "Allow public read comments" ON quote_comments;
DROP POLICY IF EXISTS "Allow public insert comments" ON quote_comments;
DROP POLICY IF EXISTS "Allow public read acceptances" ON quote_acceptances;
DROP POLICY IF EXISTS "Allow public insert acceptances" ON quote_acceptances;
DROP POLICY IF EXISTS "Allow public select settings" ON quote_settings;
DROP POLICY IF EXISTS "Allow authenticated settings CRUD" ON quote_settings;

-- Implement new secure policies
CREATE POLICY "Allow select settings" ON quote_settings FOR SELECT USING (org_id = public.user_org_id() OR (org_id IN (SELECT org_id FROM quotes WHERE status IN ('sent', 'accepted'))));
DROP POLICY IF EXISTS "Allow select comments" ON quote_comments;
CREATE POLICY "Allow select comments" ON quote_comments FOR SELECT USING (org_id = public.user_org_id() OR (is_private = false AND quote_id IN (SELECT id FROM quotes WHERE status IN ('sent', 'accepted'))));

DROP POLICY IF EXISTS "Allow insert comments" ON quote_comments;
CREATE POLICY "Allow insert comments" ON quote_comments FOR INSERT WITH CHECK ((org_id = public.user_org_id() OR (org_id = (SELECT org_id FROM quotes WHERE id = quote_id) AND quote_id IN (SELECT id FROM quotes WHERE status = 'sent'))));

CREATE POLICY "Allow select acceptances" ON quote_acceptances FOR SELECT USING (org_id = public.user_org_id() OR (quote_id IN (SELECT id FROM quotes WHERE status IN ('sent', 'accepted'))));

DROP POLICY IF EXISTS "Allow insert acceptances" ON quote_acceptances;
CREATE POLICY "Allow insert acceptances" ON quote_acceptances FOR INSERT WITH CHECK ((org_id = public.user_org_id() OR (org_id = (SELECT org_id FROM quotes WHERE id = quote_id) AND quote_id IN (SELECT id FROM quotes WHERE status = 'sent'))));

DROP POLICY IF EXISTS "Allow public update quote to accept" ON quotes;
CREATE POLICY "Allow public update quote to accept" ON quotes FOR UPDATE TO anon, authenticated USING (status = 'sent') WITH CHECK (status = 'accepted');

-- Ensure authenticated CRUD is allowed for staff on their own organisation
CREATE POLICY "Allow authenticated CRUD settings" ON quote_settings FOR ALL TO authenticated USING (org_id = public.user_org_id()) WITH CHECK (org_id = public.user_org_id());
CREATE POLICY "Allow authenticated CRUD comments" ON quote_comments FOR ALL TO authenticated USING (org_id = public.user_org_id()) WITH CHECK (org_id = public.user_org_id());
CREATE POLICY "Allow authenticated CRUD acceptances" ON quote_acceptances FOR ALL TO authenticated USING (org_id = public.user_org_id()) WITH CHECK (org_id = public.user_org_id());



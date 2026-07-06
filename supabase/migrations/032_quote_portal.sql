-- 032_quote_portal.sql
-- Create tables and policies to support Quotient-style public quote viewer, comments, and acceptances.

-- 1. Create quote_comments table for discussion threads
CREATE TABLE IF NOT EXISTS quote_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  is_staff BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup of comments per quote
CREATE INDEX IF NOT EXISTS idx_quote_comments_quote ON quote_comments(quote_id);

-- Enable RLS
ALTER TABLE quote_comments ENABLE ROW LEVEL SECURITY;

-- Policies for quote_comments (public can read and write comments for any quote they know the ID for)
CREATE POLICY "Allow public read comments" ON quote_comments
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert comments" ON quote_comments
  FOR INSERT WITH CHECK (true);

-- 2. Create quote_acceptances table for e-signatures
CREATE TABLE IF NOT EXISTS quote_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  accepted_by TEXT NOT NULL,
  email TEXT NOT NULL,
  signature_data TEXT NOT NULL, -- Draw signature SVG or base64 representation
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for lookup
CREATE INDEX IF NOT EXISTS idx_quote_acceptances_quote ON quote_acceptances(quote_id);

-- Enable RLS
ALTER TABLE quote_acceptances ENABLE ROW LEVEL SECURITY;

-- Policies for quote_acceptances (public can read and insert acceptances)
CREATE POLICY "Allow public read acceptances" ON quote_acceptances
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert acceptances" ON quote_acceptances
  FOR INSERT WITH CHECK (true);

-- 3. Public Read Policies for Quotes, Runs, Segments, and Products
-- These allow unauthenticated users (clients) to load quotes when given a share link (UUID)

CREATE POLICY "Allow public select quotes" ON quotes FOR SELECT USING (status IN ('sent', 'accepted'));

CREATE POLICY "Allow public select quote_runs" ON quote_runs FOR SELECT USING (EXISTS (SELECT 1 FROM quotes WHERE quotes.id = quote_runs.quote_id AND quotes.status IN ('sent', 'accepted')));

CREATE POLICY "Allow public select quote_run_segments" ON quote_run_segments FOR SELECT USING (EXISTS (SELECT 1 FROM quote_runs JOIN quotes ON quotes.id = quote_runs.quote_id WHERE quote_runs.id = quote_run_segments.quote_run_id AND quotes.status IN ('sent', 'accepted')));

CREATE POLICY "Allow public select products" ON products
  FOR SELECT USING (true);

-- 4. Public Update Policy for accepting quotes
-- Allows updating a quote's status to 'accepted' and updating the final BOM to match selected options.
CREATE POLICY "Allow public update quote to accept" ON quotes
  FOR UPDATE USING (status IN ('draft', 'sent'))
  WITH CHECK (status = 'accepted');

-- 5. Enable real-time replication for comments and quotes so the vendor dashboard updates live
ALTER PUBLICATION supabase_realtime ADD TABLE quote_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE quotes;

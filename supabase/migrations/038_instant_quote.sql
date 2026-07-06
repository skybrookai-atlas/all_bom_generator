-- 038_instant_quote.sql
-- Embeddable public instant-quote widget.
--
-- instant_quote_settings: per fence system, the owner sets labour $/m, margin %
-- and the displayed range spread. The public endpoint only ever returns a
-- price RANGE (inc GST); exact pricing is stored on the draft lead quote.

CREATE TABLE IF NOT EXISTS instant_quote_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  system_type TEXT NOT NULL,                 -- 'TP_PALING' | 'COLORBOND' | ...
  enabled BOOLEAN DEFAULT FALSE,
  labor_per_m NUMERIC,                       -- supply & install labour $/lineal metre (ex GST)
  margin_pct NUMERIC DEFAULT 30,             -- applied to (materials + labour)
  range_spread_pct NUMERIC DEFAULT 8,        -- displayed range = exact ± spread%
  min_job NUMERIC DEFAULT 0,                 -- floor for the exact price (ex GST)
  metadata JSONB DEFAULT '{}'::JSONB,        -- future: height multipliers, option locks
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, system_type)
);

ALTER TABLE instant_quote_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated instant quote settings CRUD" ON instant_quote_settings
  FOR ALL TO authenticated
  USING (org_id = public.user_org_id())
  WITH CHECK (org_id = public.user_org_id());

-- Rates are commercially sensitive — never anon-readable. The public widget
-- goes through the instant-quote edge function (service role).
REVOKE ALL ON instant_quote_settings FROM anon;

-- Public widget identity: the embed token is the only thing the website knows.
ALTER TABLE quote_settings
  ADD COLUMN IF NOT EXISTS embed_token UUID DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_settings_embed_token
  ON quote_settings(embed_token);

-- Website leads: quotes created by the widget have no auth user. Relax the
-- NOT NULL (RLS still governs client access; the edge function inserts via
-- service role and assigns the org's admin as owner when one exists).
ALTER TABLE quotes ALTER COLUMN user_id DROP NOT NULL;

-- Seed default rows for the two launch systems (disabled until rates are set).
INSERT INTO instant_quote_settings (org_id, system_type, enabled)
SELECT o.id, s.system_type, FALSE
FROM organisations o
CROSS JOIN (VALUES ('TP_PALING'), ('COLORBOND')) AS s(system_type)
ON CONFLICT (org_id, system_type) DO NOTHING;

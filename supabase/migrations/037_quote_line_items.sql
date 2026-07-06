-- 037_quote_line_items.sql
-- Quote editor: a quote becomes a list of line items (Quotient-style).
-- Line kinds:
--   'calculated' — fence assembly from the BOM calculator (bom_snapshot holds the
--                  engine lines; material_cost derived from them)
--   'catalogue'  — a supplier_items row added directly to the quote
--   'manual'     — free-text line
-- Client-visible fields: title, description, quantity, unit, unit_price, is_optional.
-- Internal-only fields (never exposed to the portal): material_cost, labor_cost,
-- markup_pct, bom_snapshot, supplier_item_id.

-- 1. Quote-level fields the editor needs
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS expiry_days INT DEFAULT 30;

-- 2. Line items
CREATE TABLE IF NOT EXISTS quote_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  kind TEXT NOT NULL CHECK (kind IN ('calculated', 'catalogue', 'manual')),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'each',
  unit_price NUMERIC NOT NULL DEFAULT 0,          -- client sell price ex-GST
  is_optional BOOLEAN DEFAULT FALSE,
  -- internal costing (staff only — excluded from the public portal view)
  material_cost NUMERIC,                          -- total material cost for the line
  labor_cost NUMERIC,                             -- total labour cost for the line
  markup_pct NUMERIC,                             -- helper used to derive unit_price
  bom_snapshot JSONB,                             -- engine lines behind a calculated item
  supplier_item_id UUID REFERENCES supplier_items(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_line_items_quote ON quote_line_items(quote_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_quote_line_items_org ON quote_line_items(org_id);

ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;

-- Staff: full CRUD within their org (mirrors installers/quote_settings pattern).
CREATE POLICY "Allow authenticated line items CRUD" ON quote_line_items
  FOR ALL TO authenticated
  USING (org_id = public.user_org_id())
  WITH CHECK (org_id = public.user_org_id());

-- The base table must never be readable by the anon portal (internal costs).
REVOKE ALL ON quote_line_items FROM anon;

-- 3. Public portal view — client-visible columns only, and only once the quote
-- has been sent (or accepted). The portal URL's unguessable quote UUID is the
-- access token, consistent with the existing quote portal behaviour.
CREATE OR REPLACE VIEW quote_line_items_public AS
SELECT
  li.id,
  li.quote_id,
  li.sort_order,
  li.kind,
  li.title,
  li.description,
  li.quantity,
  li.unit,
  li.unit_price,
  li.is_optional
FROM quote_line_items li
JOIN quotes q ON q.id = li.quote_id
WHERE q.status IN ('sent', 'accepted');

GRANT SELECT ON quote_line_items_public TO anon, authenticated;

-- 4. updated_at trigger (matches repo convention if the helper exists; create if not)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quote_line_items_updated_at ON quote_line_items;
CREATE TRIGGER trg_quote_line_items_updated_at
  BEFORE UPDATE ON quote_line_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
